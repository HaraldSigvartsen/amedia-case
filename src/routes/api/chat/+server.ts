import { addMessage, getEmbedForOwner, updateEmbed } from '#lib/server/embeds.ts';
import { extractHtml, visibleAssistantText } from '#lib/html.ts';
import { streamEmbedReply } from '#lib/server/llm.ts';
import { DEFAULT_EMBED_TITLE, type ChatDonePayload } from '#lib/types.ts';
import type { RequestHandler } from '@sveltejs/kit';

const encoder = new TextEncoder();

function sseEvent(name: string, data: unknown): Uint8Array {
	return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

function titleFromMessage(message: string): string {
	const line = message.split(/\r?\n/, 1)[0] ?? '';
	return [...line.replace(/\s+/g, ' ').trim()].slice(0, 60).join('').trim();
}

function isAbort(error: unknown, signal: AbortSignal): boolean {
	if (signal.aborted) return true;
	return error instanceof Error && error.name === 'AbortError';
}

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.journalist) {
		return Response.json({ message: 'Skriv inn navnet ditt først.' }, { status: 401 });
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return Response.json({ message: 'Skriv en melding på maks 4000 tegn.' }, { status: 400 });
	}

	const record =
		payload && typeof payload === 'object'
			? (payload as { embedId?: unknown; message?: unknown })
			: {};
	const message = typeof record.message === 'string' ? record.message.trim() : '';
	if (message.length < 1 || message.length > 4000) {
		return Response.json({ message: 'Skriv en melding på maks 4000 tegn.' }, { status: 400 });
	}
	if (typeof record.embedId !== 'string' || !record.embedId) {
		return Response.json({ message: 'Fant ikke embeden.' }, { status: 404 });
	}

	const owner = locals.journalist;
	const embed = getEmbedForOwner(owner, record.embedId);
	if (!embed) {
		return Response.json({ message: 'Fant ikke embeden.' }, { status: 404 });
	}

	const firstUserMessage = !embed.messages.some((item) => item.role === 'user');
	addMessage(embed.id, 'user', message);
	let title = embed.title;
	if (embed.title === DEFAULT_EMBED_TITLE && firstUserMessage) {
		const nextTitle = titleFromMessage(message);
		if (nextTitle) {
			title = nextTitle;
			updateEmbed(owner, embed.id, { title });
		}
	}

	const history = embed.messages.map((item) => ({ role: item.role, content: item.content }));
	const previousHtml = embed.html;

	const stream = new ReadableStream({
		async start(controller) {
			let closed = false;
			const send = (name: string, data: unknown) => {
				if (closed || request.signal.aborted) return;
				try {
					controller.enqueue(sseEvent(name, data));
				} catch {
					closed = true;
				}
			};

			try {
				let streamed = '';
				let emittedHtml: string | null = null;
				const assistantText = await streamEmbedReply({
					history,
					currentHtml: previousHtml,
					userMessage: message,
					signal: request.signal,
					onDelta(chunk) {
						streamed += chunk;
						send('delta', { text: chunk });
						const html = extractHtml(streamed);
						if (html && html !== emittedHtml) {
							emittedHtml = html;
							send('html', { html });
						}
					}
				});

				const extracted = extractHtml(assistantText);
				if (extracted && extracted !== emittedHtml) send('html', { html: extracted });

				const commentary = visibleAssistantText(assistantText);
				addMessage(embed.id, 'assistant', assistantText);
				if (extracted) updateEmbed(owner, embed.id, { html: extracted });
				const fresh = getEmbedForOwner(owner, embed.id);
				const done: ChatDonePayload = {
					html: extracted ?? previousHtml,
					title: fresh?.title ?? title,
					commentary
				};
				send('done', done);
			} catch (error) {
				if (isAbort(error, request.signal)) return;
				const text = error instanceof Error ? error.message : 'Noe gikk galt med språkmodellen.';
				send('error', { message: text });
			} finally {
				closed = true;
				try {
					controller.close();
				} catch {
					// Klienten har allerede lukket strømmen.
				}
			}
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream; charset=utf-8',
			'cache-control': 'no-cache, no-transform',
			'x-accel-buffering': 'no'
		}
	});
};
