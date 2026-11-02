-- Demo seed for local development only (wrangler d1 execute --local).
-- Marks the UGC-first path: a family recipe entered by a user, source-cited.
INSERT INTO sources (id, name, url, license, cleared_at)
VALUES ('ugc-seed', 'Family recipe (UGC)', 'https://2yolks.com/about', 'proprietary', datetime('now'));

INSERT INTO recipes (id, source_id, origin_country) VALUES ('r1', 'ugc-seed', 'mx');

INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES
  ('r1', 'mx', 'es', 'Huevos Rancheros', 'huevos-rancheros', 'Clasico de rancho.',
   '["2 huevos","2 tortillas","salsa"]', '["Calentar tortillas","Freir huevos","Banar en salsa"]', 'published'),
  ('r1', 'us', 'en', 'Ranch Eggs', 'ranch-eggs', 'A ranch classic.',
   '["2 eggs","2 tortillas","salsa"]', '["Warm tortillas","Fry eggs","Top with salsa"]', 'published');
