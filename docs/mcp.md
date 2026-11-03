# 2yolks admin MCP

Agent content API, same conventions as the directory MCP (`lsendel/directory`).

- Endpoint: `POST https://2yolks.com/api/admin/mcp` (JSON-RPC 2.0:
  `initialize`, `ping`, `tools/list`, `tools/describe`, `tools/call`).
  Catalog only: `GET /api/admin/mcp/tools`.
- Auth: `Authorization: Bearer <key>`. The worker accepts the shared
  directory admin bearer (role `admin`), an optional read-only key
  (`viewer`), and per-agent named keys via the `MCP_NAMED_KEYS` secret.
  Attribution header: `X-MCP-Caller: <agent-name>`.
- Fail-closed: with no key configured the endpoint answers 503.

## Roles

- `viewer`: recipes.list/get, sources.list, blog.list/get
- `editor`: + recipes.create_draft, recipes.update_draft, recipes.add_locale, blog.create_draft, blog.update_draft
- `admin`: + recipes.publish/unpublish, recipes.set_image, sources.update, sources.clear_rights, blog.publish/unpublish, translations.mark_reviewed

## Wire shapes

Both shapes are accepted and behave identically:

- JSON-RPC 2.0: `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"...","arguments":{...},"confirmed":true}}`
- Shorthand (used by the directory MCP clients `scripts/mcp-cli.mjs` /
  `scripts/mcp-stdio.mjs`): `{"name":"...","arguments":{...},"dryRun":false}`

## Write semantics (both shapes)

- Read tools always execute.
- Write tools dry-run unless the call carries `confirmed: true` (at the
  params/body level or inside arguments). An explicit `dryRun`/`dry_run`
  flag wins either way.
- A write commits its content mutation and its `mcp_audit` row in one D1
  batch: a success response always means the change is audited, and a
  failed audit fails the whole write instead of committing silently. An
  in-process failure means nothing was written and the call is safe to
  retry; after a transport-level failure (timeout, no response), re-check
  state with recipes.get/list before retrying, since the write may have
  committed. Duplicate creates answer 409 with the existing id.
- Audit rows are attributed to the authenticated key identity; the
  `X-MCP-Caller` header is recorded as declared context only and cannot
  set the actor.

## Structured ingredients and translations (contracts, migration 0003)

- Ingredients may be plain strings or structured `{ref, qty, qtyEnd?, unit?, name, note?}` objects (same validation as the contracts package; unknown keys are stripped before storage). Steps may carry `{i:ref}` amount tokens (must resolve against the locale's ingredients) and `{t:160F}` / `{t:71C}` temperature tokens.
- Exactly one original locale per recipe. Every other locale is a translation carrying `translationOf` ("country/lang" of the original) + `translationMethod` (`human` | `machine`). Provenance is fixed at creation and not editable.
- The translation QA floor (step numbers/tokens, structured quantity equality, allergen terms) runs at creation and again in `translations.mark_reviewed`, which compares the draft against its stored source row (source must be published first) and stamps `translation_reviewed_at`/`_by` server-side from the authenticated key. Caller content can never set review fields. `translation_reviewer_kind` stays NULL: possessing a key proves neither a human nor an agent reviewer.
- `translations.mark_reviewed` answers 403 unless the deployment sets `MCP_TRANSLATION_REVIEW`; publishing a translated locale without the review stamp fails with 409. Translation review/publishing stays disabled until the owner sets that policy.
- `tested_at`/`tested_by` are not writable through the MCP.

## Structured timing, servings and category (migration 0004)

- Recipe-level (translation-invariant, shared by every locale):
  `prepMinutes` / `cookMinutes` / `restMinutes` / `totalMinutes` (integer
  minutes, 0-10080; `totalMinutes` >= 1), `baseServings` (numeric base yield
  the 1x scaler multiplies from), and `category` (dish-type slug; see
  `RECIPE_CATEGORY_SLUGS` in contracts; unknown slugs are rejected).
- Accepted by `recipes.create_draft` and `recipes.update_draft`; null clears
  a field on update. `totalMinutes` is stored explicitly and never computed
  as prep+cook: the two can overlap and resting time sits outside both. A
  total below prep+cook warns but does not reject.
- Steps may carry `{d:Nm}` duration tokens (1-1440 minutes). They render
  locale-neutral ("15 min") in every language and drive the cook-mode timer
  deterministically; malformed tokens are rejected at write time, and the
  translation QA gate compares them like amount/temperature tokens.
- NULL means "not recorded" - never zero; older recipes keep NULL until a
  guarded backfill from explicit source values.

## Images (migration 0004)

- `recipes.set_image` (admin, `confirmed: true`): attaches a rights-tracked
  image to a recipe. `kind` is `hero` (default) or `step` (with `stepIndex`).
  Binary upload only via `imageBase64`: jpeg/png/webp, max ~3 MB, 4096px and
  16MP. Container-level structural validation, not a magic-byte sniff: full
  JPEG marker walk to a terminal EOI, PNG chunk CRC32 checks plus exact
  scanline verification of the inflated stream (exact size, filter types 0-4,
  Adam7 passes handled, decompression bombs fail), exact WebP RIFF length.
  Truncation, CRC corruption, trailing-byte polyglots, bombs and oversize are
  rejected, as is SVG, and there is no URL-fetch mode, so the worker never
  makes a server-side request to a caller-supplied address. Known bound:
  JPEG/WebP compressed-bitstream corruption that preserves container
  structure is NOT detected (no pixel decode in this runtime); responses
  carry `x-content-type-options: nosniff` as the backstop.
- Provenance metadata is mandatory: `sourceName`, `sourceUrl` (https://),
  `license`, plus `style` (`photo` | `illustration` | `graphic`) as the
  honest-imagery label. Provenance is NOT clearance: the call must also carry
  `rightsConfirmed: true`, asserting the license was actually verified to
  permit this use. That assertion scopes to this one asset - it clears no
  other image and not the recipe's text source. The row is then stamped
  `cleared_at`. A new hero replaces
  the current hero (nothing is deleted; the latest hero wins) and updates
  `recipes.image_key`.
- Images are served at `/img/recipe/<image_id>` only while the image is
  rights-cleared (`cleared_at` set) AND the recipe has at least one
  published, rights-cleared locale - the same public visibility rule as the
  recipe page. Responses cache for 5 minutes (`public, max-age=300`), so an
  unpublish takes effect within that bound for images that were already
  public (never-instant); draft images are never served, so they never enter
  any cache at all. 404s are `no-store`. `recipes.get` returns a recipe's
  image
  rows.

## Rules

- Draft-first: creates land as `draft`; publishing is a separate admin call.
- Blog publish is its own vetting gate (blogs carry no source row):
  `blog.publish` requires `confirmed: true` plus a `review` note recording
  who vetted the post; both are written to the audit row.
- Recipe publish requires a rights-cleared source (`sources.clear_rights`
  with `confirmed: true` and a notes reason, pre-checked 404/409). The
  public serving gate independently refuses uncleared sources.
- Nothing is deleted: unpublish returns content to `draft`.
- Every write and every auth denial is recorded in `mcp_audit`.

## Example

```sh
curl https://2yolks.com/api/admin/mcp \
  -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"recipes.create_draft","confirmed":true,"arguments":{"source":{"name":"...","url":"https://...","license":"CC0-1.0"},"originCountry":"mx","locales":[{"country":"mx","lang":"es","title":"...","ingredients":["..."],"steps":["..."]}]}}}'
```

## Machine-translation publication (wave 1)

`MCP_TRANSLATION_REVIEW` stays unset, so no caller can stamp a review through the MCP. Wave-1 translations are published by an audited, repo-versioned route instead: `packages/api/content/wave1.translation-review.json` binds one completed AI-agent review to the SHA-256 of each draft's exact content, and `scripts/translation-sql.mjs publish` only emits UPDATEs that match the stored draft content and provenance. They stamp `translation_reviewer_kind='agent'` and write an `mcp_audit` row (`manual.translation_publish`). Published machine translations show an on-page "machine-translated, not reviewed by a native speaker" label; only a human reviewer stamp removes it. `scripts/translation-sql.mjs unpublish` returns them to draft and deletes nothing. Original-language rows are identified by `translation_of IS NULL` together with the wave-1 content source (`wave1.json`, matched to the live rows); no original marker is written.
