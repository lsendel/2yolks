-- Dev-only: a published machine translation with an agent review stamp, to exercise the real route/loader path.
INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status, translation_of, translation_method, translation_reviewed_at, translation_reviewed_by, translation_reviewer_kind) VALUES
  ('r1', 'mx', 'en', 'Ranch Eggs (translated)', 'ranch-eggs-translated', 'A ranch classic.',
   '["2 eggs","2 tortillas","salsa"]', '["Warm the tortillas","Fry the eggs","Top with salsa"]', 'published', 'mx/es', 'machine', datetime('now'), 'test agent review', 'agent');
