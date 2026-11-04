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

-- Append-only enforcement (executable, not comments): revisions, their image
-- manifests and consent events can never be updated or deleted. Revocation is
-- a new event; correction is a new revision. The reviewed erasure migration
-- will own the controlled exception path (drop/replace these triggers inside
-- its own flow) - nothing here anticipates it.
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

-- CAS model, revised after review counterexamples:
-- * The revision INSERT is a PLAIN insert (no guard clause): a stale head or
--   a same-id replay violates UNIQUE(recipe_id, seq) or the PK, which aborts
--   and rolls back the ENTIRE D1 batch - no half-applied state is possible,
--   and "the row exists" can never be mistaken for "this batch wrote it".
--   The caller catches the abort and returns 409.
-- * Follow-up statements carry their own live guards (owner + not-submitted)
--   and the caller asserts changes === 1 on each; a violated guard no-ops
--   that statement and the caller rejects the whole operation.
-- * The consent-event insert carries the same plain-insert + UNIQUE
--   (recipe_id, consent_seq) abort scheme, plus an owner-identity guard:
--   user_id must equal recipes.owner_user_id at insert time.
-- * Publish binds content, not just sequence: the transition UPDATE requires
--   the live locale row to EQUAL the bound revision's snapshot fields
--   (json_extract equality) plus the exact-tuple latest-event grant and the
--   head-revision check, all in the same SQL. A live row that drifted from
--   the consented snapshot cannot be published.
-- * Integration-time launch dependencies (explicit, not implemented here):
--   every mutation surface (account save, future user MCP, existing admin
--   MCP) must route content writes through revision creation; the R2
--   conditional writer (content-addressed key + ifNoneMatch '*') and
--   serving-bound enforcement (serve only images bound in the published
--   revision's manifest) are required before this slice can gate launch;
--   image-rights (cleared_at) checks stay as today until then.
