-- DESIGN ONLY (preparation, NOT applied to any live database).
-- REV 12: content fence. The permission form binds the DISPLAYED snapshot
-- (shown_hash). A writer changing live content between the GET and the
-- grant batch - another tab, the legacy save route, the admin MCP - must
-- invalidate the grant, or content the cook never saw could be sealed and
-- consented. A per-recipe monotonically increasing seq is bumped by trigger
-- on EVERY content write from ANY writer, and the grant batch opens with a
-- probe whose trigger aborts the whole batch when the fence moved past the
-- seq the form displayed. The probe row is deleted again at the end of the
-- same batch, so the table stays empty outside a grant transaction.
CREATE TABLE recipe_content_fence (
  recipe_id TEXT PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL DEFAULT 0
);

CREATE TRIGGER recipe_content_fence_init AFTER INSERT ON recipes
BEGIN
  INSERT OR IGNORE INTO recipe_content_fence (recipe_id, seq) VALUES (NEW.id, 0);
END;

CREATE TRIGGER recipe_content_fence_bump_recipes AFTER UPDATE ON recipes
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq) VALUES (NEW.id, 1)
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

CREATE TRIGGER recipe_content_fence_bump_locales_ins AFTER INSERT ON recipe_locales
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq) VALUES (NEW.recipe_id, 1)
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

CREATE TRIGGER recipe_content_fence_bump_locales_upd AFTER UPDATE ON recipe_locales
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq) VALUES (NEW.recipe_id, 1)
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

CREATE TRIGGER recipe_content_fence_bump_locales_del AFTER DELETE ON recipe_locales
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq) VALUES (OLD.recipe_id, 1)
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

CREATE TRIGGER recipe_content_fence_bump_images_ins AFTER INSERT ON recipe_images
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq) VALUES (NEW.recipe_id, 1)
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

CREATE TRIGGER recipe_content_fence_bump_images_upd AFTER UPDATE ON recipe_images
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq) VALUES (NEW.recipe_id, 1)
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

CREATE TRIGGER recipe_content_fence_bump_images_del AFTER DELETE ON recipe_images
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq) VALUES (OLD.recipe_id, 1)
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

-- A source row is shared by reference; editing it changes the snapshot of
-- every recipe that names it.
CREATE TRIGGER recipe_content_fence_bump_sources AFTER UPDATE ON sources
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq)
  SELECT id, 1 FROM recipes WHERE source_id = NEW.id
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

CREATE TABLE consent_fence_probe (
  recipe_id TEXT PRIMARY KEY,
  expected_seq INTEGER NOT NULL
);

CREATE TRIGGER consent_fence_probe_check BEFORE INSERT ON consent_fence_probe
WHEN (SELECT f.seq FROM recipe_content_fence f WHERE f.recipe_id = NEW.recipe_id) IS NOT NEW.expected_seq
BEGIN
  SELECT RAISE(ABORT, 'live state changed since the displayed snapshot');
END;
