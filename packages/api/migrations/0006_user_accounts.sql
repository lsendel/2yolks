-- User accounts (email-code sign-in) and user-owned private drafts.
-- Additive only: existing recipes keep owner_user_id NULL; MCP is unaffected.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email, created_at);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,           -- sha256 hex of the cookie token
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
ALTER TABLE recipes ADD COLUMN owner_user_id TEXT REFERENCES users(id);
ALTER TABLE recipes ADD COLUMN submitted_at TEXT;
ALTER TABLE recipes ADD COLUMN attested_at TEXT;
CREATE INDEX IF NOT EXISTS idx_recipes_owner ON recipes(owner_user_id);
