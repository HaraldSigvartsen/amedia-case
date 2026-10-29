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
