import { describe, expect, it } from 'vitest';
import { anthropicRequestBody, failedModelCall } from '#lib/server/llm.ts';

describe('anthropicRequestBody', () => {
	it('omits temperature because claude-sonnet-5 rejects it', () => {
		const body = anthropicRequestBody('claude-sonnet-5', 'system', []);
		expect(body).not.toHaveProperty('temperature');
		expect(body.model).toBe('claude-sonnet-5');
		expect(body.stream).toBe(true);
	});
});

describe('failedModelCall', () => {
	it('keeps the provider message so a 400 is readable', () => {
		const text = failedModelCall(
			400,
			JSON.stringify({
				type: 'error',
				error: { type: 'invalid_request_error', message: '`temperature` is deprecated for this model.' }
			})
		);
		expect(text).toBe(
			'Kall til språkmodellen feilet (400): `temperature` is deprecated for this model.'
		);
	});

	it('stays short when the body is not JSON', () => {
		expect(failedModelCall(500, 'nope')).toBe('Kall til språkmodellen feilet (500).');
	});
});
