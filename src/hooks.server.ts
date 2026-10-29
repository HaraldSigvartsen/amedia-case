import { JOURNALIST_COOKIE } from '#lib/server/session.ts';
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.journalist = event.cookies.get(JOURNALIST_COOKIE) ?? null;
	return resolve(event);
};
