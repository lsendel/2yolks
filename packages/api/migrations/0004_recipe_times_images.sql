-- Structured recipe timing/yield and rights-tracked images.
-- Additive and nullable: existing rows keep NULL ("not recorded", never zero).
-- total_minutes is stored explicitly, never derived: prep and cook can
-- overlap and resting time sits outside both, so arithmetic would lie.
ALTER TABLE recipes ADD COLUMN prep_minutes INTEGER;
ALTER TABLE recipes ADD COLUMN cook_minutes INTEGER;
ALTER TABLE recipes ADD COLUMN rest_minutes INTEGER;
ALTER TABLE recipes ADD COLUMN total_minutes INTEGER;
-- Numeric base yield the serving scaler multiplies from (1x). Stored per
-- recipe (translation-invariant), displayed localized.
ALTER TABLE recipes ADD COLUMN base_servings REAL;
-- Locale-invariant dish-type category slug; NULL = uncategorized ("All").
-- Valid slugs are enforced by the application (contracts RECIPE_CATEGORY_SLUGS).
ALTER TABLE recipes ADD COLUMN category TEXT;

-- Rights-tracked images. Provenance is mandatory, mirroring sources: every
-- image carries who made it, where from, and under what license. style keeps
-- the honest-imagery distinction (photo of a real dish vs labeled generated
-- illustration vs text-only graphic). Nothing is deleted: a replacement
-- image is a new row; the latest row per (recipe, kind[, step]) wins.
CREATE TABLE recipe_images (
  id          TEXT PRIMARY KEY,
  recipe_id   TEXT NOT NULL REFERENCES recipes(id),
  kind        TEXT NOT NULL CHECK (kind IN ('hero', 'step')),
  step_index  INTEGER,                    -- 0-based; only for kind='step'
  r2_key      TEXT NOT NULL UNIQUE,
  mime        TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  width       INTEGER,
  height      INTEGER,
  style       TEXT NOT NULL CHECK (style IN ('photo', 'illustration', 'graphic')),
  source_name TEXT NOT NULL,
  source_url  TEXT NOT NULL,
  license     TEXT NOT NULL,              -- SPDX id, or 'unknown' / 'proprietary'
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_recipe_images_recipe ON recipe_images(recipe_id);
