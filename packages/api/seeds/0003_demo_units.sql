-- Local test data only: one metric-written recipe with a structured row and step tokens.
INSERT INTO recipes (id, source_id, origin_country) VALUES ('r3', 'demo-seed', 'mx');
INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES
  ('r3', 'mx', 'es', 'Pan de prueba', 'pan-de-prueba', 'Datos de prueba.',
   '["250 g harina","2 tazas de agua","3 huevos",{"ref":"aceite","qty":1,"unit":"tbsp","name":"aceite"}]',
   '["Mezclar","Agregar {i:aceite}","Hornear a {t:180C}"]', 'published'),
  ('r3', 'us', 'en', 'Test Bread', 'test-bread', 'Test data.',
   '["250 g flour","2 cups water","3 eggs",{"ref":"oil","qty":1,"unit":"tbsp","name":"oil"}]',
   '["Mix","Add {i:oil}","Bake at {t:180C}"]', 'published');
