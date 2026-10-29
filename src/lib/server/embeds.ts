import { getDb } from '#lib/server/db.ts';
import { DEFAULT_EMBED_TITLE } from '#lib/types.ts';
import type { ChatMessage, EmbedDetail, EmbedSummary, PublishedEmbed, Role } from '#lib/types.ts';
import type { SQLOutputValue } from 'node:sqlite';

type EmbedRow = {
	id: string;
	owner: string;
	title: string;
	html: string;
	published: number;
	created_at: string;
	updated_at: string;
};

function text(value: SQLOutputValue | undefined): string {
	return typeof value === 'string' ? value : String(value ?? '');
}

function embedFrom(row: Record<string, SQLOutputValue>): EmbedRow {
	return {
		id: text(row.id),
		owner: text(row.owner),
		title: text(row.title),
		html: text(row.html),
		published: Number(row.published),
		created_at: text(row.created_at),
		updated_at: text(row.updated_at)
	};
}

function toSummary(row: EmbedRow): EmbedSummary {
	return {
		id: row.id,
		title: row.title,
		published: row.published === 1,
		updatedAt: row.updated_at
	};
}

function toDetail(row: EmbedRow, messages: ChatMessage[]): EmbedDetail {
	return {
		...toSummary(row),
		html: row.html,
		createdAt: row.created_at,
		messages
	};
}

function isRole(value: string): value is Role {
	return value === 'user' || value === 'assistant';
}

function listMessages(embedId: string): ChatMessage[] {
	const rows = getDb()
		.prepare(
			`SELECT id, role, content, created_at
			 FROM messages
			 WHERE embed_id = ?
			 ORDER BY id ASC`
		)
		.all(embedId);

	return rows.map((row) => {
		const role = text(row.role);
		if (!isRole(role)) throw new Error('Ukjent meldingsrolle');
		return {
			id: Number(row.id),
			role,
			content: text(row.content),
			createdAt: text(row.created_at)
		};
	});
}

export function listEmbeds(owner: string): EmbedSummary[] {
	const rows = getDb()
		.prepare(
			`SELECT id, owner, title, html, published, created_at, updated_at
			 FROM embeds
			 WHERE owner = ?
			 ORDER BY updated_at DESC`
		)
		.all(owner);
	return rows.map((row) => toSummary(embedFrom(row)));
}

export function createEmbed(owner: string): EmbedDetail {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	getDb()
		.prepare(
			`INSERT INTO embeds (id, owner, title, html, published, created_at, updated_at)
			 VALUES (?, ?, ?, '', 0, ?, ?)`
		)
		.run(id, owner, DEFAULT_EMBED_TITLE, now, now);
	return {
		id,
		title: DEFAULT_EMBED_TITLE,
		published: false,
		updatedAt: now,
		html: '',
		createdAt: now,
		messages: []
	};
}

export function getEmbedForOwner(owner: string, id: string): EmbedDetail | null {
	const row = getDb()
		.prepare(
			`SELECT id, owner, title, html, published, created_at, updated_at
			 FROM embeds
			 WHERE id = ? AND owner = ?`
		)
		.get(id, owner);
	if (!row) return null;
	return toDetail(embedFrom(row), listMessages(id));
}

export function getEmbedForView(id: string, owner: string | null): PublishedEmbed | null {
	const row = getDb()
		.prepare(
			`SELECT id, owner, title, html, published, created_at, updated_at
			 FROM embeds
			 WHERE id = ?`
		)
		.get(id);
	if (!row) return null;
	const embed = embedFrom(row);
	const published = embed.published === 1;
	if (!published && (owner === null || owner !== embed.owner)) return null;
	return { id: embed.id, title: embed.title, html: embed.html };
}

export function updateEmbed(
	owner: string,
	id: string,
	patch: { title?: string; html?: string; published?: boolean }
): EmbedDetail | null {
	const assignments = ['updated_at = ?'];
	const values: Array<string | number> = [new Date().toISOString()];
	if (patch.title !== undefined) {
		assignments.push('title = ?');
		values.push(patch.title);
	}
	if (patch.html !== undefined) {
		assignments.push('html = ?');
		values.push(patch.html);
	}
	if (patch.published !== undefined) {
		assignments.push('published = ?');
		values.push(patch.published ? 1 : 0);
	}
	values.push(id, owner);
	const result = getDb()
		.prepare(`UPDATE embeds SET ${assignments.join(', ')} WHERE id = ? AND owner = ?`)
		.run(...values);
	if (Number(result.changes) === 0) return null;
	return getEmbedForOwner(owner, id);
}

export function deleteEmbed(owner: string, id: string): boolean {
	const result = getDb().prepare('DELETE FROM embeds WHERE id = ? AND owner = ?').run(id, owner);
	return Number(result.changes) > 0;
}

export function addMessage(embedId: string, role: Role, content: string): ChatMessage {
	const createdAt = new Date().toISOString();
	const result = getDb()
		.prepare(
			`INSERT INTO messages (embed_id, role, content, created_at)
			 VALUES (?, ?, ?, ?)`
		)
		.run(embedId, role, content, createdAt);
	return {
		id: Number(result.lastInsertRowid),
		role,
		content,
		createdAt
	};
}
