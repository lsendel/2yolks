-- DRAFT REVIEW SPEC ONLY. Deliberately outside packages/api/migrations.
-- Do not execute on local/staging/production stores under draft-code approval.
-- Adapter transaction design, live-schema inventory, backup/restore, privacy
-- review and separate migration authorization must precede a runnable migration.
CREATE TABLE private_families (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_user_id TEXT NOT NULL REFERENCES users(id),
 state TEXT NOT NULL CHECK(state IN ('active','closed')), revision INTEGER NOT NULL CHECK(revision>0)
);
CREATE TABLE private_family_members (
 family_id TEXT NOT NULL REFERENCES private_families(id), user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),
 state TEXT NOT NULL CHECK(state IN ('active','removed')), revision INTEGER NOT NULL CHECK(revision>0),
 PRIMARY KEY(family_id,user_id)
);
CREATE TABLE private_family_join_requests (
 id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES private_families(id), requester_user_id TEXT NOT NULL REFERENCES users(id),
 token_hash TEXT UNIQUE, expires_at INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','approved','rejected','revoked')),
 decided_by TEXT REFERENCES users(id), revision INTEGER NOT NULL CHECK(revision>0)
);
CREATE TABLE private_recipe_versions (
 id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id), parent_id TEXT REFERENCES private_recipe_versions(id),
 digest TEXT NOT NULL, recipe_json TEXT NOT NULL, created_at INTEGER NOT NULL,
 UNIQUE(id,digest)
);
CREATE TABLE private_recipe_candidates (
 id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id), family_id TEXT NOT NULL REFERENCES private_families(id),
 submitted_version_id TEXT NOT NULL REFERENCES private_recipe_versions(id), improved_version_id TEXT REFERENCES private_recipe_versions(id),
 state TEXT NOT NULL CHECK(state IN ('draft','received','in_review','needs_changes','declined','awaiting_contributor','family_shared','withdrawn')),
 revision INTEGER NOT NULL CHECK(revision>0), updated_at INTEGER NOT NULL
);
CREATE TABLE private_recipe_media (
 id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES private_recipe_versions(id), owner_user_id TEXT NOT NULL REFERENCES users(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('recipe_source','dish_cover')), object_key TEXT NOT NULL UNIQUE,
 digest TEXT NOT NULL, mime TEXT NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp')),
 bytes INTEGER NOT NULL CHECK(bytes>0 AND bytes<=3145728), width INTEGER NOT NULL, height INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('quarantine','verified','rejected','deleted')),
 UNIQUE(version_id,purpose)
);
CREATE TABLE private_recipe_acceptances (
 id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL REFERENCES private_recipe_candidates(id), owner_user_id TEXT NOT NULL REFERENCES users(id),
 family_id TEXT NOT NULL REFERENCES private_families(id), version_id TEXT NOT NULL, digest TEXT NOT NULL,
 consent_version TEXT NOT NULL, accepted_at INTEGER NOT NULL,
 FOREIGN KEY(version_id,digest) REFERENCES private_recipe_versions(id,digest), UNIQUE(candidate_id,version_id,family_id)
);
CREATE TABLE private_family_recipe_shares (
 family_id TEXT NOT NULL REFERENCES private_families(id), candidate_id TEXT NOT NULL REFERENCES private_recipe_candidates(id),
 acceptance_id TEXT NOT NULL UNIQUE REFERENCES private_recipe_acceptances(id), revoked_at INTEGER,
 PRIMARY KEY(family_id,candidate_id)
);
CREATE TABLE private_operation_receipts (
 principal_user_id TEXT NOT NULL REFERENCES users(id), idempotency_key TEXT NOT NULL, request_digest TEXT NOT NULL,
 result_json TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(principal_user_id,idempotency_key)
);
-- Audit and rights attestations intentionally need privacy/retention design
-- before migration. No private text/media in public recipes/recipe_images.
