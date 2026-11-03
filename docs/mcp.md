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
- `editor`: + recipes.create_draft, recipes.update_draft, blog.create_draft, blog.update_draft
- `admin`: + recipes.publish/unpublish, sources.update, sources.clear_rights, blog.publish/unpublish

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
  failed audit fails the whole write instead of committing silently.
- Audit rows are attributed to the authenticated key identity; the
  `X-MCP-Caller` header is recorded as declared context only and cannot
  set the actor.

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
