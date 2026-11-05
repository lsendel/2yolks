<!-- DESIGN ONLY (preparation, NOT applied to any live system). -->
# REV 13: C2 integration + rollout plan

Status of the qualified pins (independent review, isolated source/SQLite
evidence only): `e3860c8` on `feat/consent-flow` - 350/350 + tsc 0 + blob/SHA
integrity. This plan changes NO qualified behavior. Any later edit to
design/0007-0010, consent.ts, account.ts, or their tests re-enters
independent review.

## Qualified invariants this plan must not weaken

1. Consent events carry one scope (text|images); publish requires a current
   per-scope owner grant for the exact head revision at request time
   (publish_assert_scope), at every status flip (recipe_locales_publish_guard),
   and at serving time (recipe_locales_effective), with IMAGES required
   whenever the head revision's manifest binds images.
2. Provenance + digest are canonical (hash-bound) and sealed in the revision
   manifest; bound image fields are immutable (fill-in-once ratchet).
3. Grants seal ONE candidate built from ONE live read; shown_hash binds the
   displayed snapshot; the 0010 content fence aborts the atomic grant batch
   when any writer (any path, INSERT/UPDATE/DELETE/INSERT OR REPLACE; UPDATE
   cross-row collisions rejected) moved live state past the displayed seq.
4. The grant POST is validate-all-first, then one atomic batch.
5. Mail is reserved per kind AND under the combined 40/day site budget.
6. Fail-closed: flag default off (404), 503 without the design tables,
   withdrawal routes unmounted (policy wording pending).

## Remaining gates, with source dependencies

### G1. Real-D1 concurrency + rollout (BLOCKED on deploy credentials)
Qualified evidence is node:sqlite. Before any apply, verify on real D1:
batch atomicity, BEFORE/AFTER trigger semantics, RAISE(ABORT) rollback,
upsert DO UPDATE trigger firing, and FK enforcement (incl. same-key REPLACE
behavior that motivated the fence's no-FK design).
Migration shape (existing pattern: packages/api/migrations/000*.sql):
0007-0010 content as 0007-0010 migrations plus a backfill step:
INSERT OR IGNORE recipe_content_fence rows for all existing recipes (seq 0).
Data pre-checks named by 0007 itself: UNIQUE(recipe_id, seq) and
recipe_locales_one_per_recipe need a duplicate scan on live data first.
Cutover order: apply migrations (flag still off) -> smoke-test gates on the
staging worker -> enable CONSENT_FLOW_ENABLED on staging -> owner/account
acceptance -> production flag. Rollback at every step: flag off = 404,
fail-closed; the SQL remains inert.
Deploy-credential question to Luis is unanswered; no apply without it.

### G2. All-writers coverage verification
Writers to content tables today: account save route
(account.ts /recipes/save), MCP tools recipes.update_draft /
recipes.add_locale / recipes.set_image / sources.update /
sources.clear_rights, translations.mark_reviewed, the import route
(IMPORT_ENABLED), and publish/unpublish status flips. The fence and guards
are table-level triggers, so coverage is structural; the work here is one
regression per writer path proving the fence moves (and one proving each
legacy form POST conflicts), plus a lint rule or CI check that new migrations
touching content tables must extend design/0010-style coverage.

### G3. Conditional R2 + digest pipeline
Source: recipe_images.r2_key (UNIQUE), sha256 (0009), IMAGES binding,
recipes.set_image (mcp.ts:519+, audited), /img/recipe/:imageId
(index.ts:199+). Work: set_image writes R2 objects conditionally
(etag/If-None-Match) so a re-upload never overwrites a sealed key in place;
the digest pipeline seals sha256 at upload time; a backfill seals digests
for the 15 existing image rows (16 recipes, 15 with image as of Nov 4).
Undigested images stay excluded from snapshots (current behavior) and
unserved (cleared_at gate).

### G4. Strict manifest serving + required rights-cleared image
Today /img/recipe/:imageId has two gates (cleared_at AND a published locale).
Add a third, flag-gated, for consent-covered recipes: the image must be
bound in the published revision's manifest with non-null provenance, and
the serving check must use the same scoped predicate as
recipe_locales_effective (an images revocation stops image bytes too, not
only the locale row). This closes the "required rights-cleared image" launch
gate the reviewer kept open. Default off; no production read-path switch
without explicit approval.

### G5. Admin RBAC alignment
Source: mcp.ts roles viewer<editor<admin (ADMIN_MCP_API_KEY, MCP_NAMED_KEYS,
MCP_READ_KEY), auditStmt on every mutation. publishRevision's `actor` must
be the authenticated MCP identity (not a caller-supplied string), and
recipes.publish/unpublish must consume publish_requests (guard-enforced)
once 0007 is applied, instead of flipping status directly. RBAC itself is
the module-I launch gate; this plan only aligns the consent path with it.

### G6. Ownerless-catalog opt-in (POLICY GAP)
Today: 60-country catalog recipes have owner_user_id NULL; consent-design
tests prove ownerless recipes cannot enter the consent flow or create
revisions. Rollout needs Luis's decision: keep catalog publish under the
existing admin MCP path (consent-exempt by policy), or assign/opt-in owners.
Until answered, ownerless recipes keep today's behavior exactly.

### G7. Duplicates
The (country, lang, slug) PK already prevents duplicate slugs globally.
Duplicate CONTENT across recipes is a moderation concern: define a publish
-time review check (same content_hash across recipes -> flagged for review,
never auto-merged). No schema change needed; recipe_revisions.content_hash
already exists.

### G8. Erasure + family fine print + mail outbox (POLICY GAPS)
- Erasure: the verified-privacy-request permanent-deletion exception is
  design-text only. It must be reconciled with revision/consent audit
  retention (what is anonymized vs deleted, who verifies). Needs Luis's
  policy answer before any erasure route exists.
- Family fine print (families.care): untouched by this plan; any shared
  wording needs its own approval.
- Outbox: mail_log + reserveMail (per-kind caps + combined 40/day) already
  covers code/notice/receipt. No new email authority: receipts and review
  notices keep their existing recipients and wording; any new kind needs
  its own approval.

## Policy gaps blocking gates (owner: Luis, via main)
1. Withdrawal policy wording (hide-on-withdraw vs listed-with-notice) -
   blocks withdrawal routes. CLARIFICATION SENT, unanswered.
2. Deploy credentials for staging/production D1 + worker - blocks G1.
3. Ownerless-catalog stance - blocks G6.
4. Erasure retention policy - blocks G8.
5. Languages beyond en/es/fr, Apple sign-in, SMS, super-admin audience -
   open product decisions, not assumed.

## Explicit non-goals for this plan
No merge, no migration apply, no flag enable, no production read-path
switch, no deploy, no new email scope, no withdrawal mechanics.
