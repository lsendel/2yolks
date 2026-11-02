-- Demo seed for local development only (wrangler d1 execute --local).
-- SYNTHETIC TEST DATA: agent-authored recipe + translations written as a
-- pair (so the en/es hreflang equivalence is real by construction). Not
-- harvested content; replace with cleared UGC before any production use.
INSERT INTO sources (id, name, url, license, cleared_at, notes)
VALUES ('demo-seed', 'Synthetic demo recipe (agent-authored)', 'internal:demo-seed', 'internal-demo', datetime('now'),
        'Written as test data for the local dev seed; no external source.');

INSERT INTO recipes (id, source_id, origin_country) VALUES ('r1', 'demo-seed', 'mx');

INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES
  ('r1', 'mx', 'es', 'Huevos Rancheros', 'huevos-rancheros', 'Clásico de rancho.',
   '["2 huevos","2 tortillas","salsa"]', '["Calentar las tortillas","Freír los huevos","Bañar en salsa"]', 'published'),
  ('r1', 'us', 'en', 'Ranch Eggs', 'ranch-eggs', 'A ranch classic.',
   '["2 eggs","2 tortillas","salsa"]', '["Warm tortillas","Fry eggs","Top with salsa"]', 'published');
