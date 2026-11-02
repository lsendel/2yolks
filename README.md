# 2yolks

Recipes worth cracking two eggs for.

International recipe platform on Cloudflare Workers. Free tier only, paid
features off, custom domain (2yolks.com) attaches at cutover.

## Layout

- `packages/contracts` - shared types, the 60-country registry (seeded from
  the directory platform's country-coverage receipt), locales, and the slug
  table (`/{country}/recipes/{id}-{slug}`; the id is stable across locales,
  each locale adds its own translated slug beside it).
- `packages/api` - Hono worker: JSON API under `/api/v1`, server-rendered
  pages, D1 (Drizzle) with provenance-first schema (every recipe cites a
  licensed source).
- `packages/web` - React app server-rendered by the worker; Vite builds
  client assets served from the worker's static assets.
- The original Bolt/StackBlitz scaffold files remain at the repo root
  (`src/`, `docs/`, old configs) as history until the cutover commit
  removes them; they are not part of the new build. The new stack lives
  in `packages/`.
- `wrangler.jsonc` - single worker, one D1 database (shard later per the
  plan), Workers Free plan.

## Develop

```
npm install
npm run typecheck
npm run test
npm run build
npx wrangler deploy --dry-run --outdir /tmp/worker-dist
```

## Wave one

US/English (`/us/en/`) and Mexico/Spanish (`/mx/es/`) with seed recipes.
Content is UGC-first; harvested recipes wait on per-source license clearance
(see the plan).

## Local development

```
npm install
npm run typecheck && npm run test && npm run build
wrangler d1 execute 2yolks --local --file packages/api/migrations/0001_init.sql
wrangler d1 execute 2yolks --local --file packages/api/seeds/0001_demo.sql   # synthetic demo data
wrangler dev --local --var ALLOW_DEMO_SEED:true
```

The demo seed is synthetic agent-authored test data (`internal-demo` license)
for local development only. The worker never serves `internal-demo` content
unless `ALLOW_DEMO_SEED=true`; production config keeps it false.
