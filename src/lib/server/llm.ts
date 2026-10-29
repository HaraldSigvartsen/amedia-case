import { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_PROVIDER } from '$app/env/private';
import { visibleAssistantText } from '#lib/html.ts';
import { providerModel, systemPrompt } from '#lib/server/prompt.ts';
import type { Role } from '#lib/types.ts';

const MISSING_KEY = 'Mangler LLM_API_KEY. Legg nøkkelen i .env og start på nytt.';
const FAILED_CALL = 'Kall til språkmodellen feilet';

type ChatTurn = {
	role: Role;
	content: string;
};

type StreamEmbedOptions = {
	history: ChatTurn[];
	currentHtml: string;
	userMessage: string;
	signal?: AbortSignal;
	onDelta: (chunk: string) => void;
};

function modelHistory(history: ChatTurn[]): ChatTurn[] {
	return history.slice(-20).map((message) => {
		if (message.role === 'user') return { role: message.role, content: message.content };
		const visible = visibleAssistantText(message.content);
		return { role: 'assistant', content: visible || 'Embeden ble oppdatert.' };
	});
}

function anthropicMessages(history: ChatTurn[], userMessage: string): ChatTurn[] {
	const merged: ChatTurn[] = [];
	for (const message of [...history, { role: 'user' as const, content: userMessage }]) {
		const previous = merged.at(-1);
		if (previous && previous.role === message.role) {
			previous.content = `${previous.content}\n\n${message.content}`;
			continue;
		}
		merged.push({ role: message.role, content: message.content });
	}
	if (merged[0]?.role === 'assistant') {
		merged.unshift({ role: 'user', content: 'Fortsett embeden.' });
	}
	return merged;
}

async function postJson(
	url: string,
	headers: Record<string, string>,
	body: unknown,
	signal?: AbortSignal
): Promise<Response> {
	const response = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
		signal
	}).catch((error: unknown) => {
		if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
		throw new Error(`${FAILED_CALL}.`);
	});
	if (!response.ok) {
		throw new Error(`${FAILED_CALL} (${response.status}).`);
	}
	return response;
}

async function forEachSseData(
	response: Response,
	onData: (data: string) => boolean
): Promise<void> {
	if (!response.body) throw new Error(`${FAILED_CALL} (tomt svar).`);
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	const handleLine = (line: string): boolean => {
		if (!line.startsWith('data:')) return false;
		const data = line.slice('data:'.length).trimStart();
		if (!data) return false;
		return onData(data);
	};

	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split(/\r?\n/);
			buffer = lines.pop() ?? '';
			for (const line of lines) {
				if (handleLine(line)) return;
			}
		}
		buffer += decoder.decode();
		if (buffer) handleLine(buffer);
	} finally {
		try {
			await reader.cancel();
		} catch {
			// Leser er allerede lukket.
		}
	}
}

function takeOpenAIDelta(data: string, append: (chunk: string) => void): boolean {
	if (data === '[DONE]') return true;
	let payload: unknown;
	try {
		payload = JSON.parse(data);
	} catch {
		return false;
	}
	if (!payload || typeof payload !== 'object') return false;
	const record = payload as {
		error?: unknown;
		choices?: { delta?: { content?: unknown } }[];
	};
	if (record.error) throw new Error(`${FAILED_CALL} underveis.`);
	const content = record.choices?.[0]?.delta?.content;
	if (typeof content === 'string') append(content);
	return false;
}

function takeAnthropicDelta(data: string, append: (chunk: string) => void): boolean {
	let payload: unknown;
	try {
		payload = JSON.parse(data);
	} catch {
		return false;
	}
	if (!payload || typeof payload !== 'object') return false;
	const record = payload as {
		type?: string;
		delta?: { text?: unknown };
	};
	if (record.type === 'error') throw new Error(`${FAILED_CALL} underveis.`);
	if (record.type === 'content_block_delta' && typeof record.delta?.text === 'string') {
		append(record.delta.text);
	}
	return false;
}

async function streamOpenAI(
	history: ChatTurn[],
	options: StreamEmbedOptions,
	model: string
): Promise<string> {
	const base = LLM_BASE_URL || 'https://api.openai.com/v1';
	const response = await postJson(
		`${base}/chat/completions`,
		{
			authorization: `Bearer ${LLM_API_KEY}`,
			'content-type': 'application/json'
		},
		{
			model,
			stream: true,
			temperature: 0.4,
			max_tokens: 8192,
			messages: [
				{ role: 'system', content: systemPrompt(options.currentHtml) },
				...history,
				{ role: 'user', content: options.userMessage }
			]
		},
		options.signal
	);
	let full = '';
	await forEachSseData(response, (data) =>
		takeOpenAIDelta(data, (chunk) => {
			if (!chunk) return;
			full += chunk;
			options.onDelta(chunk);
		})
	);
	return full;
}

async function streamAnthropic(
	history: ChatTurn[],
	options: StreamEmbedOptions,
	model: string
): Promise<string> {
	const response = await postJson(
		'https://api.anthropic.com/v1/messages',
		{
			'x-api-key': LLM_API_KEY,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json'
		},
		{
			model,
			max_tokens: 8192,
			temperature: 0.4,
			stream: true,
			system: systemPrompt(options.currentHtml),
			messages: anthropicMessages(history, options.userMessage)
		},
		options.signal
	);
	let full = '';
	await forEachSseData(response, (data) =>
		takeAnthropicDelta(data, (chunk) => {
			if (!chunk) return;
			full += chunk;
			options.onDelta(chunk);
		})
	);
	return full;
}

export async function streamEmbedReply(options: StreamEmbedOptions): Promise<string> {
	if (!LLM_API_KEY.trim()) throw new Error(MISSING_KEY);
	const history = modelHistory(options.history);
	const model = providerModel(LLM_PROVIDER, LLM_MODEL);
	if (LLM_PROVIDER === 'anthropic') return streamAnthropic(history, options, model);
	return streamOpenAI(history, options, model);
}
