import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getDb, useDatabase } from '#lib/server/db.ts';
import {
	addMessage,
	createEmbed,
	deleteEmbed,
	getEmbedForOwner,
	getEmbedForView,
	listEmbeds,
	updateEmbed
} from '#lib/server/embeds.ts';
import { DEFAULT_EMBED_TITLE } from '#lib/types.ts';

beforeEach(() => {
	const dir = mkdtempSync(join(tmpdir(), 'embeds-'));
	useDatabase(join(dir, 'embeds.db'));
});

afterEach(() => {
	const db = getDb();
	if (db.isOpen) db.close();
});

test('create and list are scoped to the owner', () => {
	const first = createEmbed('Kari');
	const second = createEmbed('Kari');
	const other = createEmbed('Ola');

	expect(first).toMatchObject({
		title: DEFAULT_EMBED_TITLE,
		html: '',
		published: false,
		messages: []
	});
	expect(first.createdAt).toBe(first.updatedAt);
	expect(first).not.toHaveProperty('owner');

	const kari = listEmbeds('Kari');
	expect(kari.map((embed) => embed.id).sort()).toEqual([first.id, second.id].sort());
	expect(
		kari.every((embed) => embed.title === DEFAULT_EMBED_TITLE && embed.published === false)
	).toBe(true);
	for (let index = 1; index < kari.length; index += 1) {
		expect(kari[index - 1].updatedAt >= kari[index].updatedAt).toBe(true);
	}
	expect(listEmbeds('Ola')).toEqual([
		{
			id: other.id,
			title: other.title,
			published: false,
			updatedAt: other.updatedAt
		}
	]);
	expect(listEmbeds('Nora')).toEqual([]);
});

test('another owner cannot get, update, or delete', () => {
	const embed = createEmbed('Kari');
	addMessage(embed.id, 'user', 'hei');

	expect(getEmbedForOwner('Ola', embed.id)).toBeNull();
	expect(
		updateEmbed('Ola', embed.id, { title: 'Stjålet', html: '<p>nei</p>', published: true })
	).toBeNull();
	expect(deleteEmbed('Ola', embed.id)).toBe(false);

	const owned = getEmbedForOwner('Kari', embed.id);
	expect(owned?.title).toBe(DEFAULT_EMBED_TITLE);
	expect(owned?.html).toBe('');
	expect(owned?.published).toBe(false);
	expect(owned?.messages.map((message) => message.content)).toEqual(['hei']);

	const updated = updateEmbed('Kari', embed.id, { title: 'Min tittel' });
	expect(updated?.title).toBe('Min tittel');
	expect(updated?.html).toBe('');
	expect(updated?.published).toBe(false);
	expect(updated?.messages).toHaveLength(1);
});

test('messages come back in order', () => {
	const embed = createEmbed('Kari');
	const first = addMessage(embed.id, 'user', 'første');
	const second = addMessage(embed.id, 'assistant', 'andre');

	const detail = getEmbedForOwner('Kari', embed.id);
	expect(detail?.messages).toEqual([first, second]);
	expect(detail?.messages.map((message) => message.id)).toEqual([first.id, second.id]);
	expect(first.id < second.id).toBe(true);
});

test('getEmbedForView hides drafts and shows published embeds', () => {
	const embed = createEmbed('Kari');
	expect(getEmbedForView(embed.id, null)).toBeNull();
	expect(getEmbedForView(embed.id, 'Ola')).toBeNull();
	expect(getEmbedForView(embed.id, 'Kari')).toEqual({
		id: embed.id,
		title: DEFAULT_EMBED_TITLE,
		html: ''
	});

	const published = updateEmbed('Kari', embed.id, { html: '<p>synlig</p>', published: true });
	expect(published?.published).toBe(true);
	const visible = { id: embed.id, title: DEFAULT_EMBED_TITLE, html: '<p>synlig</p>' };
	expect(getEmbedForView(embed.id, null)).toEqual(visible);
	expect(getEmbedForView(embed.id, 'Ola')).toEqual(visible);
	expect(getEmbedForView(embed.id, 'Kari')).toEqual(visible);
});

test('delete removes the embed', () => {
	const embed = createEmbed('Kari');
	addMessage(embed.id, 'user', 'hei');
	addMessage(embed.id, 'assistant', 'hallo');

	expect(deleteEmbed('Kari', embed.id)).toBe(true);
	expect(getEmbedForOwner('Kari', embed.id)).toBeNull();
	expect(getEmbedForView(embed.id, 'Kari')).toBeNull();
	expect(getEmbedForView(embed.id, null)).toBeNull();
	expect(listEmbeds('Kari')).toEqual([]);
	expect(getDb().prepare('SELECT COUNT(*) AS count FROM messages').get()).toEqual({ count: 0 });
	expect(deleteEmbed('Kari', embed.id)).toBe(false);
});
