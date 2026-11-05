-- DESIGN ONLY (preparation, NOT applied to any live database).
-- REV 10: split consent scope. The approved plan (2yolks-plan.md, approved by
-- the owner over iMessage Nov 4 2026) requires it: Legal safety states "the
-- permission step covers text and photos separately" and module C2 requires
-- every box to start unchecked, so a consent event names ONE scope. REV 9's single grant implicitly bundled text and
-- images; the DEFAULT 'text' keeps REV 9 rows meaningful after the ALTER.
-- Open for review: the publish predicate must require scope 'text' consent
-- for locale flips AND scope 'images' consent for bound-image flips; that
-- predicate change rides with the publish path review, not this file.

ALTER TABLE recipe_consent_events
  ADD COLUMN scope TEXT NOT NULL DEFAULT 'text' CHECK (scope IN ('text', 'images'));

CREATE INDEX IF NOT EXISTS idx_consent_scope ON recipe_consent_events(recipe_id, revision_id, scope, event);
