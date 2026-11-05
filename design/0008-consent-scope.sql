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

-- Scope-aware publication (enforced, not advisory): REV 9's publish_assert
-- proves A current owner grant exists for the exact revision+license; this
-- trigger additionally requires that grant in the TEXT scope, and - when the
-- revision binds images - a current IMAGES-scope grant for the same exact
-- revision+license. A grant recorded on an older revision never covers a
-- newer one (revision_id equality), so recording image consent on a new
-- revision cannot make prior text consent cover that new revision.
CREATE TRIGGER publish_assert_scope BEFORE INSERT ON publish_requests
BEGIN
  SELECT RAISE(ABORT, 'no current text-scope grant from the current owner for this exact revision and license')
  WHERE NOT EXISTS (
    SELECT 1 FROM recipe_consent_events e
    WHERE e.recipe_id = NEW.recipe_id AND e.revision_id = NEW.revision_id
      AND e.user_id = (SELECT owner_user_id FROM recipes WHERE id = NEW.recipe_id)
      AND e.audience = 'public' AND e.license_version = NEW.license_version AND e.license_lang = NEW.license_lang
      AND e.scope = 'text' AND e.event = 'grant'
      AND e.consent_seq = (SELECT MAX(consent_seq) FROM recipe_consent_events x
        WHERE x.recipe_id = e.recipe_id AND x.revision_id = e.revision_id AND x.user_id = e.user_id
          AND x.audience = e.audience AND x.license_version = e.license_version AND x.license_lang = e.license_lang AND x.scope = e.scope));
  SELECT RAISE(ABORT, 'revision binds images but has no current images-scope grant for this exact revision and license')
  WHERE EXISTS (SELECT 1 FROM recipe_revision_images ri WHERE ri.revision_id = NEW.revision_id)
    AND NOT EXISTS (
      SELECT 1 FROM recipe_consent_events e
      WHERE e.recipe_id = NEW.recipe_id AND e.revision_id = NEW.revision_id
        AND e.user_id = (SELECT owner_user_id FROM recipes WHERE id = NEW.recipe_id)
        AND e.audience = 'public' AND e.license_version = NEW.license_version AND e.license_lang = NEW.license_lang
        AND e.scope = 'images' AND e.event = 'grant'
        AND e.consent_seq = (SELECT MAX(consent_seq) FROM recipe_consent_events x
          WHERE x.recipe_id = e.recipe_id AND x.revision_id = e.revision_id AND x.user_id = e.user_id
            AND x.audience = e.audience AND x.license_version = e.license_version AND x.license_lang = e.license_lang AND x.scope = e.scope));
END;
