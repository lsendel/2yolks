-- Migration 0007: Log zero-result search queries to capture visitor demand / content gaps.
CREATE TABLE IF NOT EXISTS search_gap_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    locale TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_search_gap_logs_created ON search_gap_logs (created_at DESC);
