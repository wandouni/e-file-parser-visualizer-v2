import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'path'
import fs from 'fs'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof drizzle<typeof schema>> | undefined
}

function initDb() {
  const dbDir = path.join(process.cwd(), 'data')
  fs.mkdirSync(dbDir, { recursive: true })
  const dbPath = path.join(dbDir, 'app.db')

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  // Create tables on first use (idempotent)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_banned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS case_members (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'viewer',
      joined_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS histories (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      imported_by TEXT NOT NULL,
      import_time TEXT NOT NULL DEFAULT (datetime('now')),
      section_tag TEXT NOT NULL,
      meta TEXT NOT NULL DEFAULT '{}',
      fields TEXT NOT NULL DEFAULT '[]',
      labels TEXT NOT NULL DEFAULT '[]',
      rows TEXT NOT NULL DEFAULT '[]',
      col_config TEXT NOT NULL DEFAULT '{}',
      page_size INTEGER NOT NULL DEFAULT 22,
      viz_configs TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS case_invites (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      created_by TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      max_uses INTEGER,
      use_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  return drizzle(sqlite, { schema })
}

if (!global.__db) {
  global.__db = initDb()
}

export const db = global.__db
