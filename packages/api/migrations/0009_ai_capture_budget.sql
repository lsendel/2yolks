-- Migration 0009: Atomic daily & per-user budget log for multimodal AI recipe co-editing.
-- Mirrors mail_log so Cloudflare Workers Free-tier usage stays strictly bounded.
CREATE TABLE IF NOT EXISTS ai_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_log_created_at ON ai_log (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_log_user_created ON ai_log (user_id, created_at);
