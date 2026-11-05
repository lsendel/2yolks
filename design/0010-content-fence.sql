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
-- Coverage notes (SQLite semantics), grounded in the ACTUAL schema:
-- * INSERT OR REPLACE performs an implicit DELETE per conflicting unique
--   index that fires NO triggers (recursive_triggers is off), then an INSERT
--   that fires INSERT triggers. Every INSERT bump below is an upsert-bump.
-- * Actual uniqueness conflict targets:
--     recipes        PRIMARY KEY (id)
--     sources        PRIMARY KEY (id)
--     recipe_images  PRIMARY KEY (id), UNIQUE (r2_key)
--     recipe_locales PRIMARY KEY (country, lang, slug),
--                    UNIQUE recipe_locales_one_per_recipe (recipe_id, country, lang)  [0007]
--   ONE REPLACE can displace MULTIPLE rows (one per conflicting index,
--   potentially under DIFFERENT parents), so the BEFORE INSERT compensate
--   triggers bump the fence of EVERY displaced row's parent.
-- * UPDATE can reassign the parent (recipe_id): the AFTER UPDATE bumps bump
--   BOTH the old and the new parent.
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

-- REPLACE displacing locale rows under ANY conflict target (global
-- (country, lang, slug) or per-recipe (recipe_id, country, lang)): bump every
-- displaced row's parent; the implicit deletes fire no trigger.
CREATE TRIGGER recipe_content_fence_bump_locales_replace BEFORE INSERT ON recipe_locales
WHEN EXISTS (
  SELECT 1 FROM recipe_locales l
  WHERE (l.country = NEW.country AND l.lang = NEW.lang AND l.slug = NEW.slug)
     OR (l.recipe_id = NEW.recipe_id AND l.country = NEW.country AND l.lang = NEW.lang))
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq)
  SELECT DISTINCT l.recipe_id, 1 FROM recipe_locales l
  WHERE (l.country = NEW.country AND l.lang = NEW.lang AND l.slug = NEW.slug)
     OR (l.recipe_id = NEW.recipe_id AND l.country = NEW.country AND l.lang = NEW.lang)
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

-- REPLACE displacing image rows under ANY conflict target (id or r2_key):
-- bump every displaced row's parent; the implicit deletes fire no trigger.
CREATE TRIGGER recipe_content_fence_bump_images_replace BEFORE INSERT ON recipe_images
WHEN EXISTS (SELECT 1 FROM recipe_images i WHERE i.id = NEW.id OR i.r2_key = NEW.r2_key)
BEGIN
  INSERT INTO recipe_content_fence (recipe_id, seq)
  SELECT DISTINCT i.recipe_id, 1 FROM recipe_images i WHERE i.id = NEW.id OR i.r2_key = NEW.r2_key
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
