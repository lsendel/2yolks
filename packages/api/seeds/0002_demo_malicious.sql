-- Malicious-input test seed (local dev only): proves title/JSON-LD escaping.
INSERT INTO sources (id, name, url, license, cleared_at, notes)
VALUES ('demo-evil', 'Synthetic malicious-input test', 'internal:demo-evil', 'internal-demo', datetime('now'),
        'Escaping test fixture; never production content.');
INSERT INTO recipes (id, source_id, origin_country) VALUES ('r2', 'demo-evil', 'us');
INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES
  ('r2', 'us', 'en', '</title><script>alert(1)</script>', 'evil-recipe', NULL,
   '["</script><script>alert(2)</script>"]', '["step"]', 'published');
