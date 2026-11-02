-- 2yolks initial schema.
-- Provenance is mandatory: every recipe row references a source, and every
-- source carries a license + clearance timestamp. Unreviewed sources must
-- never feed published rows.

CREATE TABLE sources (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  license     TEXT NOT NULL,              -- SPDX id, or 'unknown' / 'proprietary'
  cleared_at  TEXT,                       -- NULL until rights review completes
  notes       TEXT
);

CREATE TABLE recipes (
  id             TEXT PRIMARY KEY,
  source_id      TEXT NOT NULL REFERENCES sources(id),
  origin_country TEXT,                    -- ISO-3166 alpha-2, nullable
  image_key      TEXT,                    -- R2 object key, nullable
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE recipe_locales (
  recipe_id        TEXT NOT NULL REFERENCES recipes(id),
  country          TEXT NOT NULL,         -- country prefix, e.g. 'us'
  lang             TEXT NOT NULL,         -- language segment, e.g. 'en'
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL,         -- slug within (country, lang)
  intro            TEXT,
  ingredients_json TEXT NOT NULL,         -- JSON array of strings, in order
  steps_json       TEXT NOT NULL,         -- JSON array of strings, in order
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'published', 'rejected')),
  PRIMARY KEY (country, lang, slug)
);

CREATE INDEX idx_recipe_locales_recipe ON recipe_locales(recipe_id);
CREATE INDEX idx_recipe_locales_country ON recipe_locales(country, lang, status);
