import { createEmbed, listEmbeds } from '#lib/server/embeds.ts';
import type { RequestHandler } from './$types';

function unauthorized(): Response {
	return Response.json({ message: 'Skriv inn navnet ditt først.' }, { status: 401 });
}

export const GET: RequestHandler = ({ locals }) => {
	if (locals.journalist === null) return unauthorized();
	return Response.json({ embeds: listEmbeds(locals.journalist) });
};

export const POST: RequestHandler = ({ locals }) => {
	if (locals.journalist === null) return unauthorized();
	return Response.json(createEmbed(locals.journalist), { status: 201 });
};
