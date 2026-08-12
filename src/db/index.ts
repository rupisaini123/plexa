import { DatabaseSync } from 'node:sqlite';
import { getDbPath, getEnv, hashPassword, verifyPassword } from '../config/index.js';
import { logger } from '../logger.js';

export interface SettingsRow {
  id: number;
  plex_url: string | null;
  plex_token_enc: string | null;
  music_library_id: string | null;
  public_url: string | null;
  alexa_skill_id: string | null;
  invocation_name: string;
  locale: string;
  plex_client_id: string | null;
  plex_account_email: string | null;
  plex_account_token_enc: string | null;
  plex_server_name: string | null;
  plex_server_machine_id: string | null;
  alexa_events_retention_days: number;
  updated_at: string;
}

export interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
}

export interface SessionRow {
  id: string;
  expires_at: string;
  created_at: string;
}

export interface PlaybackStateRow {
  id: string;
  user_id: string;
  device_id: string | null;
  queue_json: string;
  current_index: number;
  shuffle: number;
  loop: number;
  updated_at: string;
}

export interface PlexOAuthRow {
  id: string;
  pin_id: number;
  client_identifier: string;
  auth_url: string;
  status: string;
  account_token_enc: string | null;
  expires_at: string;
  created_at: string;
}

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(getDbPath());
    migrate(db);
    seedAdmin(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function ensureColumn(database: DatabaseSync, table: string, column: string, ddl: string): void {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function migrate(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      plex_url TEXT,
      plex_token_enc TEXT,
      music_library_id TEXT,
      public_url TEXT,
      alexa_skill_id TEXT,
      invocation_name TEXT NOT NULL DEFAULT 'plexa',
      locale TEXT NOT NULL DEFAULT 'en-US',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playback_state (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT,
      queue_json TEXT NOT NULL DEFAULT '[]',
      current_index INTEGER NOT NULL DEFAULT 0,
      shuffle INTEGER NOT NULL DEFAULT 0,
      loop INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alexa_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plex_oauth (
      id TEXT PRIMARY KEY,
      pin_id INTEGER NOT NULL,
      client_identifier TEXT NOT NULL,
      auth_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      account_token_enc TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  ensureColumn(database, 'settings', 'plex_client_id', 'TEXT');
  ensureColumn(database, 'settings', 'plex_account_email', 'TEXT');
  ensureColumn(database, 'settings', 'plex_account_token_enc', 'TEXT');
  ensureColumn(database, 'settings', 'plex_server_name', 'TEXT');
  ensureColumn(database, 'settings', 'plex_server_machine_id', 'TEXT');
  ensureColumn(database, 'settings', 'alexa_events_retention_days', 'INTEGER NOT NULL DEFAULT 7');
  ensureColumn(database, 'playback_state', 'loop', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'alexa_events', 'summary', 'TEXT');
  database.prepare('UPDATE alexa_events SET summary = event_type WHERE summary IS NULL').run();

  const settingsCount = database.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number };
  if (settingsCount.c === 0) {
    database.prepare(
      `INSERT INTO settings (id, invocation_name, locale) VALUES (1, 'plexa', 'en-US')`,
    ).run();
  }
}

function seedAdmin(database: DatabaseSync): void {
  const env = getEnv();
  const count = database.prepare('SELECT COUNT(*) as c FROM admin').get() as { c: number };
  if (count.c === 0) {
    database
      .prepare('INSERT INTO admin (username, password_hash) VALUES (?, ?)')
      .run(env.ADMIN_USERNAME, hashPassword(env.ADMIN_PASSWORD));
    logger.info({ username: env.ADMIN_USERNAME }, 'Seeded initial admin user');
  }
}

export function getAdminByUsername(username: string): AdminRow | undefined {
  return getDb().prepare('SELECT * FROM admin WHERE username = ?').get(username) as AdminRow | undefined;
}

export function verifyAdmin(username: string, password: string): AdminRow | null {
  const admin = getAdminByUsername(username);
  if (!admin || !verifyPassword(password, admin.password_hash)) return null;
  return admin;
}

export function updateAdminPassword(username: string, password: string): void {
  getDb()
    .prepare('UPDATE admin SET password_hash = ? WHERE username = ?')
    .run(hashPassword(password), username);
}

export function createSession(sessionId: string, expiresAt: Date): void {
  getDb()
    .prepare('INSERT INTO sessions (id, expires_at) VALUES (?, ?)')
    .run(sessionId, expiresAt.toISOString());
}

export function getSession(sessionId: string): SessionRow | undefined {
  return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as SessionRow | undefined;
}

export function deleteSession(sessionId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function deleteExpiredSessions(): void {
  getDb().prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
}

export function getSettings(): SettingsRow {
  return getDb().prepare('SELECT * FROM settings WHERE id = 1').get() as unknown as SettingsRow;
}

export function updateSettings(patch: Partial<SettingsRow>): SettingsRow {
  const current = getSettings();
  const pick = <K extends keyof SettingsRow>(key: K): SettingsRow[K] =>
    Object.prototype.hasOwnProperty.call(patch, key) ? (patch[key] as SettingsRow[K]) : current[key];

  const next = {
    plex_url: pick('plex_url'),
    plex_token_enc: pick('plex_token_enc'),
    music_library_id: pick('music_library_id'),
    public_url: pick('public_url'),
    alexa_skill_id: pick('alexa_skill_id'),
    invocation_name: pick('invocation_name'),
    locale: pick('locale'),
    plex_client_id: pick('plex_client_id'),
    plex_account_email: pick('plex_account_email'),
    plex_account_token_enc: pick('plex_account_token_enc'),
    plex_server_name: pick('plex_server_name'),
    plex_server_machine_id: pick('plex_server_machine_id'),
    alexa_events_retention_days: pick('alexa_events_retention_days'),
  };
  getDb()
    .prepare(
      `UPDATE settings SET
        plex_url = ?, plex_token_enc = ?, music_library_id = ?,
        public_url = ?, alexa_skill_id = ?, invocation_name = ?, locale = ?,
        plex_client_id = ?, plex_account_email = ?, plex_account_token_enc = ?,
        plex_server_name = ?, plex_server_machine_id = ?,
        alexa_events_retention_days = ?,
        updated_at = datetime('now')
      WHERE id = 1`,
    )
    .run(
      next.plex_url,
      next.plex_token_enc,
      next.music_library_id,
      next.public_url,
      next.alexa_skill_id,
      next.invocation_name,
      next.locale,
      next.plex_client_id,
      next.plex_account_email,
      next.plex_account_token_enc,
      next.plex_server_name,
      next.plex_server_machine_id,
      next.alexa_events_retention_days,
    );
  return getSettings();
}

export function getPlexClientId(): string | null {
  return getSettings().plex_client_id;
}

export function setPlexClientId(clientId: string): void {
  updateSettings({ plex_client_id: clientId });
}

export function savePlexOAuth(row: Omit<PlexOAuthRow, 'created_at'>): void {
  getDb()
    .prepare(
      `INSERT INTO plex_oauth (id, pin_id, client_identifier, auth_url, status, account_token_enc, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         pin_id = excluded.pin_id,
         client_identifier = excluded.client_identifier,
         auth_url = excluded.auth_url,
         status = excluded.status,
         account_token_enc = excluded.account_token_enc,
         expires_at = excluded.expires_at`,
    )
    .run(row.id, row.pin_id, row.client_identifier, row.auth_url, row.status, row.account_token_enc, row.expires_at);
}

export function getPlexOAuth(id: string): PlexOAuthRow | undefined {
  return getDb().prepare('SELECT * FROM plex_oauth WHERE id = ?').get(id) as PlexOAuthRow | undefined;
}

export function clearPlexOAuth(id: string): void {
  getDb().prepare('DELETE FROM plex_oauth WHERE id = ?').run(id);
}

export interface AlexaEventRow {
  id: number;
  event_type: string;
  summary: string;
  created_at: string;
}

export function recordAlexaEvent(event: { type: string; summary: string }): void {
  getDb()
    .prepare('INSERT INTO alexa_events (event_type, summary) VALUES (?, ?)')
    .run(event.type, event.summary);
}

export function deleteAlexaEventsOlderThan(days: number): number {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const result = getDb()
    .prepare('DELETE FROM alexa_events WHERE created_at < ?')
    .run(cutoff);
  return Number(result.changes);
}

export function getAlexaEventsPage(start: number, size: number): {
  items: AlexaEventRow[];
  nextStart: number;
  hasMore: boolean;
} {
  const safeStart = Math.max(0, start);
  const safeSize = Math.min(Math.max(1, size), 100);
  const rows = getDb()
    .prepare(
      'SELECT id, event_type, summary, created_at FROM alexa_events ORDER BY id DESC LIMIT ? OFFSET ?',
    )
    .all(safeSize + 1, safeStart) as unknown as AlexaEventRow[];
  const hasMore = rows.length > safeSize;
  const items = hasMore ? rows.slice(0, safeSize) : rows;
  return {
    items,
    nextStart: safeStart + items.length,
    hasMore,
  };
}

export function getAlexaEventsAfter(afterId: number, size: number): {
  items: AlexaEventRow[];
  nextStart: number;
  hasMore: boolean;
} {
  const safeAfterId = Math.max(0, afterId);
  const safeSize = Math.min(Math.max(1, size), 100);
  const rows = getDb()
    .prepare(
      'SELECT id, event_type, summary, created_at FROM alexa_events WHERE id > ? ORDER BY id DESC LIMIT ?',
    )
    .all(safeAfterId, safeSize + 1) as unknown as AlexaEventRow[];
  const hasMore = rows.length > safeSize;
  const items = hasMore ? rows.slice(0, safeSize) : rows;
  return {
    items,
    nextStart: items.length > 0 ? items[0].id : safeAfterId,
    hasMore,
  };
}

export function getPlaybackState(id: string): PlaybackStateRow | undefined {
  return getDb().prepare('SELECT * FROM playback_state WHERE id = ?').get(id) as PlaybackStateRow | undefined;
}

export function upsertPlaybackState(state: Omit<PlaybackStateRow, 'updated_at'>): void {
  getDb()
    .prepare(
      `INSERT INTO playback_state (id, user_id, device_id, queue_json, current_index, shuffle, loop, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id,
         device_id = excluded.device_id,
         queue_json = excluded.queue_json,
         current_index = excluded.current_index,
         shuffle = excluded.shuffle,
         loop = excluded.loop,
         updated_at = datetime('now')`,
    )
    .run(
      state.id,
      state.user_id,
      state.device_id,
      state.queue_json,
      state.current_index,
      state.shuffle,
      state.loop,
    );
}

export function deletePlaybackState(id: string): void {
  getDb().prepare('DELETE FROM playback_state WHERE id = ?').run(id);
}
