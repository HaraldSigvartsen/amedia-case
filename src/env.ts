import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	LLM_PROVIDER: {
		description: 'openai or anthropic',
		schema: (value) => {
			const provider = (value ?? 'openai').trim().toLowerCase();
			if (provider !== 'openai' && provider !== 'anthropic') {
				throw new Error('LLM_PROVIDER must be openai or anthropic');
			}
			return provider;
		}
	},
	LLM_API_KEY: {
		description: 'API key for the selected LLM provider. Empty disables chat.',
		schema: (value) => value?.trim() ?? ''
	},
	LLM_MODEL: {
		description: 'Model id. Empty uses the provider default.',
		schema: (value) => value?.trim() ?? ''
	},
	LLM_BASE_URL: {
		description: 'Optional OpenAI-compatible base URL, without a trailing path.',
		schema: (value) => value?.trim().replace(/\/$/, '') ?? ''
	},
	DATABASE_PATH: {
		description: 'SQLite file path.',
		schema: (value) => value?.trim() || 'data/embeds.db'
	}
});
