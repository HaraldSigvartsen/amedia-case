import { deleteEmbed, getEmbedForOwner, updateEmbed } from '#lib/server/embeds.ts';
import type { RequestHandler } from './$types';

function unauthorized(): Response {
	return Response.json({ message: 'Skriv inn navnet ditt først.' }, { status: 401 });
}

function invalid(): Response {
	return Response.json({ message: 'Ugyldig endring.' }, { status: 400 });
}

function notFound(): Response {
	return Response.json({ message: 'Fant ikke embeden.' }, { status: 404 });
}

function parsePatch(body: unknown): { title?: string; html?: string; published?: boolean } | null {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
	const record = body as Record<string, unknown>;
	const patch: { title?: string; html?: string; published?: boolean } = {};

	if ('title' in record) {
		if (typeof record.title !== 'string') return null;
		const title = record.title.trim();
		if (title.length < 1 || title.length > 80) return null;
		patch.title = title;
	}
	if ('html' in record) {
		if (typeof record.html !== 'string' || record.html.length > 200_000) return null;
		patch.html = record.html;
	}
	if ('published' in record) {
		if (typeof record.published !== 'boolean') return null;
		patch.published = record.published;
	}
	return patch;
}

export const GET: RequestHandler = ({ locals, params }) => {
	if (locals.journalist === null) return unauthorized();
	const embed = getEmbedForOwner(locals.journalist, params.id);
	if (!embed) return notFound();
	return Response.json(embed);
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (locals.journalist === null) return unauthorized();
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return invalid();
	}
	const patch = parsePatch(body);
	if (!patch) return invalid();
	const embed = updateEmbed(locals.journalist, params.id, patch);
	if (!embed) return notFound();
	return Response.json(embed);
};

export const DELETE: RequestHandler = ({ locals, params }) => {
	if (locals.journalist === null) return unauthorized();
	deleteEmbed(locals.journalist, params.id);
	return new Response(null, { status: 204 });
};
