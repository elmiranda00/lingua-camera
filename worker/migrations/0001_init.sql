-- Initial schema from the spec's "Tables" section. Unused until M2/M3, created
-- now so migrations and the D1 binding are proven end to end in M0.

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  disabled    INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1))
);

CREATE TABLE entries (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lang            TEXT NOT NULL CHECK (lang IN ('fr', 'zh')),
  headword        TEXT NOT NULL,
  surface_forms   TEXT NOT NULL DEFAULT '[]',
  pinyin          TEXT,
  pinyin_plain    TEXT,
  translation     TEXT NOT NULL,
  other_meanings  TEXT NOT NULL DEFAULT '[]',
  pos             TEXT NOT NULL,
  gender          TEXT CHECK (gender IN ('m', 'f')),
  context         TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('word', 'phrase')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, lang, headword)
);
CREATE INDEX entries_user_lang ON entries (user_id, lang);

CREATE TABLE lookup_cache (
  key         TEXT PRIMARY KEY,
  response    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE usage (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day      TEXT NOT NULL,
  lookups  INTEGER NOT NULL DEFAULT 0,
  tts      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
