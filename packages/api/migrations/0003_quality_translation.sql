-- Explicit per-recipe quality state and translation provenance.
-- Additive and nullable: safe to apply before the code that reads it.
-- tested_at NULL means "not yet tested". Set it only when a person cooked the
-- recipe; never infer it from the source license.
ALTER TABLE recipes ADD COLUMN tested_at TEXT;
ALTER TABLE recipes ADD COLUMN tested_by TEXT;
-- A translated locale row points at the row it was translated from ("country/lang").
-- translation_method is 'human' or 'machine'; NULL for original-language rows.
ALTER TABLE recipe_locales ADD COLUMN translation_of TEXT;
ALTER TABLE recipe_locales ADD COLUMN translation_method TEXT;
ALTER TABLE recipe_locales ADD COLUMN translation_reviewed_at TEXT;
