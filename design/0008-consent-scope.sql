-- DESIGN ONLY (preparation, NOT applied to any live database).
-- REV 10: split consent scope. Plan module C2 keeps text and photo/image
-- permission separate with every box starting unchecked, so a consent event
-- names ONE scope. REV 9's single grant implicitly bundled text and
-- images; the DEFAULT 'text' keeps REV 9 rows meaningful after the ALTER.
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

-- Scoped per-row flip + serving (closes the cross-scope MAX(consent_seq)
-- hole: an images-scope grant must never make a revoked text consent look
-- current). The 0007 trigger and view are replaced with scope-exact
-- equivalents; the images-scope request-time predicate stays in
-- publish_assert_scope above.
DROP TRIGGER recipe_locales_publish_guard;
CREATE TRIGGER recipe_locales_publish_guard BEFORE UPDATE OF status ON recipe_locales
WHEN NEW.status = 'published' AND OLD.status <> 'published'
BEGIN
  SELECT RAISE(ABORT, 'publish guard failed')
  WHERE NOT EXISTS (
    SELECT 1
    FROM publish_requests p
    JOIN recipe_revisions r ON r.id = p.revision_id AND r.recipe_id = p.recipe_id
    WHERE p.recipe_id = NEW.recipe_id
      AND p.consumed_at IS NULL
      AND r.seq = (SELECT MAX(seq) FROM recipe_revisions WHERE recipe_id = NEW.recipe_id)
      -- current grant by the current owner for this exact revision and license
      AND EXISTS (
        SELECT 1 FROM recipe_consent_events e
        WHERE e.recipe_id = p.recipe_id AND e.revision_id = p.revision_id
          AND e.user_id = (SELECT owner_user_id FROM recipes WHERE id = p.recipe_id)
          AND e.audience = 'public' AND e.license_version = p.license_version AND e.license_lang = p.license_lang
          AND e.scope = 'text' AND e.event = 'grant'
          AND e.consent_seq = (SELECT MAX(consent_seq) FROM recipe_consent_events x
            WHERE x.recipe_id = e.recipe_id AND x.revision_id = e.revision_id AND x.user_id = e.user_id
              AND x.audience = e.audience AND x.license_version = e.license_version AND x.license_lang = e.license_lang
              AND x.scope = e.scope))
      -- this row's locale is in the consented snapshot and text-equal (NULL-safe)
      AND EXISTS (
        SELECT 1 FROM json_each(json_extract(r.snapshot_json, '$.locales')) k
        WHERE k.key = NEW.country || ':' || NEW.lang
          AND json_extract(k.value, '$.title') IS NEW.title
          AND json_extract(k.value, '$.slug') IS NEW.slug
          AND IFNULL(json_extract(k.value, '$.intro'), '') IS IFNULL(NEW.intro, '')
          AND json_extract(k.value, '$.ingredients_json') IS NEW.ingredients_json
          AND json_extract(k.value, '$.steps_json') IS NEW.steps_json)
      -- exact locale set, both directions
      AND NOT EXISTS (
        SELECT 1 FROM recipe_locales l
        WHERE l.recipe_id = NEW.recipe_id AND l.status <> 'rejected'
          AND NOT EXISTS (SELECT 1 FROM json_each(json_extract(r.snapshot_json, '$.locales')) k WHERE k.key = l.country || ':' || l.lang))
      AND NOT EXISTS (
        SELECT 1 FROM json_each(json_extract(r.snapshot_json, '$.locales')) k
        WHERE NOT EXISTS (SELECT 1 FROM recipe_locales l WHERE l.recipe_id = NEW.recipe_id AND l.status <> 'rejected' AND l.country || ':' || l.lang = k.key))
      -- full locale text equality for every consented locale (the row being
      -- flipped compares its NEW values, every other row its live values)
      AND NOT EXISTS (
        SELECT 1 FROM json_each(json_extract(r.snapshot_json, '$.locales')) k
        JOIN recipe_locales l ON l.recipe_id = NEW.recipe_id AND l.status <> 'rejected' AND l.country || ':' || l.lang = k.key
        WHERE json_extract(k.value, '$.title') IS NOT CASE WHEN l.country = NEW.country AND l.lang = NEW.lang THEN NEW.title ELSE l.title END
           OR json_extract(k.value, '$.slug') IS NOT CASE WHEN l.country = NEW.country AND l.lang = NEW.lang THEN NEW.slug ELSE l.slug END
           OR IFNULL(json_extract(k.value, '$.intro'), '') IS NOT CASE WHEN l.country = NEW.country AND l.lang = NEW.lang THEN IFNULL(NEW.intro, '') ELSE IFNULL(l.intro, '') END
           OR json_extract(k.value, '$.ingredients_json') IS NOT CASE WHEN l.country = NEW.country AND l.lang = NEW.lang THEN NEW.ingredients_json ELSE l.ingredients_json END
           OR json_extract(k.value, '$.steps_json') IS NOT CASE WHEN l.country = NEW.country AND l.lang = NEW.lang THEN NEW.steps_json ELSE l.steps_json END)
      -- recipe fields equal the snapshot (NULL-safe sentinels)
      AND NOT EXISTS (
        SELECT 1 FROM recipes o
        WHERE o.id = NEW.recipe_id AND (
          IFNULL(o.origin_country, '') <> IFNULL(json_extract(r.snapshot_json, '$.recipe.origin_country'), '')
          OR IFNULL(o.category, '') <> IFNULL(json_extract(r.snapshot_json, '$.recipe.category'), '')
          OR IFNULL(o.prep_minutes, -1) <> IFNULL(json_extract(r.snapshot_json, '$.recipe.prep_minutes'), -1)
          OR IFNULL(o.cook_minutes, -1) <> IFNULL(json_extract(r.snapshot_json, '$.recipe.cook_minutes'), -1)
          OR IFNULL(o.rest_minutes, -1) <> IFNULL(json_extract(r.snapshot_json, '$.recipe.rest_minutes'), -1)
          OR IFNULL(o.total_minutes, -1) <> IFNULL(json_extract(r.snapshot_json, '$.recipe.total_minutes'), -1)
          OR IFNULL(o.base_servings, -1) <> IFNULL(json_extract(r.snapshot_json, '$.recipe.base_servings'), -1)
          OR IFNULL(o.author_name, '') <> IFNULL(json_extract(r.snapshot_json, '$.recipe.author_name'), '')))
      -- source rights metadata equals the snapshot
      AND NOT EXISTS (
        SELECT 1 FROM sources s JOIN recipes o ON o.source_id = s.id
        WHERE o.id = NEW.recipe_id AND (
          s.name IS NOT json_extract(r.snapshot_json, '$.source.name')
          OR s.url IS NOT json_extract(r.snapshot_json, '$.source.url')
          OR s.license IS NOT json_extract(r.snapshot_json, '$.source.license')))
      -- the sealed manifest equals the snapshot image manifest exactly
      AND (SELECT count(*) FROM recipe_revision_images WHERE revision_id = p.revision_id)
          = (SELECT count(*) FROM json_each(json_extract(r.snapshot_json, '$.images')))
      AND NOT EXISTS (
        SELECT 1 FROM json_each(json_extract(r.snapshot_json, '$.images')) m
        WHERE NOT EXISTS (
          SELECT 1 FROM recipe_revision_images i WHERE i.revision_id = p.revision_id
            AND i.image_id = json_extract(m.value, '$.image_id')
            AND i.role = json_extract(m.value, '$.role')
            AND IFNULL(i.step_index, -1) = IFNULL(json_extract(m.value, '$.step_index'), -1)
            AND i.style = json_extract(m.value, '$.style')
            AND i.source_name = json_extract(m.value, '$.source_name')
            AND i.source_url = json_extract(m.value, '$.source_url')
            AND i.license = json_extract(m.value, '$.license')
            AND i.sha256 = json_extract(m.value, '$.sha256')
            AND IFNULL(i.provenance, '') IS IFNULL(json_extract(m.value, '$.provenance'), '')
            AND IFNULL(i.provenance_note, '') IS IFNULL(json_extract(m.value, '$.provenance_note'), ''))));
END;

DROP VIEW recipe_locales_effective;
CREATE VIEW recipe_locales_effective AS
SELECT l.* FROM recipe_locales l
WHERE l.status = 'published'
  AND EXISTS (
    SELECT 1
    FROM publish_requests p
    JOIN recipe_revisions r ON r.id = p.revision_id AND r.recipe_id = p.recipe_id
    JOIN recipe_consent_events e ON e.recipe_id = p.recipe_id AND e.revision_id = p.revision_id
      AND e.user_id = (SELECT owner_user_id FROM recipes WHERE id = p.recipe_id) AND e.audience = 'public'
      AND e.license_version = p.license_version AND e.license_lang = p.license_lang
      AND e.scope = 'text' AND e.event = 'grant'
      AND e.consent_seq = (SELECT MAX(consent_seq) FROM recipe_consent_events x
        WHERE x.recipe_id = e.recipe_id AND x.revision_id = e.revision_id AND x.user_id = e.user_id
          AND x.audience = e.audience AND x.license_version = e.license_version AND x.license_lang = e.license_lang
          AND x.scope = e.scope)
    WHERE p.recipe_id = l.recipe_id
      AND r.seq = (SELECT MAX(seq) FROM recipe_revisions WHERE recipe_id = l.recipe_id)
      AND EXISTS (SELECT 1 FROM json_each(json_extract(r.snapshot_json, '$.locales')) k WHERE k.key = l.country || ':' || l.lang));
