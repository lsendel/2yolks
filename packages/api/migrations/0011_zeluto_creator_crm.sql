-- Bidirectional Zeluto Creator CRM integration for 2yolks.com.
-- Unified `users` entity: users are subscribers by default and become Creators once
-- they share/submit at least one recipe (`recipes.submitted_at IS NOT NULL`).
-- Strict isolation: `creator_subscribers` scopes each creator's own subscribers.

ALTER TABLE users ADD COLUMN zeluto_contact_id TEXT;
ALTER TABLE users ADD COLUMN zeluto_org_id TEXT;
ALTER TABLE users ADD COLUMN zeluto_connection_status TEXT NOT NULL DEFAULT 'not_registered';
ALTER TABLE users ADD COLUMN marketing_opt_in INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN unsubscribed_at TEXT;

CREATE TABLE IF NOT EXISTS creator_subscribers (
  id TEXT PRIMARY KEY,
  creator_user_id TEXT NOT NULL REFERENCES users(id),
  subscriber_user_id TEXT NOT NULL REFERENCES users(id),
  zeluto_contact_id TEXT,
  zeluto_pushed_at TEXT,
  unsubscribed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(creator_user_id, subscriber_user_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_subscribers_creator ON creator_subscribers(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_creator_subscribers_zeluto ON creator_subscribers(zeluto_contact_id);
