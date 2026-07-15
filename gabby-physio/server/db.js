'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'gabby.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  pin_hash     TEXT NOT NULL,
  daily_goal   INTEGER NOT NULL DEFAULT 3 CHECK (daily_goal BETWEEN 1 AND 20),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Long-lived device login tokens (one per device the user logs in from)
CREATE TABLE IF NOT EXISTS auth_tokens (
  token        TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);

-- Exercise schemes. One active scheme per user for now, but the model
-- allows several (is_active picks the current one).
CREATE TABLE IF NOT EXISTS schemes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'My exercises',
  config_json TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_schemes_user ON schemes(user_id, is_active);

CREATE TABLE IF NOT EXISTS sessions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheme_id           INTEGER REFERENCES schemes(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress','completed','abandoned')),
  local_date          TEXT NOT NULL, -- YYYY-MM-DD on the device that ran the session
  exercises_total     INTEGER NOT NULL DEFAULT 0,
  exercises_completed INTEGER NOT NULL DEFAULT 0,
  started_at          TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, local_date);
`);

module.exports = db;
