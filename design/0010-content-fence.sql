-- DESIGN ONLY (preparation, NOT applied to any live database).
-- REV 12: content fence. The permission form binds the DISPLAYED snapshot
-- (shown_hash + shown_seq). A writer changing live content between the GET
-- and the grant batch - another tab, the legacy save route, the admin MCP -
-- must invalidate the grant, or content the cook never saw could be sealed
-- and consented. A per-recipe monotonically increasing seq is bumped by
-- trigger on EVERY content write from ANY writer; the grant batch opens
-- with a probe whose trigger aborts the whole batch when the fence moved
-- past the seq the form displayed. The probe row is deleted again at the
-- end of the same batch, so the table stays empty outside a grant
-- transaction.
--
-- Coverage notes (SQLite semantics):
-- * INSERT OR REPLACE performs an implicit DELETE that fires NO triggers
--   (recursive_triggers is off), then an INSERT that fires INSERT triggers.
--   Every INSERT bump below is therefore an upsert-bump, and recipe_images
--   adds a BEFORE INSERT trigger that also bumps the CURRENT parent when a
--   REPLACE moves an existing image to a different recipe.
-- * UPDATE can reassign the parent (recipe_id): the AFTER UPDATE bumps bump
--   BOTH the old and the new parent.
-- * recipe_locales cannot be parent-reassigned by REPLACE (its primary key
--   includes recipe_id, so a conflicting REPLACE is always same-recipe and
--   the AFTER INSERT bump covers it); its AFTER UPDATE still bumps both.
-- Deliberately NO foreign key to recipes: SQLite enforces same-key REPLACE
-- without firing DELETE triggers, and a cascaded fence row would be recreated
-- at seq 1 - a silent reset a stale shown_seq could collide with. With no FK
-- the fence row survives a recipe REPLACE and the AFTER INSERT upsert-bump
-- keeps the seq monotonic. A hard-deleted recipe leaves one orphan row.
CREATE TABLE recipe_content_fence (
  recipe_id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0
);

-- Upsert-bump: a plain INSERT starts the fence at 1; an INSERT OR REPLACE
-- over an existing recipe bumps it (the implicit delete is invisible).
CREATE TRIGGER recipe_content_fence_bump_recipes_ins AFTER INSERT ON recipes
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq) VALUES (NEW.id, 1)
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

CREATE TRIGGER recipe_content_fence_bump_recipes_upd AFTER UPDATE ON recipes
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
  INSERT INTO recipe_content_fence (recipe_id, seq)
  SELECT OLD.recipe_id, 1 WHERE OLD.recipe_id <> NEW.recipe_id
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

CREATE TRIGGER recipe_content_fence_bump_locales_del AFTER DELETE ON recipe_locales
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq) VALUES (OLD.recipe_id, 1)
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

-- REPLACE that moves an existing image to another recipe: the old parent's
-- fence must move even though the implicit delete fires no trigger.
CREATE TRIGGER recipe_content_fence_bump_images_replace BEFORE INSERT ON recipe_images
WHEN EXISTS (SELECT 1 FROM recipe_images i WHERE i.id = NEW.id AND i.recipe_id <> NEW.recipe_id)
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq)
  SELECT i.recipe_id, 1 FROM recipe_images i WHERE i.id = NEW.id
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
  INSERT INTO recipe_content_fence (recipe_id, seq)
  SELECT OLD.recipe_id, 1 WHERE OLD.recipe_id <> NEW.recipe_id
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

CREATE TRIGGER recipe_content_fence_bump_images_del AFTER DELETE ON recipe_images
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq) VALUES (OLD.recipe_id, 1)
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

-- A source row is shared by reference; editing it changes the snapshot of
-- every recipe that names it. INSERT OR REPLACE over an existing source id
-- lands here through the INSERT trigger, not the UPDATE one.
CREATE TRIGGER recipe_content_fence_bump_sources_ins AFTER INSERT ON sources
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq)
  SELECT id, 1 FROM recipes WHERE source_id = NEW.id
  ON CONFLICT(recipe_id) DO UPDATE SET seq = seq + 1;
END;

CREATE TRIGGER recipe_content_fence_bump_sources_upd AFTER UPDATE ON sources
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq)
  SELECT id, 1 FROM recipes WHERE source_id IN (NEW.id, OLD.id)
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
