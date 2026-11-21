import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GLOBAL_CHROME_SCRIPT } from '@2yolks/web/server';
import app from './index';
import { SESSION_COOKIE } from './account';
import { migratedD1All } from './testd1';

const ORIGIN = 'https://2yolks.com';

let DB: D1Database;
const sent: { to: string[]; subject: string; text: string }[] = [];
const realFetch = globalThis.fetch;

function makeEnv(extra: Record<string, unknown> = {}) {
  return {
    DB,
    IMAGES: {},
    ASSETS: { fetch: async () => new Response('no asset', { status: 404 }) },
    ALLOW_DEMO_SEED: 'false',
    CANONICAL_ORIGIN: ORIGIN,
    RESEND_API_KEY: 're_test',
    RESEND_FROM: '2yolks <no-reply@2yolks.com>',
    ...extra,
  };
}

async function seedSource(id: string, cleared: boolean) {
  await DB.prepare('INSERT INTO sources (id, name, url, license, cleared_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, `Source ${id}`, `https://example.com/${id}`, cleared ? 'CC-BY-4.0' : 'unknown', cleared ? '2026-01-01T00:00:00Z' : null)
    .run();
}

async function seedRecipe(opts: {
  id: string;
  sourceId?: string;
  originCountry?: string | null;
  category?: string | null;
  totalMinutes?: number | null;
  testedAt?: string | null;
  country?: string;
  lang?: string;
  slug: string;
  title: string;
  intro?: string;
  ingredients?: string[];
  steps?: string[];
  status?: 'draft' | 'published' | 'rejected';
}) {
  await DB.prepare(
    'INSERT OR IGNORE INTO recipes (id, source_id, origin_country, category, total_minutes, tested_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(
      opts.id,
      opts.sourceId ?? 'src-cleared',
      opts.originCountry === undefined ? 'mx' : opts.originCountry,
      opts.category === undefined ? 'mains' : opts.category,
      opts.totalMinutes === undefined ? 25 : opts.totalMinutes,
      opts.testedAt === undefined ? null : opts.testedAt,
    )
    .run();

  await DB.prepare(
    'INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      opts.id,
      opts.country ?? 'us',
      opts.lang ?? 'en',
      opts.title,
      opts.slug,
      opts.intro ?? 'Delicious test dish.',
      JSON.stringify(opts.ingredients ?? ['200 g corn tortillas', '100 g black beans', '10 ml olive oil']),
      JSON.stringify(opts.steps ?? ['Heat skillet.', 'Cook and serve warm.']),
      opts.status ?? 'published',
    )
    .run();
}

async function createSessionUser(email: string): Promise<{ cookie: string }> {
  const r1 = await app.request(
    `${ORIGIN}/account/code`,
    { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email }).toString() },
    makeEnv(),
  );
  expect(r1.status).toBe(200);
  const code = (sent[sent.length - 1]?.text ?? '').match(/(\d{6})/)![1]!;
  const r2 = await app.request(
    `${ORIGIN}/account/verify`,
    { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, code }).toString() },
    makeEnv(),
  );
  expect(r2.status).toBe(303);
  const cookie = (r2.headers.get('set-cookie') ?? '').split(';')[0]!;
  expect(cookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
  return { cookie };
}

beforeEach(async () => {
  DB = migratedD1All();
  sent.length = 0;
  await seedSource('src-cleared', true);
  await seedSource('src-uncleared', false);
  globalThis.fetch = (async (input, init) => {
    if (String(input) === 'https://api.resend.com/emails') {
      sent.push(JSON.parse(String(init!.body)));
      return new Response('{"id":"ok"}', { status: 200 });
    }
    return realFetch(input as never, init);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('Phase 3 discovery, hubs, search, and saved routes', () => {
  it('redirects GET /?q=... to /search?q=... and preserves language', async () => {
    const r1 = await app.request(`${ORIGIN}/?q=soup`, {}, makeEnv());
    expect(r1.status).toBe(302);
    expect(r1.headers.get('location')).toBe('/search?q=soup');

    const r2 = await app.request(`${ORIGIN}/?lang=es&q=sopa`, {}, makeEnv());
    expect(r2.status).toBe(302);
    expect(r2.headers.get('location')).toBe('/search?q=sopa&lang=es');
  });

  it('GET /search supports keyword, combinable filters, recovery link, noindex on 0 hits, and search_gap_logs', async () => {
    await seedRecipe({
      id: 'r-taco',
      originCountry: 'mx',
      category: 'tacos-tortillas',
      totalMinutes: 25,
      testedAt: '2026-10-01T00:00:00Z',
      slug: 'black-bean-tacos',
      title: 'Black Bean Tacos',
      ingredients: ['300 g black beans', '8 corn tortillas', '1 avocado'],
      steps: ['Warm skillet over medium heat.', 'Fill tortillas and serve.'],
    });
    await seedRecipe({
      id: 'r-roast',
      originCountry: 'us',
      category: 'mains',
      totalMinutes: 90,
      testedAt: null,
      slug: 'sunday-roast-chicken',
      title: 'Sunday Roast Chicken',
      intro: 'Festive roast dinner for Thanksgiving.',
      ingredients: ['1 whole chicken', '20 g butter', '3 garlic cloves'],
      steps: ['Preheat oven to 200 C.', 'Roast in oven 75 min until golden.'],
    });

    // Keyword + combinable filters: category, time<=30, diet=vegetarian, cuisine=mexican, tested=1, method=no-oven
    const res = await app.request(
      `${ORIGIN}/search?q=tacos&cat=tacos-tortillas&time=30&diet=vegetarian&cuisine=mexican&tested=1&method=no-oven`,
      {},
      makeEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toBeNull();
    const html = await res.text();
    expect(html).toContain('Black Bean Tacos');
    expect(html).not.toContain('Sunday Roast Chicken');

    // Recovery link when filters narrow a matching keyword down to 0 hits
    const narrowed = await app.request(`${ORIGIN}/search?q=chicken&method=no-oven`, {}, makeEnv());
    expect(narrowed.status).toBe(200);
    expect(narrowed.headers.get('x-robots-tag')).toBe('noindex');
    const narrowedHtml = await narrowed.text();
    expect(narrowedHtml).toContain('href="/search?q=chicken"');

    // Zero results logged in search_gap_logs and marked noindex (both the narrowed query and unicornpasta)
    const zero = await app.request(`${ORIGIN}/search?q=unicornpasta`, {}, makeEnv());
    expect(zero.status).toBe(200);
    expect(zero.headers.get('x-robots-tag')).toBe('noindex');
    const gaps = await DB.prepare('SELECT query, locale FROM search_gap_logs ORDER BY id ASC').all<{ query: string; locale: string }>();
    expect(gaps.results).toEqual([
      { query: 'chicken', locale: 'en' },
      { query: 'unicornpasta', locale: 'en' },
    ]);
  });

  it('GET /search paginates at 24 items per page', async () => {
    for (let i = 1; i <= 26; i++) {
      await seedRecipe({
        id: `r-page-${String(i).padStart(2, '0')}`,
        slug: `soup-${String(i).padStart(2, '0')}`,
        title: `Soup ${String(i).padStart(2, '0')}`,
        category: 'soups-stews',
      });
    }

    const p1 = await app.request(`${ORIGIN}/search?cat=soups-stews&page=1`, {}, makeEnv());
    expect(p1.status).toBe(200);
    const h1 = await p1.text();
    expect((h1.match(/data-recipe-item="true"/g) || []).length).toBe(24);
    expect(h1).toContain('page=2');

    const p2 = await app.request(`${ORIGIN}/search?cat=soups-stews&page=2`, {}, makeEnv());
    expect(p2.status).toBe(200);
    const h2 = await p2.text();
    expect((h2.match(/data-recipe-item="true"/g) || []).length).toBe(2);
  });

  it('GET /api/v1/search/suggest returns grouped suggestions and excludes drafts and uncleared sources', async () => {
    await seedRecipe({
      id: 'r-pub',
      category: 'mains',
      slug: 'honey-chicken',
      title: 'Honey Chicken',
      ingredients: ['500 g chicken breast', '30 g honey'],
    });
    await seedRecipe({
      id: 'r-draft',
      category: 'mains',
      slug: 'draft-chicken',
      title: 'Draft Chicken',
      status: 'draft',
    });
    await seedRecipe({
      id: 'r-uncleared',
      sourceId: 'src-uncleared',
      category: 'mains',
      slug: 'uncleared-chicken',
      title: 'Uncleared Chicken',
    });

    const res = await app.request(`${ORIGIN}/api/v1/search/suggest?q=chick`, {}, makeEnv());
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      recipes: { id: string; title: string; href: string }[];
      categories: { slug: string; label: string; href: string }[];
      ingredients: string[];
    };
    expect(data.recipes.map((r) => r.title)).toEqual(['Honey Chicken']);
    expect(data.ingredients.some((i) => /chicken/i.test(i))).toBe(true);

    const catRes = await app.request(`${ORIGIN}/api/v1/search/suggest?q=main`, {}, makeEnv());
    const catData = (await catRes.json()) as { categories: { slug: string; href: string }[] };
    expect(catData.categories.some((c) => c.slug === 'mains' && c.href === '/recipes/mains')).toBe(true);
  });

  it('serves category, collection, and cuisine hubs with 301 ISO aliases, 404s, noindex on empty, and sitemap entries', async () => {
    await seedRecipe({
      id: 'r-mx-1',
      originCountry: 'mx',
      category: 'mains',
      totalMinutes: 25,
      slug: 'chilaquiles-verdes',
      title: 'Chilaquiles Verdes',
      steps: ['Simmer salsa.', 'Toss tortillas.'],
    });

    expect((await app.request(`${ORIGIN}/recipes/mains`, {}, makeEnv())).status).toBe(200);
    expect((await app.request(`${ORIGIN}/recipes/unknown`, {}, makeEnv())).status).toBe(404);

    // Empty category hub returns 200 with noindex
    const emptyCat = await app.request(`${ORIGIN}/recipes/drinks`, {}, makeEnv());
    expect(emptyCat.status).toBe(200);
    expect(emptyCat.headers.get('x-robots-tag')).toBe('noindex');

    // Collections directory + valid/invalid slugs
    expect((await app.request(`${ORIGIN}/collections`, {}, makeEnv())).status).toBe(200);
    const weeknight = await app.request(`${ORIGIN}/collections/weeknight`, {}, makeEnv());
    expect(weeknight.status).toBe(200);
    expect(await weeknight.text()).toContain('Chilaquiles Verdes');
    expect((await app.request(`${ORIGIN}/collections/thanksgiving`, {}, makeEnv())).headers.get('x-robots-tag')).toBe('noindex');
    expect((await app.request(`${ORIGIN}/collections/nope`, {}, makeEnv())).status).toBe(404);

    // Cuisine directory, 301 alias /cuisine/mx -> /cuisine/mexican, valid & 404 slugs
    expect((await app.request(`${ORIGIN}/cuisine`, {}, makeEnv())).status).toBe(200);
    const alias = await app.request(`${ORIGIN}/cuisine/mx?lang=es`, {}, makeEnv());
    expect(alias.status).toBe(301);
    expect(alias.headers.get('location')).toBe('/cuisine/mexican?lang=es');

    const mxHub = await app.request(`${ORIGIN}/cuisine/mexican`, {}, makeEnv());
    expect(mxHub.status).toBe(200);
    expect(mxHub.headers.get('x-robots-tag')).toBeNull();
    expect(await mxHub.text()).toContain('Chilaquiles Verdes');
    expect((await app.request(`${ORIGIN}/cuisine/nope`, {}, makeEnv())).status).toBe(404);

    // Sitemap includes non-empty hubs and omits empty hubs
    const smRes = await app.request(`${ORIGIN}/sitemap.xml`, {}, makeEnv());
    expect(smRes.status).toBe(200);
    const sm = await smRes.text();
    expect(sm).toContain('https://2yolks.com/recipes/mains');
    expect(sm).toContain('https://2yolks.com/collections');
    expect(sm).toContain('https://2yolks.com/collections/weeknight');
    expect(sm).toContain('https://2yolks.com/cuisine');
    expect(sm).toContain('https://2yolks.com/cuisine/mexican');
    expect(sm).not.toContain('https://2yolks.com/recipes/drinks');
    expect(sm).not.toContain('https://2yolks.com/collections/thanksgiving');
  });

  it('preserves pathname and safe discovery filters in language switch links', async () => {
    await seedRecipe({
      id: 'r-nav-1',
      originCountry: 'mx',
      category: 'mains',
      slug: 'veggie-tacos',
      title: 'Veggie Tacos',
      ingredients: ['200 g black beans', '6 corn tortillas'],
    });
    await seedRecipe({
      id: 'r-nav-1',
      country: 'mx',
      lang: 'es',
      originCountry: 'mx',
      category: 'mains',
      slug: 'tacos-es',
      title: 'Tacos ES',
      ingredients: ['200 g frijoles negros', '6 tortillas de maíz'],
    });
    await seedRecipe({
      id: 'r-nav-1',
      country: 'fr',
      lang: 'fr',
      originCountry: 'mx',
      category: 'mains',
      slug: 'tacos-fr',
      title: 'Tacos FR',
      ingredients: ['200 g haricots noirs', '6 tortillas de maïs'],
    });

    for (const [path, expectedEs, expectedFr] of [
      ['/recipes', '/recipes?lang=es', '/recipes?lang=fr'],
      ['/search?q=tacos&diet=vegetarian', '/search?q=tacos&amp;diet=vegetarian&amp;lang=es', '/search?q=tacos&amp;diet=vegetarian&amp;lang=fr'],
      ['/recipes/mains', '/recipes/mains?lang=es', '/recipes/mains?lang=fr'],
    ] as const) {
      const res = await app.request(`${ORIGIN}${path}`, {}, makeEnv());
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain(`href="${expectedEs}"`);
      expect(html).toContain(`href="${expectedFr}"`);
    }
  });

  it('supports anonymous + signed-in saved bookmarks, /account/saved, toggle, sync, recipe meta, and ?next=/saved login redirect', async () => {
    await seedRecipe({
      id: 'r-save-1',
      country: 'mx',
      lang: 'es',
      originCountry: 'mx',
      category: 'mains',
      slug: 'tacos-al-pastor',
      title: 'Tacos al Pastor',
    });
    await seedRecipe({
      id: 'r-save-2',
      country: 'us',
      lang: 'en',
      originCountry: 'us',
      category: 'breakfast',
      slug: 'oat-pancakes',
      title: 'Oat Pancakes',
    });

    // Recipe page renders Save button and #recipe-meta-data
    const rPage = await app.request(`${ORIGIN}/mx/recipes/tacos-al-pastor`, {}, makeEnv());
    expect(rPage.status).toBe(200);
    const rHtml = await rPage.text();
    expect(rHtml).toContain('data-save-recipe="r-save-1"');
    expect(rHtml).toContain('id="recipe-meta-data"');
    expect(rHtml).toContain('href="/recipes/mains?lang=es"');

    // Anonymous /saved
    const anonSaved = await app.request(`${ORIGIN}/saved`, {}, makeEnv());
    expect(anonSaved.status).toBe(200);
    expect(anonSaved.headers.get('cache-control')).toBe('private, no-store');
    expect(anonSaved.headers.get('x-robots-tag')).toBe('noindex');
    expect(await anonSaved.text()).toContain('data-signed-in="0"');

    // Anonymous /account/saved returns 200 signedIn:false (zero 401 console errors)
    const anonStatus = await app.request(`${ORIGIN}/account/saved`, {}, makeEnv());
    expect(anonStatus.status).toBe(200);
    expect(await anonStatus.json()).toEqual({ ok: true, signedIn: false, ids: [] });

    // Anonymous toggle: 401 for JSON, 303 for form, 403 for cross-origin
    const badOrigin = await app.request(
      `${ORIGIN}/account/saved/toggle`,
      { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{"recipe_id":"r-save-1"}' },
      makeEnv(),
    );
    expect(badOrigin.status).toBe(403);

    const anonJson = await app.request(
      `${ORIGIN}/account/saved/toggle`,
      { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', accept: 'application/json' }, body: '{"recipe_id":"r-save-1"}' },
      makeEnv(),
    );
    expect(anonJson.status).toBe(401);

    const anonForm = await app.request(
      `${ORIGIN}/account/saved/toggle`,
      { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: 'recipe_id=r-save-1' },
      makeEnv(),
    );
    expect(anonForm.status).toBe(303);
    expect(anonForm.headers.get('location')).toBe('/account?next=%2Fsaved');

    // Sign in via /account/code + /account/verify with next=/saved
    const codeRes = await app.request(
      `${ORIGIN}/account/code`,
      { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'saver@example.com', next: '/saved' }).toString() },
      makeEnv(),
    );
    expect(codeRes.status).toBe(200);
    const code = (sent[sent.length - 1]?.text ?? '').match(/(\d{6})/)![1]!;
    const verifyRes = await app.request(
      `${ORIGIN}/account/verify`,
      { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'saver@example.com', code, next: '/saved' }).toString() },
      makeEnv(),
    );
    expect(verifyRes.status).toBe(303);
    expect(verifyRes.headers.get('location')).toBe('/saved');
    const cookie = (verifyRes.headers.get('set-cookie') ?? '').split(';')[0]!;

    // Signed-in toggle add then remove
    const addRes = await app.request(
      `${ORIGIN}/account/saved/toggle`,
      { method: 'POST', headers: { origin: ORIGIN, cookie, 'content-type': 'application/json', accept: 'application/json' }, body: '{"recipe_id":"r-save-1"}' },
      makeEnv(),
    );
    expect(addRes.status).toBe(200);
    expect(await addRes.json()).toEqual({ ok: true, recipeId: 'r-save-1', saved: true, ids: ['r-save-1'] });

    // Server-rendered /saved includes saved recipe when signed in
    const signedSaved = await app.request(`${ORIGIN}/saved`, { headers: { cookie } }, makeEnv());
    expect(signedSaved.status).toBe(200);
    const signedHtml = await signedSaved.text();
    expect(signedHtml).toContain('data-signed-in="1"');
    expect(signedHtml).toContain('Tacos al Pastor');

    // Sync merges additional IDs and ignores nonexistent IDs
    const syncRes = await app.request(
      `${ORIGIN}/account/saved/sync`,
      { method: 'POST', headers: { origin: ORIGIN, cookie, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ ids: ['r-save-2', 'missing-id'] }) },
      makeEnv(),
    );
    expect(syncRes.status).toBe(200);
    const syncBody = (await syncRes.json()) as { ok: boolean; ids: string[] };
    expect(syncBody.ok).toBe(true);
    expect(new Set(syncBody.ids)).toEqual(new Set(['r-save-1', 'r-save-2']));

    // Signed-in status returns merged IDs
    const statusRes = await app.request(`${ORIGIN}/account/saved`, { headers: { cookie } }, makeEnv());
    expect(statusRes.status).toBe(200);
    const stData = (await statusRes.json()) as { ok: boolean; signedIn: boolean; ids: string[] };
    expect(stData.signedIn).toBe(true);
    expect(new Set(stData.ids)).toEqual(new Set(['r-save-1', 'r-save-2']));

    // Remove r-save-1
    const rmRes = await app.request(
      `${ORIGIN}/account/saved/toggle`,
      { method: 'POST', headers: { origin: ORIGIN, cookie, 'content-type': 'application/json', accept: 'application/json' }, body: '{"recipe_id":"r-save-1"}' },
      makeEnv(),
    );
    expect(rmRes.status).toBe(200);
    expect(await rmRes.json()).toEqual({ ok: true, recipeId: 'r-save-1', saved: false, ids: ['r-save-2'] });

    // Also verify second user session is isolated
    const { cookie: altCookie } = await createSessionUser('other@example.com');
    const altStatus = await app.request(`${ORIGIN}/account/saved`, { headers: { cookie: altCookie } }, makeEnv());
    expect(await altStatus.json()).toEqual({ ok: true, signedIn: true, ids: [] });
  });
});

describe('GLOBAL_CHROME_SCRIPT client behavior', () => {
  type Listener = (e: { preventDefault: () => void; stopPropagation: () => void; key?: string; target?: unknown }) => void;
  class FakeEl {
    tagName: string;
    className = '';
    type = '';
    value = '';
    checked = false;
    hidden = false;
    textContent = '';
    href = '';
    attrs = new Map<string, string>();
    children: FakeEl[] = [];
    parentNode: FakeEl | null = null;
    listeners = new Map<string, Listener[]>();
    style: Record<string, string> = {};
    constructor(tag = 'div', attrs: Record<string, string> = {}, text = '') {
      this.tagName = tag.toUpperCase();
      this.textContent = text;
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') this.className = v;
        else if (k === 'hidden') this.hidden = true;
        else if (k === 'href') { this.href = v; this.attrs.set(k, v); }
        else this.attrs.set(k, v);
      }
    }
    get firstChild(): FakeEl | null { return this.children[0] ?? null; }
    setAttribute(k: string, v: string) {
      if (k === 'class') this.className = v;
      else if (k === 'href') { this.href = v; this.attrs.set(k, v); }
      else this.attrs.set(k, v);
    }
    getAttribute(k: string) {
      if (k === 'class') return this.className || null;
      if (k === 'href') return this.attrs.get('href') ?? (this.href || null);
      return this.attrs.get(k) ?? null;
    }
    removeAttribute(k: string) { this.attrs.delete(k); }
    appendChild(c: FakeEl) { c.parentNode = this; this.children.push(c); return c; }
    removeChild(c: FakeEl) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } }
    addEventListener(ev: string, fn: Listener) {
      const list = this.listeners.get(ev) ?? [];
      list.push(fn);
      this.listeners.set(ev, list);
    }
    trigger(ev: string, extra: Record<string, unknown> = {}) {
      let stopped = false;
      const event = {
        preventDefault() {},
        stopPropagation() { stopped = true; },
        target: this,
        ...extra,
      };
      for (const fn of this.listeners.get(ev) ?? []) fn(event);
      return { stopped };
    }
    focus() {}
    closest() { return null; }
    matches(sel: string): boolean {
      for (const part of sel.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (matchSimple(this, part)) return true;
      }
      return false;
    }
    querySelector(sel: string): FakeEl | null { return this.querySelectorAll(sel)[0] ?? null; }
    querySelectorAll(sel: string): FakeEl[] {
      const out: FakeEl[] = [];
      const walk = (n: FakeEl) => {
        for (const ch of n.children) {
          if (ch.matches(sel)) out.push(ch);
          walk(ch);
        }
      };
      walk(this);
      return out;
    }
  }

  function matchSimple(el: FakeEl, sel: string): boolean {
    const parts = sel.trim().split(/\s+/);
    if (parts.length > 1) {
      const leaf = parts[parts.length - 1]!;
      if (!matchAtom(el, leaf)) return false;
      let cur = el.parentNode;
      let idx = parts.length - 2;
      while (cur && idx >= 0) {
        if (matchAtom(cur, parts[idx]!)) idx--;
        cur = cur.parentNode;
      }
      return idx < 0;
    }
    return matchAtom(el, sel);
  }

  function matchAtom(el: FakeEl, atom: string): boolean {
    if (atom.includes('.')) {
      const [head, ...cls] = atom.split('.');
      if (head && !matchAtom(el, head)) return false;
      const elClasses = el.className.split(/\s+/);
      return cls.every((c) => elClasses.includes(c));
    }
    if (atom.includes('[')) {
      const idx = atom.indexOf('[');
      const tagPart = atom.slice(0, idx);
      if (tagPart && !matchAtom(el, tagPart)) return false;
      const bracketRe = /\[([^\]=]+)(?:="([^"]*)")?\]/g;
      let m: RegExpExecArray | null;
      while ((m = bracketRe.exec(atom.slice(idx)))) {
        const val = el.getAttribute(m[1]!);
        if (m[2] !== undefined ? val !== m[2] : val === null) return false;
      }
      return true;
    }
    return el.tagName === atom.toUpperCase();
  }

  function makeStorage() {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
    };
  }

  it('toggles Save ♥ without 401s, records Recently Viewed, toggles SearchSheet, and restores form fields across lang switch', async () => {
    const local = makeStorage();
    const session = makeStorage();
    const fetches: string[] = [];
    const fetchMock = async (url: string) => {
      fetches.push(url);
      if (url === '/account/saved') {
        return { ok: true, status: 200, json: async () => ({ ok: true, signedIn: false, ids: [] }) };
      }
      return { ok: true, status: 200, json: async () => ({ recipes: [], categories: [], ingredients: [] }) };
    };

    function runBoot(opts: { pathname: string; setup: (root: FakeEl, byId: Map<string, FakeEl>) => void }) {
      const root = new FakeEl('body');
      const byId = new Map<string, FakeEl>();
      opts.setup(root, byId);
      const docListeners = new Map<string, Listener[]>();
      const doc = {
        documentElement: new FakeEl('html', { lang: 'en' }),
        body: root,
        activeElement: null,
        getElementById: (id: string) => byId.get(id) ?? null,
        querySelector: (s: string) => root.querySelector(s),
        querySelectorAll: (s: string) => root.querySelectorAll(s),
        createElement: (tag: string) => new FakeEl(tag),
        addEventListener: (ev: string, fn: Listener) => {
          const l = docListeners.get(ev) ?? [];
          l.push(fn);
          docListeners.set(ev, l);
        },
        _key: (key: string) => {
          for (const fn of docListeners.get('keydown') ?? []) fn({ preventDefault() {}, stopPropagation() {}, key });
        },
      };
      const win = {
        localStorage: local,
        sessionStorage: session,
        location: { pathname: opts.pathname, search: '', reload() {} },
        matchMedia: () => ({ matches: false }),
      };
      const fn = new Function('window', 'document', 'localStorage', 'sessionStorage', 'fetch', GLOBAL_CHROME_SCRIPT);
      fn(win, doc, local, session, fetchMock);
      return { root, doc };
    }

    // 1. Recipe visit + Save toggle + SearchSheet + Language form capture
    const saveMeta = JSON.stringify({ id: 'r1', title: 'Chilaquiles', href: '/mx/recipes/chilaquiles', cat: 'Mains', min: 25 });
    let saveBtn!: FakeEl;
    let badge!: FakeEl;
    let sheet!: FakeEl;
    let openBtn!: FakeEl;
    let closeBtn!: FakeEl;
    let qInput!: FakeEl;
    let langLink!: FakeEl;

    const boot1 = runBoot({
      pathname: '/search',
      setup: (root, byId) => {
        badge = root.appendChild(new FakeEl('span', { 'data-saved-count': 'true', hidden: '1' }));
        saveBtn = root.appendChild(new FakeEl('button', { 'data-save-recipe': 'r1', 'data-recipe-meta': saveMeta, 'data-label-save': 'Save recipe', 'data-label-saved': 'Saved', 'aria-pressed': 'false' }));
        openBtn = root.appendChild(new FakeEl('a', { href: '/search', 'data-open-search-sheet': 'true' }));
        sheet = root.appendChild(new FakeEl('div', { 'data-search-sheet': 'true', hidden: '1' }));
        closeBtn = sheet.appendChild(new FakeEl('button', { 'data-close-search-sheet': 'true' }));
        const recentWrap = sheet.appendChild(new FakeEl('div', { 'data-recent-searches-wrap': 'true', hidden: '1' }));
        recentWrap.appendChild(new FakeEl('div', { 'data-recent-searches': 'true' }));

        const searchForm = root.appendChild(new FakeEl('form', { 'data-search-page-form': 'true', action: '/search' }));
        qInput = searchForm.appendChild(new FakeEl('input', { name: 'q', type: 'search' }));
        qInput.value = 'pozole';

        const langNav = root.appendChild(new FakeEl('nav', { class: 'language-nav' }));
        langLink = langNav.appendChild(new FakeEl('a', { href: '/search?lang=es' }));

        const metaScript = root.appendChild(new FakeEl('script', { id: 'recipe-meta-data' }, JSON.stringify({ id: 'r1', title: 'Chilaquiles', href: '/mx/recipes/chilaquiles', cat: 'Mains' })));
        byId.set('recipe-meta-data', metaScript);
      },
    });

    // Save click increments badge & writes 2y-saved, prevents bubbling, and uses 200 /account/saved check
    const ev = saveBtn.trigger('click');
    await Promise.resolve();
    await Promise.resolve();
    expect(ev.stopped).toBe(true);
    expect(saveBtn.getAttribute('aria-pressed')).toBe('true');
    expect(badge.textContent).toBe('1');
    expect(badge.hidden).toBe(false);
    expect(fetches).toContain('/account/saved');
    expect(fetches).not.toContain('/account/saved/toggle');

    // Recently viewed recorded 2y-recent
    expect(JSON.parse(local.getItem('2y-recent') || '[]')[0].id).toBe('r1');

    // SearchSheet open & close
    expect(sheet.hidden).toBe(true);
    openBtn.trigger('click');
    expect(sheet.hidden).toBe(false);
    closeBtn.trigger('click');
    expect(sheet.hidden).toBe(true);
    openBtn.trigger('click');
    expect(sheet.hidden).toBe(false);
    boot1.doc._key('Escape');
    expect(sheet.hidden).toBe(true);

    // Clicking language switch captures form field snapshot in sessionStorage['2y-lang-form']
    langLink.trigger('click');
    expect(JSON.parse(session.getItem('2y-lang-form') || '{}').fields.q).toBe('pozole');

    // 2. Subsequent load on /search restores q='pozole', and /saved renders local saved + recently viewed
    let restoredInput!: FakeEl;
    let savedRoot!: FakeEl;
    let recentRoot!: FakeEl;
    runBoot({
      pathname: '/search',
      setup: (root) => {
        const form = root.appendChild(new FakeEl('form', { 'data-search-page-form': 'true', action: '/search' }));
        restoredInput = form.appendChild(new FakeEl('input', { name: 'q', type: 'search' }));
      },
    });
    expect(restoredInput.value).toBe('pozole');

    runBoot({
      pathname: '/saved',
      setup: (root) => {
        const page = root.appendChild(new FakeEl('div', { 'data-saved-page': 'true', 'data-signed-in': '0' }));
        savedRoot = page.appendChild(new FakeEl('div', { 'data-saved-local-root': 'true', 'data-remove-label': 'Remove' }));
        recentRoot = page.appendChild(new FakeEl('div', { 'data-recent-local-root': 'true' }));
      },
    });
    expect(savedRoot.querySelector('a.stretched-row')?.textContent).toBe('Chilaquiles');
    expect(recentRoot.querySelector('a')?.textContent).toBe('Chilaquiles');

    // Clicking Remove updates 2y-saved & clears list to empty state
    const rmBtn = savedRoot.querySelector('button.save-btn')!;
    rmBtn.trigger('click');
    expect(JSON.parse(local.getItem('2y-saved') || '[]')).toEqual([]);
    expect(savedRoot.querySelector('a.stretched-row')).toBeNull();
  });
});
