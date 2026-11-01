import { describe, expect, it } from 'vitest';
import {
	anthropicUserContent,
	attachmentFromBytes,
	bytesToBase64,
	modelUserText,
	readAttachments,
	storedUserText
} from '#lib/attachments.ts';

const png = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
	),
	(char) => char.charCodeAt(0)
);

describe('attachments', () => {
	it('reads a png and a csv', () => {
		const image = attachmentFromBytes('diagram.png', 'image/png', png);
		const table = attachmentFromBytes(
			'tall.csv',
			'text/csv',
			new TextEncoder().encode('navn,tall\nOslo,3')
		);
		expect(image).toMatchObject({ kind: 'image', name: 'diagram.png', mediaType: 'image/png' });
		expect(table).toEqual({
			kind: 'text',
			name: 'tall.csv',
			mediaType: 'text/csv',
			text: 'navn,tall\nOslo,3'
		});
		if (typeof image === 'string' || typeof table === 'string') return;
		expect(readAttachments([image, table]).ok).toBe(true);
		expect(storedUserText('Lag en tabell', [image, table])).toBe(
			'Lag en tabell\n\nVedlagt: diagram.png, tall.csv'
		);
		expect(modelUserText('', [table])).toContain('Oslo,3');
		expect(anthropicUserContent('Se', [image])).toMatchObject([
			{ type: 'image', source: { media_type: 'image/png' } },
			{ type: 'text' }
		]);
	});

	it('rejects a fourth file, an unknown type, and an oversized image', () => {
		const image = attachmentFromBytes('a.png', '', png);
		expect(typeof image).not.toBe('string');
		if (typeof image === 'string') return;
		expect(readAttachments([image, image, image, image])).toMatchObject({
			ok: false,
			message: 'Maks tre filer.'
		});
		expect(attachmentFromBytes('lyd.mp3', 'audio/mpeg', png)).toBe(
			'Bruk et bilde (JPEG, PNG, GIF eller WebP) eller en tekstfil (txt, csv eller md).'
		);
		const huge = bytesToBase64(new Uint8Array(1_500_001));
		expect(
			readAttachments([{ kind: 'image', name: 'stor.png', mediaType: 'image/png', data: huge }])
		).toMatchObject({
			ok: false,
			message: 'Bildet er for stort. Maks 1,5 MB.'
		});
	});

	it('keeps a plain message unchanged', () => {
		expect(storedUserText('  Hei  ', [])).toBe('Hei');
		expect(readAttachments(undefined)).toEqual({ ok: true, attachments: [] });
		expect(anthropicUserContent('Hei', [])).toBe('Hei');
	});
});
