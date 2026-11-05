-- REV 15 DESIGN - return-for-corrections with an enforced re-consent barrier
-- (design/0011 G9; option A). DESIGN ONLY: never applied to a live database
-- in this branch; its semantics are proven by
-- packages/api/src/corrections-epoch-probe.test.ts on node:sqlite.
--
-- Problem (proven by fence-writers.test.ts): after ANY admin change to a
-- submitted draft the owner cannot re-grant (recipe_revisions_guard requires
-- submitted_at IS NULL) and the admin cannot publish (the flip guard's
-- canonical predicate fails) - the recipe is stuck, and no return path
-- exists. A naive "clear submitted_at" return is unsound: hash, head
-- revision and the consent tuple are unchanged, so an unchanged return +
-- resubmit could publish on the OLD grant, and unconsumed pre-return
-- publish requests stayed live.
--
-- Design: a corrections epoch + a unique, durable, consume-once return
-- operation. Every publish/consent currency predicate (request, flip,
-- serving view - both scopes) additionally requires the consent event's
-- epoch AND the request's epoch to equal the recipe's current
-- corrections_epoch. The ONLY way to advance the epoch is one validated
-- return operation, and transition + op consumption + audit row are ONE
-- SQL-enforced atomic unit (trigger-owned), not a service-batch claim.
--
-- LAYER BOUNDARY, explicit: SQL enforces state, tuples, epochs, marker and
-- atomicity. The AUTHENTICATED actor and admin ROLE are the MCP tool
-- boundary's job (existing callTool ROLE_RANK check, 403 for editor/
-- viewer); the tool binds op.actor from the authenticated key identity,
-- exactly like auditStmt - it is NEVER caller-supplied free text. An FK to
-- users would NOT be authenticated-admin authority, so actor is opaque
-- TEXT at the SQL layer.

ALTER TABLE recipes ADD COLUMN corrections_epoch INTEGER NOT NULL DEFAULT 0;
-- NULL means VERIFIED never published (the recipe's whole life postdates
-- the stamp trigger). Anything else means published at least once - or
-- UNKNOWN (legacy sentinel), which fails closed out of the return flow.
ALTER TABLE recipes ADD COLUMN first_published_at TEXT;
ALTER TABLE recipe_consent_events ADD COLUMN epoch INTEGER NOT NULL DEFAULT 0;
ALTER TABLE publish_requests ADD COLUMN epoch INTEGER NOT NULL DEFAULT 0;

-- MIGRATION CLASSIFICATION, executed at apply time over pre-existing rows
-- (BEFORE the guards below exist and BEFORE the return tool ever mounts;
-- in a database whose data all postdates this migration these statements
-- match zero rows). Unknown history fails closed with the sentinel; only
-- recipes created after recipe_first_publish_stamp exists keep a
-- trustworthy NULL. These UPDATEs also fire the 0010 fence bump, which is
-- harmless pre-flag (monotonic seq; no forms displayed yet).
UPDATE recipes SET first_published_at = datetime('now')
WHERE EXISTS (SELECT 1 FROM recipe_locales l WHERE l.recipe_id = recipes.id AND l.status = 'published');
UPDATE recipes SET first_published_at = '1900-01-01T00:00:00Z' WHERE first_published_at IS NULL;

-- The durable marker: stamped at EVERY actual draft->published transition
-- on every write path, because it is a table trigger.
CREATE TRIGGER recipe_first_publish_stamp AFTER UPDATE OF status ON recipe_locales
WHEN NEW.status = 'published' AND OLD.status <> 'published'
BEGIN
  UPDATE recipes SET first_published_at = COALESCE(first_published_at, datetime('now')) WHERE id = NEW.recipe_id;
END;

-- The marker is trusted history: NULL -> stamp only, never cleared, never
-- changed, never forged on INSERT, never reset by INSERT OR REPLACE.
CREATE TRIGGER recipes_first_published_immutable BEFORE UPDATE OF first_published_at ON recipes
WHEN OLD.first_published_at IS NOT NULL AND NEW.first_published_at IS NOT OLD.first_published_at
BEGIN SELECT RAISE(ABORT, 'first_published_at is stamped once and never changed'); END;

CREATE TRIGGER recipes_first_published_insert_guard BEFORE INSERT ON recipes
WHEN NEW.first_published_at IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'first_published_at comes only from the publish stamp or the migration classification'); END;

-- Every recipe starts at epoch 0, caller-independent: no INSERT (direct,
-- OR REPLACE, legacy writer) can introduce a nonzero epoch.
CREATE TRIGGER recipes_epoch_init_guard BEFORE INSERT ON recipes
WHEN NEW.corrections_epoch <> 0
BEGIN SELECT RAISE(ABORT, 'corrections_epoch starts at 0 for every recipe'); END;

-- INSERT OR REPLACE can never silently reset guarded flow state (epoch,
-- marker, submission). The existing published-content guards (0007) are
-- retained; this covers the flow fields they do not.
CREATE TRIGGER recipes_flow_state_no_replace BEFORE INSERT ON recipes
WHEN EXISTS (
  SELECT 1 FROM recipes o WHERE o.id = NEW.id
    AND (o.corrections_epoch IS NOT NEW.corrections_epoch
      OR o.first_published_at IS NOT NEW.first_published_at
      OR o.submitted_at IS NOT NEW.submitted_at))
BEGIN SELECT RAISE(ABORT, 'INSERT OR REPLACE cannot reset guarded flow state; DELETE and INSERT with a new id instead'); END;

-- The return operation: unique durable identity, append-only, consume-once,
-- at most ONE pending op per recipe. The INSERT trigger is the SQL
-- assertion of the FULL expected tuple against current state - every
-- mismatch RAISEs inside the batch, so a losing race, a stale expectation
-- or a replay has ZERO effects (no op row, no transition, no audit).
CREATE TABLE return_operations (
  op_id               TEXT PRIMARY KEY,
  recipe_id           TEXT NOT NULL REFERENCES recipes(id),
  expected_owner      TEXT NOT NULL,
  expected_head       TEXT,      -- NULL when the recipe has no revision yet
  expected_head_seq   INTEGER,   -- NULL when the recipe has no revision yet
  expected_epoch      INTEGER NOT NULL,
  expected_submission TEXT NOT NULL,
  actor               TEXT NOT NULL,  -- authenticated admin key identity, bound at the MCP boundary (see LAYER BOUNDARY)
  note                TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  consumed_at         TEXT
);

CREATE TRIGGER return_operations_insert_guard BEFORE INSERT ON return_operations
BEGIN
  SELECT RAISE(ABORT, 'return_operations is append-only')
  WHERE EXISTS (SELECT 1 FROM return_operations x WHERE x.op_id = NEW.op_id);
  SELECT RAISE(ABORT, 'a pending return operation already exists for this recipe')
  WHERE EXISTS (SELECT 1 FROM return_operations x WHERE x.recipe_id = NEW.recipe_id AND x.consumed_at IS NULL);
  SELECT RAISE(ABORT, 'actor and note required (note 500 chars max)')
  WHERE length(trim(NEW.actor)) = 0 OR length(trim(NEW.note)) = 0 OR length(NEW.note) > 500;
  SELECT RAISE(ABORT, 'return operation expectation does not match current state')
  WHERE NOT EXISTS (
    SELECT 1 FROM recipes o
    WHERE o.id = NEW.recipe_id
      AND o.owner_user_id IS NOT NULL                 -- current owner required; ownerless catalog EXCLUDED
      AND o.owner_user_id = NEW.expected_owner
      AND o.submitted_at IS NOT NULL                  -- actually submitted
      AND o.submitted_at = NEW.expected_submission
      AND o.corrections_epoch = NEW.expected_epoch
      AND o.first_published_at IS NULL                -- durable VERIFIED-never-published
      AND NOT EXISTS (SELECT 1 FROM recipe_locales l WHERE l.recipe_id = o.id AND l.status = 'published')
      AND (SELECT MAX(seq) FROM recipe_revisions r WHERE r.recipe_id = o.id) IS NEW.expected_head_seq
      AND (SELECT r.id FROM recipe_revisions r WHERE r.recipe_id = o.id ORDER BY seq DESC LIMIT 1) IS NEW.expected_head);
END;

-- Consumption is valid ONLY as part of a completed epoch transition: the
-- recipe must already show exactly this op's expected_epoch + 1 with
-- submitted_at cleared. A standalone consume (no transition) aborts.
CREATE TRIGGER return_operations_consume_only BEFORE UPDATE ON return_operations
WHEN NOT (OLD.consumed_at IS NULL AND NEW.consumed_at IS NOT NULL
  AND NEW.op_id = OLD.op_id AND NEW.recipe_id = OLD.recipe_id
  AND NEW.expected_owner = OLD.expected_owner
  AND NEW.expected_head IS OLD.expected_head
  AND NEW.expected_head_seq IS OLD.expected_head_seq
  AND NEW.expected_epoch = OLD.expected_epoch
  AND NEW.expected_submission = OLD.expected_submission
  AND NEW.actor = OLD.actor AND NEW.note = OLD.note
  AND EXISTS (SELECT 1 FROM recipes o WHERE o.id = OLD.recipe_id
    AND o.corrections_epoch = OLD.expected_epoch + 1 AND o.submitted_at IS NULL))
BEGIN SELECT RAISE(ABORT, 'return_operations are consumed only by their epoch transition'); END;

CREATE TRIGGER return_operations_no_delete BEFORE DELETE ON return_operations
BEGIN SELECT RAISE(ABORT, 'return_operations is append-only'); END;

-- The SQL entry guard: the epoch advances ONLY through the exact audited
-- return shape AND with a validated, unconsumed operation whose tuple
-- matches this row's current state. Shape alone is not authority - the op
-- binds it. Direct writes, decreases, and op-less transitions abort for
-- EVERY writer, including legacy ones.
CREATE TRIGGER recipes_epoch_transition_guard BEFORE UPDATE OF corrections_epoch ON recipes
WHEN NOT (
  NEW.corrections_epoch = OLD.corrections_epoch + 1
  AND OLD.submitted_at IS NOT NULL AND NEW.submitted_at IS NULL
  AND OLD.owner_user_id IS NOT NULL AND NEW.owner_user_id IS OLD.owner_user_id
  AND NEW.id = OLD.id
  AND OLD.first_published_at IS NULL
  AND EXISTS (
    SELECT 1 FROM return_operations ro
    WHERE ro.recipe_id = OLD.id AND ro.consumed_at IS NULL
      AND ro.expected_owner = OLD.owner_user_id
      AND ro.expected_epoch = OLD.corrections_epoch
      AND ro.expected_submission = OLD.submitted_at
      AND ro.expected_head_seq IS (SELECT MAX(seq) FROM recipe_revisions r WHERE r.recipe_id = OLD.id)
      AND ro.expected_head IS (SELECT r.id FROM recipe_revisions r WHERE r.recipe_id = OLD.id ORDER BY seq DESC LIMIT 1)))
BEGIN SELECT RAISE(ABORT, 'corrections_epoch advances only through a validated return operation'); END;

-- Transition-owned consume + audit: ONE SQL-enforced atomic unit. The
-- transition, the op consumption and the audit row all live in this
-- trigger - a completed transition ALWAYS has its audit, and the audit's
-- actor is copied from the validated op, never supplied at transition
-- time. (At most one pending op per recipe, so the match is unique.)
CREATE TRIGGER recipes_epoch_transition_apply AFTER UPDATE OF corrections_epoch ON recipes
WHEN NEW.corrections_epoch = OLD.corrections_epoch + 1
BEGIN
  UPDATE return_operations SET consumed_at = datetime('now')
  WHERE recipe_id = NEW.id AND consumed_at IS NULL
    AND expected_owner = NEW.owner_user_id
    AND expected_epoch = OLD.corrections_epoch
    AND expected_submission = OLD.submitted_at
    AND expected_head_seq IS (SELECT MAX(seq) FROM recipe_revisions r WHERE r.recipe_id = NEW.id)
    AND expected_head IS (SELECT r.id FROM recipe_revisions r WHERE r.recipe_id = NEW.id ORDER BY seq DESC LIMIT 1);
  INSERT INTO mcp_audit (actor, role, tool, entity_id, details_json)
  SELECT ro.actor, 'admin', 'recipes.return_for_corrections', ro.recipe_id,
         json_object('note', ro.note, 'op_id', ro.op_id, 'old_epoch', OLD.corrections_epoch, 'new_epoch', NEW.corrections_epoch)
  FROM return_operations ro
  WHERE ro.recipe_id = NEW.id AND ro.consumed_at IS NOT NULL
    AND ro.expected_epoch = OLD.corrections_epoch
    AND NOT EXISTS (SELECT 1 FROM mcp_audit a WHERE a.tool = 'recipes.return_for_corrections'
                    AND json_extract(a.details_json, '$.op_id') = ro.op_id);
END;

-- Audit integrity for this tool: no spoofed rows (only a consumed op can
-- back one), no edits, no deletes, no second row for the same op.
CREATE TRIGGER mcp_audit_return_insert_guard BEFORE INSERT ON mcp_audit
WHEN NEW.tool = 'recipes.return_for_corrections'
  AND (NOT EXISTS (
         SELECT 1 FROM return_operations ro
         WHERE ro.op_id = json_extract(NEW.details_json, '$.op_id')
           AND ro.recipe_id = NEW.entity_id AND ro.consumed_at IS NOT NULL AND ro.actor = NEW.actor)
       OR EXISTS (
         SELECT 1 FROM mcp_audit a2
         WHERE a2.tool = 'recipes.return_for_corrections'
           AND json_extract(a2.details_json, '$.op_id') = json_extract(NEW.details_json, '$.op_id')))
BEGIN SELECT RAISE(ABORT, 'return-for-corrections audit rows come only from the transition trigger'); END;

-- Both directions: no edit OF a return row (OLD.tool) and no edit turning any
-- other row INTO one (NEW.tool).
CREATE TRIGGER mcp_audit_return_no_update BEFORE UPDATE ON mcp_audit
WHEN OLD.tool = 'recipes.return_for_corrections'
  OR NEW.tool = 'recipes.return_for_corrections'
BEGIN SELECT RAISE(ABORT, 'return-for-corrections audit is immutable'); END;

CREATE TRIGGER mcp_audit_return_no_delete BEFORE DELETE ON mcp_audit
WHEN OLD.tool = 'recipes.return_for_corrections'
BEGIN SELECT RAISE(ABORT, 'return-for-corrections audit is immutable'); END;

-- Rowid collision modes (mcp_audit's only unique is id INTEGER PRIMARY KEY):
-- INSERT OR REPLACE with an existing return row's id would delete+replace it
-- (the delete trigger does NOT fire under REPLACE with recursive_triggers
-- off), and UPDATE OR REPLACE SET id = <return row id> would delete the
-- return row while OLD.tool belongs to the moved row. BEFORE triggers fire
-- before conflict resolution, so these guards abort every collision mode.
CREATE TRIGGER mcp_audit_return_insert_collision_guard BEFORE INSERT ON mcp_audit
WHEN EXISTS (SELECT 1 FROM mcp_audit a WHERE a.id = NEW.id AND a.tool = 'recipes.return_for_corrections')
BEGIN SELECT RAISE(ABORT, 'return-for-corrections audit is immutable'); END;

CREATE TRIGGER mcp_audit_return_update_collision_guard BEFORE UPDATE OF id ON mcp_audit
WHEN NEW.id <> OLD.id
  AND EXISTS (SELECT 1 FROM mcp_audit a WHERE a.id = NEW.id AND a.tool = 'recipes.return_for_corrections')
BEGIN SELECT RAISE(ABORT, 'return-for-corrections audit is immutable'); END;

-- Epoch integrity: no path (app bug or legacy writer) can stamp a consent
-- event or publish request at any epoch but the recipe's current one.
CREATE TRIGGER consent_events_epoch_check BEFORE INSERT ON recipe_consent_events
WHEN NEW.epoch <> (SELECT corrections_epoch FROM recipes WHERE id = NEW.recipe_id)
BEGIN SELECT RAISE(ABORT, 'consent epoch must equal the recipe current corrections_epoch'); END;

CREATE TRIGGER publish_requests_epoch_check BEFORE INSERT ON publish_requests
WHEN NEW.epoch <> (SELECT corrections_epoch FROM recipes WHERE id = NEW.recipe_id)
BEGIN SELECT RAISE(ABORT, 'request epoch must equal the recipe current corrections_epoch'); END;

-- Amended currency predicates: the qualified 0007/0008 checks are preserved
-- verbatim with ONLY the epoch conjuncts added (request time, flip time and
-- serving view; text and images scopes). These amendments re-qualify under
-- corrections-epoch-probe.test.ts before any apply.
DROP TRIGGER publish_assert;
CREATE TRIGGER publish_assert BEFORE INSERT ON publish_requests
BEGIN
  SELECT RAISE(ABORT, 'request epoch is not the recipe current corrections_epoch')
  WHERE NEW.epoch <> (SELECT corrections_epoch FROM recipes WHERE id = NEW.recipe_id);
  SELECT RAISE(ABORT, 'ownerless catalog recipes publish through the admin flow (module I), not this slice')
  WHERE (SELECT owner_user_id FROM recipes WHERE id = NEW.recipe_id) IS NULL;
  SELECT RAISE(ABORT, 'revision is not the current head')
  WHERE NEW.revision_id <> (SELECT id FROM recipe_revisions WHERE recipe_id = NEW.recipe_id ORDER BY seq DESC LIMIT 1);
  SELECT RAISE(ABORT, 'no current grant from the current owner for this exact revision and license')
  WHERE NOT EXISTS (
    SELECT 1 FROM recipe_consent_events e
    WHERE e.recipe_id = NEW.recipe_id AND e.revision_id = NEW.revision_id
      AND e.user_id = (SELECT owner_user_id FROM recipes WHERE id = NEW.recipe_id)
      AND e.audience = 'public' AND e.license_version = NEW.license_version AND e.license_lang = NEW.license_lang
      AND e.event = 'grant'
          AND e.epoch = (SELECT corrections_epoch FROM recipes WHERE id = e.recipe_id)
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
    WHERE json_extract(k.value, '$.title') IS NOT l.title
       OR json_extract(k.value, '$.slug') IS NOT l.slug
       OR IFNULL(json_extract(k.value, '$.intro'), '') IS NOT IFNULL(l.intro, '')
       OR json_extract(k.value, '$.ingredients_json') IS NOT l.ingredients_json
       OR json_extract(k.value, '$.steps_json') IS NOT l.steps_json);
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
      s.name IS NOT json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.source.name')
      OR s.url IS NOT json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.source.url')
      OR s.license IS NOT json_extract((SELECT snapshot_json FROM recipe_revisions WHERE id = NEW.revision_id), '$.source.license')));
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

DROP TRIGGER publish_assert_scope;
CREATE TRIGGER publish_assert_scope BEFORE INSERT ON publish_requests
BEGIN
  SELECT RAISE(ABORT, 'request epoch is not the recipe current corrections_epoch')
  WHERE NEW.epoch <> (SELECT corrections_epoch FROM recipes WHERE id = NEW.recipe_id);
  SELECT RAISE(ABORT, 'no current text-scope grant from the current owner for this exact revision and license')
  WHERE NOT EXISTS (
    SELECT 1 FROM recipe_consent_events e
    WHERE e.recipe_id = NEW.recipe_id AND e.revision_id = NEW.revision_id
      AND e.user_id = (SELECT owner_user_id FROM recipes WHERE id = NEW.recipe_id)
      AND e.audience = 'public' AND e.license_version = NEW.license_version AND e.license_lang = NEW.license_lang
      AND e.scope = 'text' AND e.event = 'grant'
          AND e.epoch = (SELECT corrections_epoch FROM recipes WHERE id = e.recipe_id)
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
      AND p.epoch = (SELECT corrections_epoch FROM recipes WHERE id = p.recipe_id)
      AND r.seq = (SELECT MAX(seq) FROM recipe_revisions WHERE recipe_id = NEW.recipe_id)
      -- current grant by the current owner for this exact revision and license
      AND EXISTS (
        SELECT 1 FROM recipe_consent_events e
        WHERE e.recipe_id = p.recipe_id AND e.revision_id = p.revision_id
          AND e.user_id = (SELECT owner_user_id FROM recipes WHERE id = p.recipe_id)
          AND e.audience = 'public' AND e.license_version = p.license_version AND e.license_lang = p.license_lang
          AND e.scope = 'text' AND e.event = 'grant'
          AND e.epoch = (SELECT corrections_epoch FROM recipes WHERE id = e.recipe_id)
          AND e.consent_seq = (SELECT MAX(consent_seq) FROM recipe_consent_events x
            WHERE x.recipe_id = e.recipe_id AND x.revision_id = e.revision_id AND x.user_id = e.user_id
              AND x.audience = e.audience AND x.license_version = e.license_version AND x.license_lang = e.license_lang
              AND x.scope = e.scope))
      -- when the head revision binds images, a current images-scope grant by
      -- the current owner for the same exact revision and license is also
      -- required at this enforcement point
      AND (
        NOT EXISTS (SELECT 1 FROM recipe_revision_images ri WHERE ri.revision_id = p.revision_id)
        OR EXISTS (
          SELECT 1 FROM recipe_consent_events ei
          WHERE ei.recipe_id = p.recipe_id AND ei.revision_id = p.revision_id
            AND ei.user_id = (SELECT owner_user_id FROM recipes WHERE id = p.recipe_id)
            AND ei.audience = 'public' AND ei.license_version = p.license_version AND ei.license_lang = p.license_lang
            AND ei.scope = 'images' AND ei.event = 'grant'
            AND ei.epoch = (SELECT corrections_epoch FROM recipes WHERE id = ei.recipe_id)
            AND ei.consent_seq = (SELECT MAX(consent_seq) FROM recipe_consent_events xi
              WHERE xi.recipe_id = ei.recipe_id AND xi.revision_id = ei.revision_id AND xi.user_id = ei.user_id
                AND xi.audience = ei.audience AND xi.license_version = ei.license_version AND xi.license_lang = ei.license_lang
                AND xi.scope = ei.scope)))
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
      AND e.epoch = (SELECT corrections_epoch FROM recipes WHERE id = e.recipe_id)
      AND e.consent_seq = (SELECT MAX(consent_seq) FROM recipe_consent_events x
        WHERE x.recipe_id = e.recipe_id AND x.revision_id = e.revision_id AND x.user_id = e.user_id
          AND x.audience = e.audience AND x.license_version = e.license_version AND x.license_lang = e.license_lang
          AND x.scope = e.scope)
    WHERE p.recipe_id = l.recipe_id
      AND r.seq = (SELECT MAX(seq) FROM recipe_revisions WHERE recipe_id = l.recipe_id)
      AND p.epoch = (SELECT corrections_epoch FROM recipes WHERE id = p.recipe_id)
      -- when the head revision binds images, a current images-scope grant by
      -- the current owner for the same exact revision and license is also
      -- required at this enforcement point
      AND (
        NOT EXISTS (SELECT 1 FROM recipe_revision_images ri WHERE ri.revision_id = p.revision_id)
        OR EXISTS (
          SELECT 1 FROM recipe_consent_events ei
          WHERE ei.recipe_id = p.recipe_id AND ei.revision_id = p.revision_id
            AND ei.user_id = (SELECT owner_user_id FROM recipes WHERE id = p.recipe_id)
            AND ei.audience = 'public' AND ei.license_version = p.license_version AND ei.license_lang = p.license_lang
            AND ei.scope = 'images' AND ei.event = 'grant'
            AND ei.epoch = (SELECT corrections_epoch FROM recipes WHERE id = ei.recipe_id)
            AND ei.consent_seq = (SELECT MAX(consent_seq) FROM recipe_consent_events xi
              WHERE xi.recipe_id = ei.recipe_id AND xi.revision_id = ei.revision_id AND xi.user_id = ei.user_id
                AND xi.audience = ei.audience AND xi.license_version = ei.license_version AND xi.license_lang = ei.license_lang
                AND xi.scope = ei.scope)))
      AND EXISTS (SELECT 1 FROM json_each(json_extract(r.snapshot_json, '$.locales')) k WHERE k.key = l.country || ':' || l.lang));
