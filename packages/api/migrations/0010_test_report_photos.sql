-- Optional cook-submitted kitchen photo on community kitchen-test reports.
-- Pending/rejected photos live under reports/ in R2 and are NEVER in recipe_images,
-- so /img/recipe/* never serves them unless an admin approves via MCP.
ALTER TABLE recipe_test_reports ADD COLUMN image_r2_key TEXT;
ALTER TABLE recipe_test_reports ADD COLUMN image_mime TEXT;
ALTER TABLE recipe_test_reports ADD COLUMN image_bytes INTEGER;
ALTER TABLE recipe_test_reports ADD COLUMN image_width INTEGER;
ALTER TABLE recipe_test_reports ADD COLUMN image_height INTEGER;
ALTER TABLE recipe_test_reports ADD COLUMN image_id TEXT;
