import { describe, expect, it } from 'vitest';
import { anthropicMisroute, providerModel, systemPrompt } from '#lib/server/prompt.ts';

describe('providerModel', () => {
	it('uses the provider default when the model is empty', () => {
		expect(providerModel('openai', '  ')).toBe('gpt-4.1-mini');
		expect(providerModel('anthropic', '')).toBe('claude-sonnet-5');
	});

	it('keeps a configured model id', () => {
		expect(providerModel('anthropic', ' claude-haiku-5-5 ')).toBe('claude-haiku-5-5');
	});
});

describe('systemPrompt', () => {
	it('forbids an invented cause and a fix without new html', () => {
		const prompt = systemPrompt('<!DOCTYPE html><html></html>');
		expect(prompt).toContain('Ikke finn på en feil, en årsak eller en fiks.');
		expect(prompt).toContain('Ikke si at noe er fikset uten å levere ny HTML.');
		expect(prompt).toContain('localStorage og sessionStorage kaster feil i sandkassen.');
		expect(prompt).toContain('<button type="button">');
		expect(prompt).toContain('Et vedlegg gjelder bare denne meldingen.');
	});
});

describe('anthropicMisroute', () => {
	it('explains an Anthropic key sent down the OpenAI path', () => {
		expect(anthropicMisroute('openai', 'sk-ant-example', 'https://api.anthropic.com')).toContain(
			'LLM_PROVIDER=anthropic'
		);
	});

	it('stays quiet for a matching Anthropic setup and for OpenAI', () => {
		expect(anthropicMisroute('anthropic', 'sk-ant-example', '')).toBeNull();
		expect(anthropicMisroute('openai', 'sk-example', '')).toBeNull();
	});
});
