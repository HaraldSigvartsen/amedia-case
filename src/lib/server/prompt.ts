const DEFAULT_MODELS = {
	openai: 'gpt-4.1-mini',
	anthropic: 'claude-haiku-4-5'
} as const;

export function providerModel(provider: 'openai' | 'anthropic', configured: string): string {
	const model = configured.trim();
	if (model) return model;
	return DEFAULT_MODELS[provider];
}

export function anthropicMisroute(
	provider: string,
	apiKey: string,
	baseUrl: string
): string | null {
	if (provider === 'anthropic') return null;
	const anthropicKey = apiKey.trim().startsWith('sk-ant-');
	const anthropicHost = /(^|\/\/)api\.anthropic\.com\b/i.test(baseUrl.trim());
	if (!anthropicKey && !anthropicHost) return null;
	return 'Nøkkelen er en Anthropic-nøkkel. Sett LLM_PROVIDER=anthropic, la LLM_BASE_URL stå tom, og start på nytt.';
}

export function systemPrompt(currentHtml: string): string {
	const previous = currentHtml.trim()
		? [
				'Forrige embed står i blokken under. Endre denne embeden i stedet for å starte på nytt.',
				'----- FORRIGE EMBED START -----',
				currentHtml,
				'----- FORRIGE EMBED SLUTT -----'
			].join('\n')
		: 'Det finnes ingen forrige embed.';

	return [
		'Du lager frittstående embeds for en norsk nettavis.',
		'Skriv én eller to korte norske setninger, og deretter nøyaktig ett markdown-gjerde merket html.',
		'Setningene skal beskrive en endring som finnes i den nye HTML-en, sammenlignet med forrige embed.',
		'Ikke finn på en feil, en årsak eller en fiks. Hvis forrige embed ikke viser årsaken, skriv at årsaken ikke er synlig der.',
		'Når journalisten ber om en endring, skal svaret inneholde den oppdaterte embeden. Ikke si at noe er fikset uten å levere ny HTML.',
		'Inne i gjerdet: et komplett, frittstående dokument fra <!DOCTYPE html> til </html>.',
		'All CSS og all JavaScript skal være inline. Ikke bruk eksterne skript, stilark, fonter, rammeverk eller CDN-er.',
		'Embeden skal være responsiv fra 320px og opp. Den skal være lesbar, ha høy kontrast og et redaksjonelt uttrykk. Ingen lilla gradienter.',
		'Ikke bruk window.top, parent.location, document.cookie, localStorage, sessionStorage, fetch, XMLHttpRequest, WebSocket eller skjemaer.',
		'localStorage og sessionStorage kaster feil i sandkassen. Da stopper scriptet før en klikk-lytter blir satt, og knappen gjør ingenting.',
		'En knapp som skal kunne klikkes, skal være <button type="button"> med en click-lytter. Ikke sett disabled med mindre journalisten ber om det.',
		'Et vedlegg gjelder bare denne meldingen. Bruk innholdet i bildet eller tekstfilen. Ikke finn på en nettadresse til filen, og ikke lim inn bildedata i HTML-en.',
		'Ikke finn på statistikk. Hvis journalisten ikke har oppgitt tall, bruk en synlig plassholder som [tall].',
		'I senere runder skal du endre den forrige embeden i stedet for å starte på nytt.',
		previous
	].join('\n\n');
}
