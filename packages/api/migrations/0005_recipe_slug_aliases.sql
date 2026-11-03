-- Recipe slug aliases: the frozen map behind clean slug-only recipe URLs
-- (/{country}/recipes/{slug}). Once a (country, lang, slug) has served
-- publicly it is frozen here when it leaves the sitemap, so the old URL can
-- 301 to the recipe's current slug instead of 404ing, and so no other recipe
-- can ever claim that URL. Rows are permanent reservations: never updated,
-- never deleted.
CREATE TABLE IF NOT EXISTS recipe_slug_aliases (
  country    TEXT NOT NULL,
  lang       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  recipe_id  TEXT NOT NULL REFERENCES recipes(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (country, lang, slug)
);
