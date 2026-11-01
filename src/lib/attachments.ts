export const MAX_ATTACHMENTS = 3;
export const MAX_IMAGE_BYTES = 1_500_000;
export const MAX_TEXT_CHARS = 20_000;

const TOO_MANY = 'Maks tre filer.';
const BAD_KIND = 'Bruk et bilde (JPEG, PNG, GIF eller WebP) eller en tekstfil (txt, csv eller md).';
const IMAGE_SIZE = 'Bildet er for stort. Maks 1,5 MB.';
const TEXT_SIZE = 'Tekstfilen er for lang.';
const EMPTY_FILE = 'Filen er tom.';
const BAD_FILE = 'Filen kunne ikke leses.';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
const TEXT_TYPES = ['text/plain', 'text/csv', 'text/markdown'] as const;

type ImageType = (typeof IMAGE_TYPES)[number];
type TextType = (typeof TEXT_TYPES)[number];

export type ChatAttachment =
	| { kind: 'image'; name: string; mediaType: ImageType; data: string }
	| { kind: 'text'; name: string; mediaType: TextType; text: string };

type ReadResult = { ok: true; attachments: ChatAttachment[] } | { ok: false; message: string };

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	const size = 0x8000;
	for (let index = 0; index < bytes.length; index += size) {
		binary += String.fromCharCode(...bytes.subarray(index, index + size));
	}
	return btoa(binary);
}

export function displayName(name: string): string {
	const base = name.split(/[/\\]/).pop() ?? '';
	const clean = base.replace(/[^\p{L}\p{N}._ -]+/gu, '').trim();
	return [...(clean || 'fil')].slice(0, 80).join('');
}

function extensionKind(
	name: string
): { kind: 'image'; mediaType: ImageType } | { kind: 'text'; mediaType: TextType } | null {
	const lower = name.toLowerCase();
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg'))
		return { kind: 'image', mediaType: 'image/jpeg' };
	if (lower.endsWith('.png')) return { kind: 'image', mediaType: 'image/png' };
	if (lower.endsWith('.gif')) return { kind: 'image', mediaType: 'image/gif' };
	if (lower.endsWith('.webp')) return { kind: 'image', mediaType: 'image/webp' };
	if (lower.endsWith('.csv')) return { kind: 'text', mediaType: 'text/csv' };
	if (lower.endsWith('.md')) return { kind: 'text', mediaType: 'text/markdown' };
	if (lower.endsWith('.txt')) return { kind: 'text', mediaType: 'text/plain' };
	return null;
}

function mimeKind(
	type: string
): { kind: 'image'; mediaType: ImageType } | { kind: 'text'; mediaType: TextType } | null {
	const mime = type.toLowerCase();
	if (mime === 'image/jpg' || mime === 'image/jpeg')
		return { kind: 'image', mediaType: 'image/jpeg' };
	if (mime === 'image/png' || mime === 'image/gif' || mime === 'image/webp') {
		return { kind: 'image', mediaType: mime };
	}
	if (mime === 'text/plain' || mime === 'text/csv' || mime === 'text/markdown') {
		return { kind: 'text', mediaType: mime };
	}
	return null;
}

function base64Bytes(data: string): number | null {
	if (data.length === 0 || data.length % 4 !== 0) return null;
	if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
	const pad = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
	return (data.length / 4) * 3 - pad;
}

function readOne(value: unknown): ChatAttachment | string {
	if (!value || typeof value !== 'object') return BAD_FILE;
	const record = value as {
		kind?: unknown;
		name?: unknown;
		mediaType?: unknown;
		data?: unknown;
		text?: unknown;
	};
	const name = typeof record.name === 'string' ? displayName(record.name) : 'fil';
	if (record.kind === 'image') {
		if (
			typeof record.mediaType !== 'string' ||
			!IMAGE_TYPES.includes(record.mediaType as ImageType)
		) {
			return BAD_KIND;
		}
		if (typeof record.data !== 'string') return BAD_FILE;
		const data = record.data.replace(/\s/g, '');
		const bytes = base64Bytes(data);
		if (bytes === null) return BAD_FILE;
		if (bytes > MAX_IMAGE_BYTES) return IMAGE_SIZE;
		if (bytes < 1) return EMPTY_FILE;
		return { kind: 'image', name, mediaType: record.mediaType as ImageType, data };
	}
	if (record.kind === 'text') {
		if (
			typeof record.mediaType !== 'string' ||
			!TEXT_TYPES.includes(record.mediaType as TextType)
		) {
			return BAD_KIND;
		}
		if (typeof record.text !== 'string' || record.text.includes('\0')) return BAD_FILE;
		const text = record.text.trim();
		if (!text) return EMPTY_FILE;
		if ([...text].length > MAX_TEXT_CHARS) return TEXT_SIZE;
		return { kind: 'text', name, mediaType: record.mediaType as TextType, text };
	}
	return BAD_KIND;
}

export function readAttachments(value: unknown): ReadResult {
	if (value == null) return { ok: true, attachments: [] };
	if (!Array.isArray(value)) return { ok: false, message: BAD_FILE };
	if (value.length > MAX_ATTACHMENTS) return { ok: false, message: TOO_MANY };
	const attachments: ChatAttachment[] = [];
	for (const item of value) {
		const read = readOne(item);
		if (typeof read === 'string') return { ok: false, message: read };
		attachments.push(read);
	}
	return { ok: true, attachments };
}

export function attachmentFromBytes(
	name: string,
	type: string,
	bytes: Uint8Array
): ChatAttachment | string {
	const kind = extensionKind(name) ?? mimeKind(type);
	if (!kind) return BAD_KIND;
	if (bytes.byteLength < 1) return EMPTY_FILE;
	const safeName = displayName(name);
	if (kind.kind === 'image') {
		if (bytes.byteLength > MAX_IMAGE_BYTES) return IMAGE_SIZE;
		return { kind: 'image', name: safeName, mediaType: kind.mediaType, data: bytesToBase64(bytes) };
	}
	const text = new TextDecoder().decode(bytes).trim();
	if (!text) return EMPTY_FILE;
	if ([...text].length > MAX_TEXT_CHARS) return TEXT_SIZE;
	return { kind: 'text', name: safeName, mediaType: kind.mediaType, text };
}

export function storedUserText(message: string, attachments: ChatAttachment[]): string {
	const text = message.trim();
	if (attachments.length === 0) return text;
	const line = `Vedlagt: ${attachments.map((file) => file.name).join(', ')}`;
	return text ? `${text}\n\n${line}` : line;
}

export function modelUserText(message: string, attachments: ChatAttachment[]): string {
	const parts = [message.trim()];
	for (const file of attachments) {
		if (file.kind === 'text') parts.push(`Innhold i ${file.name}:\n${file.text}`);
		else parts.push(`Bildet ${file.name} følger med denne meldingen.`);
	}
	return parts.filter(Boolean).join('\n\n') || 'Se vedlegget.';
}

export function anthropicUserContent(message: string, attachments: ChatAttachment[]) {
	const text = modelUserText(message, attachments);
	const images = attachments.filter((file) => file.kind === 'image');
	if (images.length === 0) return text;
	return [
		...images.map((file) => ({
			type: 'image' as const,
			source: { type: 'base64' as const, media_type: file.mediaType, data: file.data }
		})),
		{ type: 'text' as const, text }
	];
}

export function openaiUserContent(message: string, attachments: ChatAttachment[]) {
	const text = modelUserText(message, attachments);
	const images = attachments.filter((file) => file.kind === 'image');
	if (images.length === 0) return text;
	return [
		{ type: 'text' as const, text },
		...images.map((file) => ({
			type: 'image_url' as const,
			image_url: { url: `data:${file.mediaType};base64,${file.data}` }
		}))
	];
}
