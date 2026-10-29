import { describe, expect, it } from 'vitest';
import { extractHtml, visibleAssistantText } from '#lib/html.ts';

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
