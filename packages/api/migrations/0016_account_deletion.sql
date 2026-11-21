-- Account deletion tombstone (App Store review guideline 5.1.1(v): apps that
-- support account creation must offer in-app account deletion).
-- Mark-only on users: deletion stamps users.deleted_at and anonymizes sign-in
-- fields in place while revoking sessions, credentials, bookmarks, and pending
-- private draft photos. Recipe rows stay for audit/provenance.
-- Apply to remote D1 BEFORE deploying the worker that carries this code:
--   CI=1 npx wrangler d1 migrations apply 2yolks --remote
ALTER TABLE users ADD COLUMN deleted_at TEXT;
