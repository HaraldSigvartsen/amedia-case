import { error } from '@sveltejs/kit';
import { prepareEmbedDocument, VIEWER_CSP } from '#lib/embed-document.ts';
import { getEmbedForView } from '#lib/server/embeds.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, locals }) => {
	const embed = getEmbedForView(params.id, locals.journalist);
	if (!embed) error(404, 'Fant ikke embeden.');

	return new Response(prepareEmbedDocument(embed.html, embed.id), {
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'content-security-policy': VIEWER_CSP,
			'cache-control': 'no-store',
			'referrer-policy': 'no-referrer',
			'x-content-type-options': 'nosniff'
		}
	});
};
