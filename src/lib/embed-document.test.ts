import { describe, expect, it } from 'vitest';
import { embedSnippet, prepareEmbedDocument, readEmbedHeightMessage } from '#lib/embed-document.ts';

const fragment =
	'<p>Hei</p><base href="https://evil.test"><meta http-equiv="refresh" content="0;url=https://evil.test"><meta http-equiv="Content-Security-Policy" content="default-src *">';

describe('prepareEmbedDocument', () => {
	it('wraps a fragment and injects the viewer policy', () => {
		const html = prepareEmbedDocument(fragment, 'embed-1');
		expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
		expect(html).toContain('Content-Security-Policy');
		expect(html).toContain("connect-src 'none'");
		expect(html).toContain('amedia-embed');
		expect(html).not.toContain('<base');
		expect(html).not.toContain('http-equiv="refresh"');
		expect(html).not.toContain('default-src *');
		expect(html).not.toContain('allow-same-origin');
		expect(html).toContain('getBoundingClientRect');
		expect(html).not.toContain('scrollHeight');
	});

	it('returns an empty string for blank input', () => {
		expect(prepareEmbedDocument('   ', 'embed-1')).toBe('');
	});
});

describe('readEmbedHeightMessage', () => {
	it('accepts a finite height for the right embed', () => {
		expect(
			readEmbedHeightMessage({ source: 'amedia-embed', id: 'embed-1', height: 10.2 }, 'embed-1')
		).toBe(11);
	});

	it('rejects the wrong sender, id, and range', () => {
		expect(readEmbedHeightMessage({ source: 'other', id: 'embed-1', height: 10 }, 'embed-1')).toBe(
			null
		);
		expect(
			readEmbedHeightMessage({ source: 'amedia-embed', id: 'other', height: 10 }, 'embed-1')
		).toBe(null);
		expect(
			readEmbedHeightMessage({ source: 'amedia-embed', id: 'embed-1', height: '10' }, 'embed-1')
		).toBe(null);
		expect(
			readEmbedHeightMessage({ source: 'amedia-embed', id: 'embed-1', height: 9000 }, 'embed-1')
		).toBe(null);
		expect(
			readEmbedHeightMessage({ source: 'amedia-embed', id: 'embed-1', height: -1 }, 'embed-1')
		).toBe(null);
	});
});

describe('embedSnippet', () => {
	it('sandboxes scripts only and points at the viewer', () => {
		const snippet = embedSnippet('http://localhost:3000/', 'abc-1', 'Valg <2025>');
		expect(snippet).toContain('sandbox="allow-scripts"');
		expect(snippet).toContain('http://localhost:3000/view/abc-1');
		expect(snippet).toContain('Valg &lt;2025&gt;');
		expect(snippet).not.toContain('allow-same-origin');
		expect(snippet).not.toContain('allow-top-navigation');
	});
});
