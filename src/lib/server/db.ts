import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let database: DatabaseSync | undefined;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS embeds (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  title TEXT NOT NULL,
  html TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS embeds_owner_updated ON embeds (owner, updated_at DESC);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  embed_id TEXT NOT NULL REFERENCES embeds(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_embed ON messages (embed_id, id);
`;

export function useDatabase(path: string): DatabaseSync {
	if (database?.isOpen) database.close();
	mkdirSync(dirname(path), { recursive: true });
	const next = new DatabaseSync(path);
	database = next;
	next.exec('PRAGMA foreign_keys = ON');
	next.exec('PRAGMA journal_mode = WAL');
	next.exec(SCHEMA);
	return next;
}

export function getDb(): DatabaseSync {
	if (!database) return useDatabase(process.env.DATABASE_PATH || 'data/embeds.db');
	return database;
}
