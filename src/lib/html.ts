type Fence = {
	lang: string;
	body: string;
};

const HTML_FENCE_LANG = /^html\b/i;
const DOCUMENT_START = /<!doctype\b|<html\b/i;
const DOCTYPE_DOCUMENT = /<!doctype\s+html\b[\s\S]*?<\/html\s*>/i;
const HTML_DOCUMENT = /<html\b[\s\S]*?<\/html\s*>/i;
const FENCE_OPEN = /(?:^|\n)```([^`\r\n]*)[ \t]*\r?\n/g;

function parseFences(text: string): Fence[] {
	const fences: Fence[] = [];
	const opener = new RegExp(FENCE_OPEN.source, 'g');
	let match: RegExpExecArray | null;

	while ((match = opener.exec(text))) {
		const lang = match[1].trim();
		const bodyStart = match.index + match[0].length;
		const rest = text.slice(bodyStart);
		const close = /^(?:```[ \t]*(?:\r?\n|$))|\r?\n```[ \t]*(?:\r?\n|$)/.exec(rest);
		const body = close ? rest.slice(0, close.index) : rest;
		fences.push({ lang, body });
		if (!close) break;
		opener.lastIndex = bodyStart + close.index + close[0].length;
	}

	return fences;
}

function extractDocument(source: string): string | null {
	const doctype = DOCTYPE_DOCUMENT.exec(source);
	if (doctype) return doctype[0].trim();
	const html = HTML_DOCUMENT.exec(source);
	if (html) return html[0].trim();
	return null;
}

export function extractHtml(text: string): string | null {
	const fences = parseFences(text);
	const htmlFence = [...fences].reverse().find((fence) => HTML_FENCE_LANG.test(fence.lang));
	if (htmlFence && DOCUMENT_START.test(htmlFence.body)) {
		return extractDocument(htmlFence.body);
	}

	const plainFence = [...fences]
		.reverse()
		.find((fence) => fence.lang === '' && DOCUMENT_START.test(fence.body));
	if (plainFence) return extractDocument(plainFence.body);

	return extractDocument(text);
}

export function visibleAssistantText(text: string): string {
	const cut = /```|<!doctype|<html/i.exec(text);
	if (!cut) return text.trim();
	return text.slice(0, cut.index).trim();
}

export const UNCHANGED_EMBED_NOTE = 'Ingen ny embed ble levert, så ingenting er endret.';

const UNGROUNDED_FIX =
	/fikset|deaktivert|\bdisabled\b|nå skal du|rettet|feilen var|problemet var|har endret|er oppdatert/i;

export function groundedAssistantNote(
	commentary: string,
	previousHtml: string,
	nextHtml: string | null
): string {
	const note = commentary.trim();
	const changed = Boolean(nextHtml && nextHtml.trim() !== previousHtml.trim());
	if (!note || changed || !UNGROUNDED_FIX.test(note)) return note;
	return UNCHANGED_EMBED_NOTE;
}

export type WorkStep = {
	id: string;
	label: string;
};

export type WorkTrace = {
	phase: 'thinking' | 'writing';
	label: string;
	note: string;
	fileName: string;
	status: 'venter' | 'skriver' | 'ferdig';
	lineCount: number;
	tail: string[];
	steps: WorkStep[];
};

const FILE_NAME = 'embed.html';
const TAIL_LINES = 40;

function openDocumentSource(text: string): string {
	const fences = parseFences(text);
	const htmlFence = [...fences].reverse().find((fence) => HTML_FENCE_LANG.test(fence.lang));
	if (htmlFence) return htmlFence.body.replace(/^\r?\n/, '');
	const plainFence = [...fences]
		.reverse()
		.find((fence) => fence.lang === '' && DOCUMENT_START.test(fence.body));
	if (plainFence) return plainFence.body.replace(/^\r?\n/, '');
	const cut = DOCUMENT_START.exec(text);
	if (!cut) return '';
	return text.slice(cut.index);
}

export function workTrace(text: string): WorkTrace {
	const note = visibleAssistantText(text);
	const source = openDocumentSource(text);
	const opened = source.length > 0 || /```html\b/i.test(text);
	const ready = opened && extractHtml(text) !== null;
	const steps: WorkStep[] = [
		{ id: 'read', label: text.trim() ? 'Leste beskjeden' : 'Leser beskjeden' }
	];
	if (note) steps.push({ id: 'note', label: 'Skriver et notat' });
	if (opened) steps.push({ id: 'open', label: 'Åpnet embed.html' });
	if (/<style\b/i.test(source)) steps.push({ id: 'style', label: 'Skriver stil' });
	if (/<body\b/i.test(source)) steps.push({ id: 'body', label: 'Skriver innhold' });
	if (/<script\b/i.test(source)) steps.push({ id: 'script', label: 'Skriver script' });
	if (ready) steps.push({ id: 'close', label: 'Lukket embed.html' });

	const raw = source.replace(/\s+$/, '');
	const lines = raw.length === 0 ? [] : raw.split(/\r?\n/);
	const tail = lines.slice(-TAIL_LINES);
	const current = steps.at(-1)?.label ?? 'Tenker';

	return {
		phase: text.trim() ? 'writing' : 'thinking',
		label: current,
		note,
		fileName: FILE_NAME,
		status: ready ? 'ferdig' : opened ? 'skriver' : 'venter',
		lineCount: lines.length,
		tail,
		steps
	};
}
