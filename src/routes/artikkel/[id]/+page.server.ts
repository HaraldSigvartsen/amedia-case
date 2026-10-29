import { error } from '@sveltejs/kit';
import { getEmbedForView } from '#lib/server/embeds.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const embed = getEmbedForView(params.id, null);
	if (!embed) error(404, 'Denne embeden er ikke publisert.');
	return { embed };
};
