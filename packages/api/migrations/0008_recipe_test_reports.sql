-- Community kitchen-test reports (the community-tested path).
-- A signed-in cook flags a published recipe as cooked in their own kitchen.
-- A report is a moderation-queue row only: it never changes what the site
-- shows by itself. An admin approves it through the MCP
-- (recipes.moderate_test_report); only then is recipes.tested_at/tested_by
-- stamped. Reports are hidden on reject, never deleted.
CREATE TABLE IF NOT EXISTS recipe_test_reports (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at TEXT NOT NULL,
  moderated_at TEXT,
  moderated_by TEXT
);
-- One report per cook per recipe: a duplicate is a conflict, not a new row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_test_reports_recipe_user ON recipe_test_reports(recipe_id, user_id);
CREATE INDEX IF NOT EXISTS idx_test_reports_status ON recipe_test_reports(status, created_at);
