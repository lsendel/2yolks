-- Saved recipes (bookmarks) synced for signed-in users.
-- Additive only: anonymous visitors save in localStorage with zero DB writes.
CREATE TABLE IF NOT EXISTS saved_recipes (
  user_id TEXT NOT NULL REFERENCES users(id),
  recipe_id TEXT NOT NULL REFERENCES recipes(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, recipe_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_user ON saved_recipes(user_id, created_at DESC);
