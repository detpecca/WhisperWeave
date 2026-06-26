import * as SQLite from "expo-sqlite";
import type { Fragment, GeneratedDoc, AppSettings } from "@whisperweave/core";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("whisperweave.db");
  await migrate(db);
  return db;
}

async function migrate(d: SQLite.SQLiteDatabase) {
  await d.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS fragments (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      tag TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      consumed INTEGER DEFAULT 0,
      consumedByDocId TEXT
    );
    CREATE TABLE IF NOT EXISTS docs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      markdown TEXT NOT NULL,
      sourceFragmentIds TEXT NOT NULL DEFAULT '[]',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      sync TEXT,
      archived INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fragments_createdAt ON fragments(createdAt);
    CREATE INDEX IF NOT EXISTS idx_docs_updatedAt ON docs(updatedAt);
  `);
}

export function rowToFragment(r: Record<string, unknown>): Fragment {
  return {
    id: String(r.id),
    content: String(r.content),
    tag: (r.tag as string) || undefined,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
    consumed: r.consumed === 1 ? true : r.consumed === 0 ? false : undefined,
    consumedByDocId: (r.consumedByDocId as string) || undefined,
  };
}

export function fragmentToRow(f: Fragment) {
  return {
    id: f.id,
    content: f.content,
    tag: f.tag ?? null,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    consumed: f.consumed ? 1 : 0,
    consumedByDocId: f.consumedByDocId ?? null,
  };
}

export function rowToDoc(r: Record<string, unknown>): GeneratedDoc {
  let sourceFragmentIds: string[] = [];
  try {
    sourceFragmentIds = JSON.parse(String(r.sourceFragmentIds)) || [];
  } catch {
    // 旧数据兼容
  }
  let sync: GeneratedDoc["sync"];
  try {
    if (r.sync) sync = JSON.parse(String(r.sync));
  } catch {
    // 旧数据兼容
  }
  return {
    id: String(r.id),
    title: String(r.title),
    markdown: String(r.markdown),
    sourceFragmentIds,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
    sync,
    archived: r.archived === 1 ? true : undefined,
  };
}

export function docToRow(d: GeneratedDoc) {
  return {
    id: d.id,
    title: d.title,
    markdown: d.markdown,
    sourceFragmentIds: JSON.stringify(d.sourceFragmentIds),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    sync: d.sync ? JSON.stringify(d.sync) : null,
    archived: d.archived ? 1 : 0,
  };
}

const SETTINGS_KEY = "appSettings";

export async function loadSettingsRow(
  d: SQLite.SQLiteDatabase
): Promise<Partial<AppSettings> | null> {
  const row = await d.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [SETTINGS_KEY]
  );
  if (!row) return null;
  try {
    return JSON.parse(row.value) as Partial<AppSettings>;
  } catch {
    return null;
  }
}

export async function saveSettingsRow(
  d: SQLite.SQLiteDatabase,
  s: AppSettings
): Promise<void> {
  await d.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [SETTINGS_KEY, JSON.stringify(s)]
  );
}
