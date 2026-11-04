-- DESIGN REV 5 - smallest separable slice: immutable revisions + exact-content
-- consent for the PUBLIC audience only. Family, erasure and the mail outbox
-- are deliberately NOT in this slice; they ship behind separate reviewed
-- migrations. This file is design evidence, not wired into testd1/deploy.
--
-- Enforcement model (executable; proven by consent-design.test.ts):
-- * Every precondition aborts INSIDE the transaction via BEFORE-INSERT/UPDATE
--   triggers (RAISE(ABORT)). A violated owner/status/head guard rolls back
--   the whole D1 batch; there is no "guard no-op, earlier write commits" path
--   and no false return after mutation.
-- * Exact head equality: a revision's seq must equal the current head + 1.
--   A stale head AND a future head (gap) both abort. UNIQUE(recipe_id, seq)
--   and the PK are the backstops for same-seq/same-id writes.
-- * The canonical snapshot is the single source of truth: recipe fields,
--   source rights metadata, locale rows keyed "country:lang", and the image
--   manifest. saveEdit derives every live write from the snapshot via
--   json_extract - no separately bound values can diverge from what consent
--   will bind.
-- * Publication is atomic: publish_requests' assert trigger validates the
--   complete precondition set (owner, head, exact-tuple grant, exact locale
--   set, full content/recipe/source/image equality) BEFORE any status write
--   in the same batch; each status flip is independently re-guarded by a
--   per-row trigger. A missing, extra or drifted locale aborts everything -
--   no partial mutation.
-- * Revision manifests are sealed by the first consent event and validated
--   for same-recipe/kind/digest coherence at insert.
--
-- Launch dependencies (explicit, NOT implemented in this slice): every
-- mutation surface (account save, admin MCP, future user MCP) must route
-- content writes through revision creation; the R2 conditional writer
-- (content-addressed key + ifNoneMatch '*') and serving-bound enforcement
-- (serve only images bound in the published revision's manifest) gate
-- launch; the additive UNIQUE index below needs a data check at migration
-- review. Image-rights (cleared_at) checks stay as today until then.

CREATE TABLE recipe_revisions (
  id            TEXT PRIMARY KEY,   -- fresh id per accepted edit; never reused across edits
  recipe_id     TEXT NOT NULL REFERENCES recipes(id),
  seq           INTEGER NOT NULL,   -- per-recipe head counter; trigger enforces exact head+1
  content_hash  TEXT NOT NULL,      -- sha256 hex over the canonical serialization (verbatim text, no normalization)
  snapshot_json TEXT NOT NULL,      -- canonical manifest: recipe + source + locales + images; private evidence, never publicly served
  created_by    TEXT NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (recipe_id, seq),
  UNIQUE (id, recipe_id)            -- lets consent events FK to (revision, recipe) so a grant can never name a revision of another recipe
);

-- One live locale row per (recipe, country, lang): the publish assertion and
-- the save upsert key on it. Additive; verify against real data at migration.
CREATE UNIQUE INDEX recipe_locales_one_per_recipe ON recipe_locales(recipe_id, country, lang);

-- Revision creation IS the edit precondition check: it aborts inside the
-- transaction, so no follow-up write can commit without it.
CREATE TRIGGER recipe_revisions_guard BEFORE INSERT ON recipe_revisions
BEGIN
  SELECT RAISE(ABORT, 'stale or future head: seq must equal current head + 1')
  WHERE NEW.seq <> COALESCE((SELECT MAX(seq) FROM recipe_revisions WHERE recipe_id = NEW.recipe_id), 0) + 1;
  SELECT RAISE(ABORT, 'recipe not editable by this user in its current state')
  WHERE NOT EXISTS (
    SELECT 1 FROM recipes o
    WHERE o.id = NEW.recipe_id AND o.owner_user_id = NEW.created_by AND o.submitted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM recipe_locales l WHERE l.recipe_id = o.id AND l.status = 'published'));
END;

CREATE TABLE recipe_revision_images (
  revision_id TEXT NOT NULL REFERENCES recipe_revisions(id),
  image_id    TEXT NOT NULL REFERENCES recipe_images(id),
  role        TEXT NOT NULL CHECK (role IN ('hero','step')),
  step_index  INTEGER,
  style       TEXT NOT NULL CHECK (style IN ('photo','illustration','graphic')),
  source_name TEXT NOT NULL,
  source_url  TEXT NOT NULL,
  license     TEXT NOT NULL,
  sha256      TEXT NOT NULL,        -- digest of the exact R2 bytes bound at snapshot time
  PRIMARY KEY (revision_id, image_id)
);

-- Manifest coherence + sealing: an entry must name an image of the SAME
-- recipe with a matching kind, carry a well-formed digest, and cannot be
-- added once any consent event names the revision (the manifest is exactly
-- what consent binds).
CREATE TRIGGER recipe_revision_images_guard BEFORE INSERT ON recipe_revision_images
BEGIN
  SELECT RAISE(ABORT, 'image belongs to another recipe')
  WHERE NOT EXISTS (
    SELECT 1 FROM recipe_images i JOIN recipe_revisions r ON r.id = NEW.revision_id
    WHERE i.id = NEW.image_id AND i.recipe_id = r.recipe_id);
  SELECT RAISE(ABORT, 'manifest role does not match the image kind')
  WHERE NEW.role <> (SELECT kind FROM recipe_images WHERE id = NEW.image_id);
  SELECT RAISE(ABORT, 'sha256 must be 64 lowercase hex')
  WHERE length(NEW.sha256) <> 64 OR NEW.sha256 NOT GLOB '[0-9a-f]*';
  SELECT RAISE(ABORT, 'revision manifest is sealed once consent exists')
  WHERE EXISTS (SELECT 1 FROM recipe_consent_events e WHERE e.revision_id = NEW.revision_id);
END;
-- Image bytes immutability is enforced at the writer, not trusted to comments:
-- r2_key is content-addressed (img/<sha256>.<ext>) and every writer must PUT
-- with ifNoneMatch:'*' (R2 conditional write) so an occupied key cannot be
-- overwritten. That writer is a launch dependency, not part of this slice.

-- Append-only consent lifecycle, PUBLIC audience only in this slice.
CREATE TABLE recipe_consent_events (
  id              TEXT PRIMARY KEY,
  recipe_id       TEXT NOT NULL,
  revision_id     TEXT NOT NULL,
  consent_seq     INTEGER NOT NULL,  -- per-recipe counter; trigger enforces exact max+1
  event           TEXT NOT NULL CHECK (event IN ('grant','revoke')),
  user_id         TEXT NOT NULL REFERENCES users(id),
  audience        TEXT NOT NULL CHECK (audience IN ('public')),  -- family lands with its own reviewed migration
  license_version TEXT NOT NULL,
  license_lang    TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (recipe_id, consent_seq),
  FOREIGN KEY (revision_id, recipe_id) REFERENCES recipe_revisions(id, recipe_id)
);

CREATE TRIGGER recipe_consent_events_guard BEFORE INSERT ON recipe_consent_events
BEGIN
  SELECT RAISE(ABORT, 'stale or future consent head')
  WHERE NEW.consent_seq <> COALESCE((SELECT MAX(consent_seq) FROM recipe_consent_events WHERE recipe_id = NEW.recipe_id), 0) + 1;
  SELECT RAISE(ABORT, 'only the recipe owner can consent')
  WHERE NEW.user_id <> (SELECT owner_user_id FROM recipes WHERE id = NEW.recipe_id);
END;
-- A grant authorizes exactly one tuple: (recipe_id, revision_id, user_id,
-- audience, license_version, license_lang). A revoke names the same tuple.
-- Authoritative state = latest consent_seq event for that exact tuple.

-- Publish: the request row's insert trigger validates the COMPLETE
-- precondition set before any status write in the same batch. Rows double as
-- an audit log (append-only below).
CREATE TABLE publish_requests (
  id              TEXT PRIMARY KEY,
  recipe_id       TEXT NOT NULL REFERENCES recipes(id),
  revision_id     TEXT NOT NULL,
  requested_by    TEXT NOT NULL REFERENCES users(id),
  license_version TEXT NOT NULL,
  license_lang    TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (revision_id, recipe_id) REFERENCES recipe_revisions(id, recipe_id)
);

CREATE TRIGGER publish_assert BEFORE INSERT ON publish_requests
BEGIN
  SELECT RAISE(ABORT, 'only the recipe owner can publish')
  WHERE NEW.requested_by <> (SELECT owner_user_id FROM recipes WHERE id = NEW.recipe_id);
  SELECT RAISE(ABORT, 'revision is not the current head')
  WHERE NEW.revision_id <> (SELECT id FROM recipe_revisions WHERE recipe_id = NEW.recipe_id ORDER BY seq DESC LIMIT 1);
  SELECT RAISE(ABORT, 'no current grant for this exact revision and license')
  WHERE NOT EXISTS (
    SELECT 1 FROM recipe_consent_events e
    WHERE e.recipe_id = NEW.recipe_id AND e.revision_id = NEW.revision_id AND e.user_id = NEW.requested_by
      AND e.audience = 'public' AND e.license_version = NEW.license_version AND e.license_lang = NEW.license_lang
      AND e.event = 'grant'
      AND e.consent_seq = (SELECT MAX(consent_seq) FROM recipe_consent_events x
        WHERE x.recipe_id = e.recipe_id AND x.revision_id = e.revision_id AND x.user_id = e.user_id
          AND x.audience = e.audience AND x.license_version = e.license_version AND x.license_lang = e.license_lang));
  -- Exact locale set: nothing live outside the snapshot...
  SELECT RAISE(ABORT, 'live locale outside the consented snapshot')
  WHERE EXISTS (
    SELECT 1 FROM recipe_locales l
    WHERE l.recipe_id = NEW.recipe_id AND l.status <> 'rejected'
      AND NOT EXISTS (SELECT 1 FROM json_each(json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.locales')) k WHERE k.key = l.country || ':' || l.lang));
  -- ...and every consented locale present live.
  SELECT RAISE(ABORT, 'consented locale missing from live rows')
  WHERE EXISTS (
    SELECT 1 FROM json_each(json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.locales')) k
    WHERE NOT EXISTS (SELECT 1 FROM recipe_locales l WHERE l.recipe_id = NEW.recipe_id AND l.status <> 'rejected' AND l.country || ':' || l.lang = k.key));
  -- Full content equality for every consented locale (title, slug, intro,
  -- ingredients, steps - verbatim).
  SELECT RAISE(ABORT, 'live locale content drifted from the consented snapshot')
  WHERE EXISTS (
    SELECT 1 FROM json_each(json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.locales')) k
    JOIN recipe_locales l ON l.recipe_id = NEW.recipe_id AND l.status <> 'rejected' AND l.country || ':' || l.lang = k.key
    WHERE json_extract(k.value, '$.title') <> l.title
       OR json_extract(k.value, '$.slug') <> l.slug
       OR IFNULL(json_extract(k.value, '$.intro'), '') <> IFNULL(l.intro, '')
       OR json_extract(k.value, '$.ingredients_json') <> l.ingredients_json
       OR json_extract(k.value, '$.steps_json') <> l.steps_json);
  -- Recipe-level fields equal the snapshot (timing, yield, category, author).
  SELECT RAISE(ABORT, 'recipe fields drifted from the consented snapshot')
  WHERE EXISTS (
    SELECT 1 FROM recipes o
    WHERE o.id = NEW.recipe_id AND (
      IFNULL(o.origin_country, '') <> IFNULL(json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.recipe.origin_country'), '')
      OR IFNULL(o.category, '') <> IFNULL(json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.recipe.category'), '')
      OR IFNULL(o.prep_minutes, -1) <> IFNULL(json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.recipe.prep_minutes'), -1)
      OR IFNULL(o.cook_minutes, -1) <> IFNULL(json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.recipe.cook_minutes'), -1)
      OR IFNULL(o.rest_minutes, -1) <> IFNULL(json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.recipe.rest_minutes'), -1)
      OR IFNULL(o.total_minutes, -1) <> IFNULL(json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.recipe.total_minutes'), -1)
      OR IFNULL(o.base_servings, -1) <> IFNULL(json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.recipe.base_servings'), -1)
      OR IFNULL(o.author_name, '') <> IFNULL(json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.recipe.author_name'), '')));
  -- Source rights metadata equals the snapshot.
  SELECT RAISE(ABORT, 'source metadata drifted from the consented snapshot')
  WHERE EXISTS (
    SELECT 1 FROM sources s JOIN recipes o ON o.source_id = s.id
    WHERE o.id = NEW.recipe_id AND (
      s.name <> json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.source.name')
      OR s.url <> json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.source.url')
      OR s.license <> json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.source.license')));
  -- The sealed manifest rows equal the snapshot image manifest exactly.
  SELECT RAISE(ABORT, 'image manifest drifted from the consented snapshot')
  WHERE (SELECT count(*) FROM recipe_revision_images WHERE revision_id = NEW.revision_id)
        <> (SELECT count(*) FROM json_each(json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.images')))
     OR EXISTS (
       SELECT 1 FROM json_each(json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.images')) m
       WHERE NOT EXISTS (
         SELECT 1 FROM recipe_revision_images i WHERE i.revision_id = NEW.revision_id
           AND i.image_id = json_extract(m.value, '$.image_id')
           AND i.role = json_extract(m.value, '$.role')
           AND IFNULL(i.step_index, -1) = IFNULL(json_extract(m.value, '$.step_index'), -1)
           AND i.style = json_extract(m.value, '$.style')
           AND i.source_name = json_extract(m.value, '$.source_name')
           AND i.source_url = json_extract(m.value, '$.source_url')
           AND i.license = json_extract(m.value, '$.license')
           AND i.sha256 = json_extract(m.value, '$.sha256')));
END;

-- Per-row publish guard: every draft->published flip must trace to a valid
-- publish request on the current head with a fresh exact-tuple grant by the
-- current owner, and the row's content must equal the consented snapshot
-- entry for its locale key. This guards EVERY writer, not just the flow.
CREATE TRIGGER recipe_locales_publish_guard BEFORE UPDATE OF status ON recipe_locales
WHEN NEW.status = 'published' AND OLD.status <> 'published'
BEGIN
  SELECT RAISE(ABORT, 'publish guard failed')
  WHERE NOT EXISTS (
    SELECT 1
    FROM publish_requests p
    JOIN recipe_revisions r ON r.id = p.revision_id AND r.recipe_id = p.recipe_id
    JOIN recipe_consent_events e ON e.recipe_id = p.recipe_id AND e.revision_id = p.revision_id
      AND e.user_id = p.requested_by AND e.audience = 'public'
      AND e.license_version = p.license_version AND e.license_lang = p.license_lang AND e.event = 'grant'
      AND e.consent_seq = (SELECT MAX(consent_seq) FROM recipe_consent_events x
        WHERE x.recipe_id = e.recipe_id AND x.revision_id = e.revision_id AND x.user_id = e.user_id
          AND x.audience = e.audience AND x.license_version = e.license_version AND x.license_lang = e.license_lang)
    WHERE p.recipe_id = NEW.recipe_id
      AND p.requested_by = (SELECT owner_user_id FROM recipes WHERE id = NEW.recipe_id)
      AND r.seq = (SELECT MAX(seq) FROM recipe_revisions WHERE recipe_id = NEW.recipe_id)
      AND EXISTS (SELECT 1 FROM json_each(json_extract(r.snapshot_json, '$.locales')) k
        WHERE k.key = NEW.country || ':' || NEW.lang
          AND json_extract(k.value, '$.title') = NEW.title
          AND json_extract(k.value, '$.slug') = NEW.slug
          AND IFNULL(json_extract(k.value, '$.intro'), '') = IFNULL(NEW.intro, '')
          AND json_extract(k.value, '$.ingredients_json') = NEW.ingredients_json
          AND json_extract(k.value, '$.steps_json') = NEW.steps_json));
END;

-- Published content is immutable: a status='published' row's text can never
-- change. A correction is a new revision + new consent + new publish of a
-- still-draft row (the draft-overlay flow for editing live recipes is a
-- separate reviewed increment).
CREATE TRIGGER recipe_locales_no_content_mutation BEFORE UPDATE ON recipe_locales
WHEN OLD.status = 'published' AND (
  NEW.title <> OLD.title OR NEW.slug <> OLD.slug
  OR IFNULL(NEW.intro, '') <> IFNULL(OLD.intro, '')
  OR NEW.ingredients_json <> OLD.ingredients_json OR NEW.steps_json <> OLD.steps_json)
BEGIN
  SELECT RAISE(ABORT, 'published content is immutable');
END;

-- Append-only enforcement (executable, not comments): revisions, their image
-- manifests, consent events and publish requests can never be updated or
-- deleted. Revocation is a new event; correction is a new revision. The
-- reviewed erasure migration will own the controlled exception path
-- (drop/replace these triggers inside its own flow) - nothing here
-- anticipates it.
CREATE TRIGGER recipe_revisions_no_update BEFORE UPDATE ON recipe_revisions
BEGIN SELECT RAISE(ABORT, 'recipe_revisions is append-only'); END;
CREATE TRIGGER recipe_revisions_no_delete BEFORE DELETE ON recipe_revisions
BEGIN SELECT RAISE(ABORT, 'recipe_revisions is append-only'); END;
CREATE TRIGGER recipe_revision_images_no_update BEFORE UPDATE ON recipe_revision_images
BEGIN SELECT RAISE(ABORT, 'recipe_revision_images is append-only'); END;
CREATE TRIGGER recipe_revision_images_no_delete BEFORE DELETE ON recipe_revision_images
BEGIN SELECT RAISE(ABORT, 'recipe_revision_images is append-only'); END;
CREATE TRIGGER recipe_consent_events_no_update BEFORE UPDATE ON recipe_consent_events
BEGIN SELECT RAISE(ABORT, 'recipe_consent_events is append-only'); END;
CREATE TRIGGER recipe_consent_events_no_delete BEFORE DELETE ON recipe_consent_events
BEGIN SELECT RAISE(ABORT, 'recipe_consent_events is append-only'); END;
CREATE TRIGGER publish_requests_no_update BEFORE UPDATE ON publish_requests
BEGIN SELECT RAISE(ABORT, 'publish_requests is append-only'); END;
CREATE TRIGGER publish_requests_no_delete BEFORE DELETE ON publish_requests
BEGIN SELECT RAISE(ABORT, 'publish_requests is append-only'); END;
