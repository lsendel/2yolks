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

### G1. Real-D1 concurrency + rollout (BLOCKED on staging-D1 + production-DB authority - NOT the Workers deploy-credential question)
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
acceptance -> production flag.
AUTHORITY (separate capabilities, each needs its own grant from Luis):
Workers deploy credentials are one question and do NOT include staging D1
provisioning, migration apply, test writes, account changes, or any
production DB authority - those are separate, unanswered questions.
ROLLBACK, corrected: once the migration SQL is applied, the triggers and the
effective view are LIVE even with the flag off - the flag gates only the
permission ROUTES. Rollback is therefore never "the SQL goes inert": it is
either a tested forward fix or a rehearsed trigger-drop migration. A
staging rehearsal of both rollback paths is a cutover precondition.

### G2. All-writers coverage verification + adoption strategy
Writers to content tables today: account form (account.ts /recipes/save,
/recipes/import under IMPORT_ENABLED, /recipes/:id/submit,
/recipes/:id/delete), the native app API (appapi.ts POST/PUT /me/recipes,
/me/recipes/:id/submit, DELETE /me/recipes/:id), MCP tools
recipes.update_draft / recipes.add_locale / recipes.set_image /
sources.update / sources.clear_rights, translations.mark_reviewed, and
publish/unpublish status flips. The fence and guards are table-level
triggers, so coverage is structural; the work here is one regression per
writer path proving the fence moves and each stale displayed form
conflicts, plus a structural test that every content table keeps its full
fence-trigger set as migrations evolve.
ADOPTION (distinct from fencing): the fence only invalidates stale consent
forms. Once consent is enabled, each legacy writer must either WRITE THROUGH
the revision model (every save produces a reviewed immutable revision) or be
explicitly rejected/disabled for consent-covered recipes - per writer:
account form + native save route through saveRevision; MCP edit tools route
through the same service or refuse owned recipes; import creates
unconsented drafts only. This adoption choice is reviewed with G2's tests
before any flag enable.
CAVEATS on the current G2 evidence (fence-writers.test.ts, 16 tests): it is
a fence SMOKE pass, not exhaustive all-writer/adoption proof. The
native POST /me/recipes create path and MCP recipes.create_draft are not
separately exercised (new-recipe INSERTs share the covered INSERT triggers
but have no dedicated regression); the import route's own write path is not
exercised (import/paste prefill flows end at the covered save route); the
trigger inventory detects a dropped or renamed trigger, not a changed
trigger BODY; MCP publish coverage is the negative fail-closed case only -
the positive publish path is exercised through the service layer, not
through any new publish wiring; and the adoption strategy above is
UNIMPLEMENTED. G2 is not complete.

### G3. Conditional R2 + digest pipeline
Source: recipe_images.r2_key (UNIQUE), sha256 (0009), IMAGES binding,
recipes.set_image (mcp.ts:519+, audited), /img/recipe/:imageId
(index.ts:199+). TODAY'S REALITY, stated plainly: the R2 put in set_image
(mcp.ts:944) is UNCONDITIONAL, and the /img gate serves any rights-cleared
image on a published recipe WITHOUT a digest, provenance, or manifest
binding - undigested images ARE served today. Work: conditional writes
(etag/If-None-Match) so a re-upload never overwrites a sealed key in place
(explicit new behavior, not claimed present); the digest pipeline seals
sha256 at upload time; a backfill seals digests for the existing image rows (16 recipes, 15 with
image - observed Nov 4, historical and not verified against live data;
re-check fresh at cutover. This count is NEVER a migration input). Undigested images are excluded
from consent SNAPSHOTS (present behavior), which says nothing about serving.

### G4. Two DISTINCT image gates - publish precondition AND serving
G4a PUBLISH PRECONDITION (required rights-cleared image, UNIVERSAL): before
ANY public recipe publish, (i) the SEALED revision manifest must bind AT
LEAST ONE rights-cleared eligible image (digested, provenance declared,
rights-cleared) covered by a CURRENT images-scope grant for that exact
revision, and (ii) separately, NO live image the serving gate would serve
may be left unbound from the manifest (no unbound live image leak). This is
universal - it does not ask whether the recipe "serves images" first.
"All live images eligible" is vacuously true when the manifest binds zero
images - that is not a required-image gate. Today an empty text-only manifest can publish while the
old two-gate endpoint keeps serving that recipe's images: the endpoint gate
does not prevent publishing an image-bearing recipe on text consent alone.
G4b MANIFEST-BOUND SERVING: a third, flag-gated check on
/img/recipe/:imageId for consent-covered recipes - the image must be bound
in the published revision's manifest with non-null provenance, using the
same scoped predicate as recipe_locales_effective, so an images revocation
stops the bytes too, not only the locale row.
Both default off; no production read-path switch without explicit approval.

### G5. Admin RBAC alignment
Source: mcp.ts roles viewer<editor<admin (ADMIN_MCP_API_KEY, MCP_NAMED_KEYS,
MCP_READ_KEY), auditStmt on every mutation. publishRevision's `actor` must
be the authenticated MCP identity (not a caller-supplied string), and
recipes.publish/unpublish must consume publish_requests (guard-enforced)
once 0007 is applied, instead of flipping status directly. RBAC itself is
the module-I launch gate; this plan only aligns the consent path with it.

### G6. Ownerless-catalog + legacy published recipes (POLICY GAP)
Today: 60-country catalog recipes have owner_user_id NULL; consent-design
tests prove ownerless recipes cannot enter the consent flow or create
revisions. Once 0007-0010 are APPLIED, the global publish guard and the
effective view do not exempt ownerless or legacy rows: a publish flip on an
ownerless recipe aborts (no owner can grant), and a serving read through
recipe_locales_effective excludes every recipe without current consent.
Ownerless current behavior is preserved ONLY while schema and flags are
unaffected. The cutover therefore STOPS before any step that would make the
guards or the view affect ownerless/legacy serving, until Luis decides the
catalog policy AND the query routing (which reads switch to the view, which
stay on raw tables). No implied exemption exists; "keep current" is not a
bypass of the new publish/consent safety once the SQL is live.

### G7. Duplicates
The (country, lang, slug) PK already prevents duplicate slugs globally.
Duplicate CONTENT across recipes is a moderation concern: define a publish
-time review check (same content_hash across recipes -> flagged for review,
never auto-merged). No schema change needed; recipe_revisions.content_hash
already exists.

### G8. Erasure + family fine print + mail outbox (POLICY GAPS)
- Erasure: the permanent-deletion exception for verified privacy requests
  is APPROVED policy. What remains open is the retention/verification
  IMPLEMENTATION against revision/consent audit retention (what is
  anonymized vs deleted, how a request is verified) - design work, not an
  approval question.
- Family fine print (families.care): untouched by this plan; any shared
  wording needs its own approval.
- Internationalization is an APPROVED outcome (en/es/fr today, more later);
  no blanket language approval is reopened here. What remains is coverage
  planning (which locales, in which order, with which translation-review
  staffing).
- Outbox: mail_log + reserveMail (per-kind caps + combined 40/day) already
  covers code/notice/receipt. No new email authority: receipts and review
  notices keep their existing recipients and wording; any new kind needs
  its own approval.

### G9. Post-submit re-consent workflow (INTEGRATION DESIGN GAP - no product scope picked)
Proven current behavior (fence-writers.test.ts workflow cases):
recipe_revisions_guard allows revision/consent creation only while
submitted_at IS NULL and nothing is published; the account save route
rejects a submitted recipe at the app level (409 "already sent"); the
permission page still RENDERS for a submitted recipe, but its grant POST
aborts at the guard (409). Consequence: after ANY admin change to a
submitted draft (locale edit, image, source), the live rows no longer match
the consented head revision, the owner cannot re-grant, and the admin
publish guard aborts - the recipe is STUCK. No return-to-draft path clears
submitted_at today. The existing stale-form 409 tests prove invalidation,
not recovery.
Grounded options:
 A. RECOMMENDED - Return-for-corrections loop: an admin-initiated, audited
    return that clears submitted_at (fence bumps, history retained),
    re-enabling the owner's existing edit/grant loop unchanged.
 B. Submitted-consent design: amend the guard to allow revision + grant
    while submitted, with the admin queue locked to publish exactly the
    consented head revision.

WHY A IS THE RECOMMENDATION (authority assessment: an internal
guard/workflow design choice within the approved ownership/review goals -
NOT a user-owned policy decision; main decides what to surface to Luis and
when, cohesively):
- It keeps every qualified invariant untouched. submitted_at is a
  designated flow/moderation field: 0007's recipes_bound_fields_guard
  comment lists it (with attested_at, image_key) as staying writable even
  while published, and the guard does not bind it. Clearing it violates no
  trigger, no revision rule, no consent rule.
- It preserves the clean pre-submit-only grant rule
  (recipe_revisions_guard) instead of amending a qualified invariant -
  Option B expands the consent surface to submitted recipes and adds
  queue-lock state coupling, a materially larger review.
- Smallest new surface: ONE audited admin action; the owner's side is the
  already-qualified edit/grant flow with zero changes.
- Failure modes fail closed: a failed return leaves the recipe submitted
  (unchanged); a return never makes anything publishable by itself.
MECHANICS SKETCH (design only - implementation awaits plan review):
- New admin MCP tool recipes.return_for_corrections (role admin,
  confirmed: true, note required - what needs correcting).
- One D1 batch: UPDATE recipes SET submitted_at = NULL WHERE id = ? AND
  submitted_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipe_locales l
  WHERE l.recipe_id = recipes.id AND l.status = 'published'), plus the
  standard auditStmt. 0 changes -> 409 (not submitted, or published -
  published recipes belong to the disable flow, not corrections).
- The 0010 AFTER UPDATE trigger bumps the fence automatically, so any
  displayed permission form invalidates without extra code.
- The tool joins RECIPE_ID_TOOLS (privacy boundary unchanged).
- Owner loop after return: existing account edit -> permission grant
  (fresh revision + consent) -> submit -> admin publish of the new head.
OWNER NOTICE: the returned recipe simply reappears in the owner's drafts -
zero new authority. An email notice is a NEW kind with new wording and
audience; it is NOT covered by any existing grant and is proposed only as
an optional approval-gated addition, with wording drafted separately for
approval before any send.
TEST PLAN (when implementation is approved): return clears submitted_at +
fence bumps + audit row; owner re-grant then succeeds (200) and publish
proceeds on the new head revision; return on an unsubmitted draft 409s;
return on a recipe with a published locale refused; editor role 403;
unconfirmed call dry-runs.
History and consent semantics of the return: revision, consent and audit
rows are append-only and untouched (immutable history); any OLD consent is
invalidated for later revisions by the exact-head binding - publishing
always requires a fresh grant for the current head revision, so a returned
recipe can never be published on its pre-return consent. The return sends
no notice and adds no public behavior.
CUTVER GATE, hard: the tested recovery loop (this option-A design, once
reviewed and implemented with its test plan) is a HARD precondition for
cutover. "Grants happen before submit / admins avoid editing submitted
drafts" is an operational mitigation only - NOT a sufficient workaround.

## Policy gaps blocking gates (owner: Luis, via main)
1. Withdrawal policy wording (hide-on-withdraw vs listed-with-notice) -
   blocks withdrawal routes. CLARIFICATION SENT, unanswered.
2. Staging D1 provisioning + migration apply + test-write authority, and
   production DB authority - each a separate grant, NOT covered by the
   Workers deploy-credential question. Blocks G1.
3. Ownerless-catalog policy + serving query routing - blocks the G6 stop
   point in G1's cutover.
4. Erasure retention/verification implementation - blocks G8's erasure
   design (the exception itself is approved).
5. Post-submit re-consent workflow (G9): RECOMMENDATION prepared (option
   A, return-for-corrections) as an internal design choice; pending plan
   review, not a user decision. The optional owner-notice email is a
   separate wording/audience approval if wanted at all.
6. Apple sign-in, SMS, super-admin audience - open product decisions, not
   assumed.

## Explicit non-goals for this plan
No merge, no migration apply, no flag enable, no production read-path
switch, no deploy, no new email scope, no withdrawal mechanics.
