-- DESIGN REV 3 - smallest separable slice: immutable revisions + exact-content
-- consent for the PUBLIC audience only. Family, erasure and the mail outbox
-- are deliberately NOT in this slice; they ship behind separate reviewed
-- migrations. This file is design evidence, not wired into testd1/deploy.
--
-- Concurrency model (executable; proven by consent-design.test.ts race
-- negatives). D1 batch = one transaction whose statements run in order and
-- SEE each other's writes. Therefore a numeric head guard can only gate the
-- FIRST statement of a batch; every follow-up statement depends on the
-- batch's own first write instead (EXISTS on the just-inserted revision row),
-- so a lost race no-ops the whole batch statement by statement. The caller
-- asserts changes === 1 on every statement and returns 409 otherwise.
-- UNIQUE(recipe_id, seq) and UNIQUE(recipe_id, consent_seq) are the CAS
-- backstops for truly simultaneous commits. State transitions (submit,
-- publish) carry their head check as a live subquery on the current max
-- revision seq plus the exact-tuple consent guard in the same UPDATE - the
-- check is IN the state-changing SQL, never a prior read.

CREATE TABLE recipe_revisions (
  id            TEXT PRIMARY KEY,   -- fresh id per accepted edit; never reused across edits
  recipe_id     TEXT NOT NULL REFERENCES recipes(id),
  seq           INTEGER NOT NULL,   -- per-recipe head counter; UNIQUE below is the CAS backstop
  content_hash  TEXT NOT NULL,      -- sha256 hex over the canonical serialization (verbatim text, no normalization)
  snapshot_json TEXT NOT NULL,      -- verbatim cook text + full image manifest; private evidence, never publicly served
  created_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (recipe_id, seq),
  UNIQUE (id, recipe_id)            -- lets consent events FK to (revision, recipe) so a grant can never name a revision of another recipe
);

CREATE TABLE recipe_revision_images (
  revision_id TEXT NOT NULL REFERENCES recipe_revisions(id),
  image_id    TEXT NOT NULL REFERENCES recipe_images(id),
  role        TEXT NOT NULL CHECK (role IN ('hero','step')),
  step_index  INTEGER,
  style       TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url  TEXT NOT NULL,
  license     TEXT NOT NULL,
  sha256      TEXT NOT NULL,        -- digest of the exact R2 bytes bound at snapshot time
  PRIMARY KEY (revision_id, image_id)
);
-- Image bytes immutability is enforced at the writer, not trusted to comments:
-- r2_key is content-addressed (img/<sha256>.<ext>) and every writer must PUT
-- with onlyIf/ifNoneMatch:'*' (R2 conditional write) so an occupied key cannot
-- be overwritten. recipe_images has no UPDATE path (insert-only). Binding the
-- digest into content_hash means any substituted byte changes the hash and
-- invalidates consent; serving code never serves an unbound image id.

-- Append-only consent lifecycle, PUBLIC audience only in this slice.
CREATE TABLE recipe_consent_events (
  id              TEXT PRIMARY KEY,
  recipe_id       TEXT NOT NULL,
  revision_id     TEXT NOT NULL,
  consent_seq     INTEGER NOT NULL,  -- monotonic per recipe; UNIQUE is the CAS backstop
  event           TEXT NOT NULL CHECK (event IN ('grant','revoke')),
  user_id         TEXT NOT NULL REFERENCES users(id),
  audience        TEXT NOT NULL CHECK (audience IN ('public')),  -- family lands with its own reviewed migration
  license_version TEXT NOT NULL,
  license_lang    TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (recipe_id, consent_seq),
  FOREIGN KEY (revision_id, recipe_id) REFERENCES recipe_revisions(id, recipe_id)
);
-- A grant authorizes exactly one tuple: (recipe_id, revision_id, user_id,
-- audience, license_version, license_lang). A revoke names the same tuple.
-- Authoritative state = latest consent_seq event for that exact tuple.
-- Publish guard (inside the publish batch, not a prior read):
--   EXISTS (SELECT 1 FROM recipe_consent_events e
--           WHERE e.recipe_id = ?1 AND e.revision_id = ?2 AND e.user_id = ?3
--             AND e.audience = 'public' AND e.license_version = ?4 AND e.license_lang = ?5
--           ORDER BY e.consent_seq DESC LIMIT 1) ... and that row's event = 'grant'
-- (expressed in SQL as: latest event for the tuple IS a grant - see the test
-- file for the exact executable statement).
