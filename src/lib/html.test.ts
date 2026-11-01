import { describe, expect, it } from 'vitest';
import {
	UNCHANGED_EMBED_NOTE,
	extractHtml,
	groundedAssistantNote,
	visibleAssistantText,
	workTrace
} from '#lib/html.ts';

const document = '<!DOCTYPE html><html><body><p>Hei</p></body></html>';

describe('extractHtml', () => {
	it('reads a Norwegian sentence plus an html fence', () => {
		const text = `Her er en enkel oversikt over saken.\n\n\`\`\`html\n${document}\n\`\`\``;
		expect(extractHtml(text)).toBe(document);
	});

	it('reads a bare doctype document', () => {
		const bare = '<!DOCTYPE html><html><body><p>Uten gjerde</p></body></html>';
		expect(extractHtml(bare)).toBe(bare);
	});

	it('returns null for an incomplete stream', () => {
		expect(extractHtml('```html\n<!DOCTYPE html><html><body>venter')).toBeNull();
		expect(extractHtml('<!DOCTYPE html><html><body>ikke ferdig')).toBeNull();
	});

	it('reads the last plain fence that contains a document', () => {
		const plain = '<!DOCTYPE html><html><body>Uten språk</body></html>';
		expect(extractHtml(`Tekst\n\n\`\`\`\n${plain}\n\`\`\``)).toBe(plain);
	});

	it('prefers the html fence when a loose document also exists', () => {
		const fenced = '<!DOCTYPE html><html><body>Gjerde</body></html>';
		const loose = '<!DOCTYPE html><html><body>Løs</body></html>';
		const text = `Tekst\n\n\`\`\`html\n${fenced}\n\`\`\`\n${loose}`;
		expect(extractHtml(text)).toBe(fenced);
	});
});

describe('visibleAssistantText', () => {
	it('hides the document', () => {
		const text = `Kort forklaring til journalisten.\n\n\`\`\`html\n${document}\n\`\`\``;
		expect(visibleAssistantText(text)).toBe('Kort forklaring til journalisten.');
		expect(visibleAssistantText(document)).toBe('');
	});
});

describe('groundedAssistantNote', () => {
	const previous = '<!DOCTYPE html><html><body><button type="button">Start</button></body></html>';
	const lie =
		'Beklager! Jeg har fikset det. Nå skal du kunne klikke "Start Spill"-knappen for å begynne. Problemet var at knappen var deaktivert ved oppstart.';

	it('replaces a fix claim when no new document arrived', () => {
		expect(groundedAssistantNote(lie, previous, null)).toBe(UNCHANGED_EMBED_NOTE);
		expect(groundedAssistantNote(lie, previous, previous)).toBe(UNCHANGED_EMBED_NOTE);
	});

	it('keeps a fix claim when the document changed', () => {
		const next = previous.replace('Start', 'Spill');
		expect(groundedAssistantNote(lie, previous, next)).toBe(lie);
	});

	it('keeps a note that does not claim a fix', () => {
		expect(groundedAssistantNote('Hvilken knapp mener du?', previous, null)).toBe(
			'Hvilken knapp mener du?'
		);
		expect(groundedAssistantNote('  ', previous, null)).toBe('');
	});
});

describe('workTrace', () => {
	it('waits on the file before any tokens arrive', () => {
		const trace = workTrace('');
		expect(trace.phase).toBe('thinking');
		expect(trace.label).toBe('Leser beskjeden');
		expect(trace.status).toBe('venter');
		expect(trace.fileName).toBe('embed.html');
		expect(trace.tail).toEqual([]);
	});

	it('follows the document as it is written', () => {
		const partial =
			'En svart rute.\n\n```html\n<!DOCTYPE html>\n<html>\n<style>\nbody{}\n</style>\n';
		const trace = workTrace(partial);
		expect(trace.phase).toBe('writing');
		expect(trace.note).toBe('En svart rute.');
		expect(trace.status).toBe('skriver');
		expect(trace.steps.map((step) => step.id)).toEqual(['read', 'note', 'open', 'style']);
		expect(trace.label).toBe('Skriver stil');
		expect(trace.tail.some((line) => line.includes('<style>'))).toBe(true);
	});

	it('closes the file when the document is complete', () => {
		const text = `Ferdig.\n\n\`\`\`html\n${document}\n\`\`\``;
		const trace = workTrace(text);
		expect(trace.status).toBe('ferdig');
		expect(trace.label).toBe('Lukket embed.html');
		expect(trace.lineCount).toBe(1);
	});
});
