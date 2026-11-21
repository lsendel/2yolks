# Account deletion plan (App Store 5.1.1(v))

Apps that support account creation must let users delete the account from
inside the app. 2yolks accounts support email-code, passkey, and Google OAuth
sign-in, so deletion must revoke every active session and remove all sign-in
credentials and personal account data while keeping the repo's standing rule
that recipe rows are never hard-deleted (draft "Remove" already works that way:
rows stay for review/audit).

## What this PR ships

- `packages/api/migrations/0016_account_deletion.sql`: adds
  `users.deleted_at TEXT`. Mark-only; no data moves.
- `tombstoneUser` in `packages/api/src/account.ts` (shared by both routes):
  runs a single atomic D1 batch that:
  - Tombstones `users`: rewrites `email` to `deleted+<id>@deleted.invalid`
    (undeliverable, preserves `UNIQUE(email)`, frees the real address for a
    fresh account later), clears `display_name`, stamps `deleted_at`, sets
    `marketing_opt_in = 0` and `unsubscribed_at`, and clears/revokes Zeluto CRM
    linkage (`zeluto_contact_id`, `zeluto_org_id`, `zeluto_connection_status`).
  - Deletes `sessions`, `auth_codes` (for the old email), `user_passkeys`,
    `user_oauth_accounts`, `auth_challenges` (for the user), `saved_recipes`,
    and `draft_photos` rows with `status = 'pending'`.
  - Marks `creator_subscribers.unsubscribed_at` where the deleted user was a
    subscriber.
  - Deletes any pending private `drafts/...` objects from the `IMAGES` R2 bucket.
  - Leaves `recipes`, approved public `recipe_images`, and `recipes.author_name`
    untouched for audit/provenance.
- `DELETE /api/v1/me/account` in `packages/api/src/appapi.ts`: replaces the
  `503 ACCOUNT_DELETION_UNAVAILABLE` stub with bearer-authenticated
  `tombstoneUser` and responds `{ ok: true }`.
- `POST /account/delete` in `packages/api/src/account.ts`:
  - Requires a signed-in session (`401` JSON / `303` redirect otherwise) and
    explicit `confirm=yes` (`400` otherwise).
  - Runs `tombstoneUser`, clears the session cookie, and returns `{ ok: true }`
    for `Accept: application/json` clients or a localized confirmation page
    (`en` / `es` / `fr`).
- Delete panel on the signed-in `/account` home page (`en` / `es` / `fr`).
- Tombstone guards across auth (`readSessionUser`, `bearerUser`), Zeluto sync
  (`/api/zeluto/sync/tenants`, `/api/zeluto/sync/records`), `/account/subscribers`,
  and `sendReviewNotice` (short-circuits `@deleted.invalid` before consuming mail
  budget).
- Tests in `packages/api/src/account.test.ts` and `packages/api/src/appapi.test.ts`.

## Explicitly NOT in this PR

- **No deploy.** The worker is not deployed by merging or pushing the branch.
- **Migration not applied.** Apply migration `0016` to production D1 BEFORE
  deploying the worker that carries this code:
  `CI=1 npx wrangler d1 migrations apply 2yolks --remote`
  Deploy order matters: the new routes write `deleted_at` and session lookups
  filter on `u.deleted_at IS NULL`, so the column must exist first.
- **No data deletion run.** Nothing executes against real user data.

## Rollout

1. Review PR #31 (`CI/build`, `CI/yolk-harvest`, `semgrep`, `Socket Security`).
2. Apply migration `0016_account_deletion.sql` to remote D1 (`CI=1 npx wrangler d1 migrations apply 2yolks --remote`).
3. Merge PR #31 and deploy the worker via `Deploy`.
4. Ship the `2yolks-ios` hookup (separate PR): confirm sheet ->
   `APIClient.deleteAccount()` -> `DELETE /api/v1/me/account` with the
   Keychain bearer token; on `{ ok: true }` drop the token locally and
   return to signed-out state.
5. App privacy answers: account deletion is self-serve and immediate.
