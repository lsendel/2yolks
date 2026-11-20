-- Optional contributor cover photo ("photo of your dish") on a private draft.
-- Bytes live under the PRIVATE drafts/<userId>/<draftId>/ prefix in R2 and are
-- NEVER in recipe_images, so /img/recipe/* cannot serve them. Only the owning
-- signed-in user can fetch the bytes (/account/recipes/<id>/photo, private,
-- no-store). An admin may approve it through the MCP when publishing; only
-- then is a copy written under recipes/ with a cleared recipe_images row
-- (style 'photo', credited to the contributor). Nothing is auto-published.
--
-- status: pending  = attached to the draft, private (at most ONE per draft)
--         approved = copied to a public recipe_images row (image_id); the
--                    private object is deleted
--         rejected = never published; the private object is deleted
-- Replacing or removing a pending photo deletes the row AND the R2 object.
CREATE TABLE IF NOT EXISTS draft_photos (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  r2_key TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  moderated_at TEXT,
  moderated_by TEXT,
  image_id TEXT -- recipe_images.id once approved
);
-- One active (pending) cover per draft; a concurrent second insert fails.
CREATE UNIQUE INDEX IF NOT EXISTS idx_draft_photos_one_pending ON draft_photos(recipe_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_draft_photos_user ON draft_photos(user_id, status);
