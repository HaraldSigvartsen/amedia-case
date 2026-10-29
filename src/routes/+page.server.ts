import { fail, redirect } from '@sveltejs/kit';
import { getEmbedForOwner, listEmbeds } from '#lib/server/embeds.ts';
import {
	JOURNALIST_COOKIE,
	journalistCookieOptions,
	normalizeJournalistName
} from '#lib/server/session.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.journalist === null) {
		return { journalist: null, embeds: [], embed: null, missing: false };
	}

	const embeds = listEmbeds(locals.journalist);
	const id = url.searchParams.get('id');
	if (!id && embeds.length > 0) {
		redirect(302, `/?id=${embeds[0].id}`);
	}

	const embed = id ? getEmbedForOwner(locals.journalist, id) : null;
	return { journalist: locals.journalist, embeds, embed, missing: Boolean(id && !embed) };
};

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const form = await request.formData();
		const raw = form.get('name');
		const name = normalizeJournalistName(typeof raw === 'string' ? raw : '');
		if (!name) {
			return fail(400, { message: 'Bruk et navn på 1–40 tegn, uten symboler.' });
		}
		cookies.set(JOURNALIST_COOKIE, name, journalistCookieOptions());
		return { ok: true };
	},
	logout: ({ cookies }) => {
		cookies.delete(JOURNALIST_COOKIE, { path: '/' });
		return { ok: true };
	}
};
