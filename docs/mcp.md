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

## Rules

- Draft-first: creates land as `draft`; publishing is a separate admin call.
- Recipe publish requires a rights-cleared source (`sources.clear_rights`
  with `confirmed: true` and a notes reason). The public serving gate
  independently refuses uncleared sources.
- Nothing is deleted: unpublish returns content to `draft`.
- Every write and every auth denial is recorded in `mcp_audit`.

## Example

```sh
curl https://2yolks.com/api/admin/mcp \
  -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"recipes.create_draft","arguments":{"source":{"name":"...","url":"https://...","license":"CC0-1.0"},"originCountry":"mx","locales":[{"country":"mx","lang":"es","title":"...","ingredients":["..."],"steps":["..."]}]}}}'
```
