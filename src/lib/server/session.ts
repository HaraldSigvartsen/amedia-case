export const JOURNALIST_COOKIE = 'journalist';

export function normalizeJournalistName(input: string): string | null {
	const name = input.trim().replace(/\s+/g, ' ');
	if (name.length < 1 || name.length > 40) return null;
	if (!/^[\p{L}\p{N} ._-]+$/u.test(name)) return null;
	return name;
}

export function journalistCookieOptions() {
	return {
		path: '/',
		httpOnly: true as const,
		sameSite: 'lax' as const,
		maxAge: 60 * 60 * 24 * 400
	};
}
