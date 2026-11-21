import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CAPTURE_HELPERS_JS,
  CAPTURE_CLIENT_SCRIPT,
  CAPTURE_CHECK_STRINGS,
  ACCOUNT_LIVE_SHARE_SCRIPT,
  renderRecipe,
} from '@2yolks/web/server';
import app from './index';
import { migratedD1All } from './testd1';

const ORIGIN = 'https://2yolks.com';
const ADMIN_KEY = 'test-admin-key-0000000000';
let DB: D1Database;
const sent: { to: string[]; subject: string; text: string }[] = [];
const realFetch = globalThis.fetch;

function makeEnv(extra: Record<string, unknown> = {}) {
  return {
    DB,
    IMAGES: {},
    ASSETS: { fetch: async () => new Response('no asset', { status: 404 }) },
    ALLOW_DEMO_SEED: 'false',
    SUBMISSIONS_ENABLED: 'true',
    CANONICAL_ORIGIN: ORIGIN,
    RESEND_API_KEY: 're_test',
    RESEND_FROM: '2yolks <no-reply@2yolks.com>',
    ADMIN_MCP_API_KEY: ADMIN_KEY,
    ...extra,
  };
}

async function signIn(email = 'cook@example.com'): Promise<string> {
  const r1 = await app.request(
    `${ORIGIN}/account/code`,
    {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email }).toString(),
    },
    makeEnv(),
  );
  expect(r1.status).toBe(200);
  const code = (sent[sent.length - 1]?.text ?? '').match(/(\d{6})/)![1]!;
  const r2 = await app.request(
    `${ORIGIN}/account/verify`,
    {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, code }).toString(),
    },
    makeEnv(),
  );
  expect(r2.status).toBe(303);
  return (r2.headers.get('set-cookie') ?? '').split(';')[0]!;
}

async function seedPublished(opts: {
  id: string;
  slug: string;
  title: string;
  ingredients: string[];
  steps?: string[];
  category?: string;
  authorName?: string;
  clearedAt?: string | null;
  status?: 'published' | 'draft';
}) {
  const srcId = `src-${opts.id}`;
  const cleared = opts.clearedAt === undefined ? '2026-01-01T00:00:00Z' : opts.clearedAt;
  await DB.prepare('INSERT OR IGNORE INTO sources (id, name, url, license, cleared_at) VALUES (?, ?, ?, ?, ?)')
    .bind(srcId, `Kitchen ${opts.id}`, `https://2yolks.com/`, 'CC0-1.0', cleared)
    .run();
  await DB.prepare(
    'INSERT OR REPLACE INTO recipes (id, source_id, origin_country, created_at, prep_minutes, cook_minutes, total_minutes, base_servings, category, author_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(opts.id, srcId, 'us', '2026-01-02T00:00:00Z', 10, 15, 25, 2, opts.category ?? 'mains', opts.authorName ?? 'Sam T.')
    .run();
  await DB.prepare(
    'INSERT OR REPLACE INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      opts.id,
      'us',
      'en',
      opts.title,
      opts.slug,
      'Simple pantry dish.',
      JSON.stringify(opts.ingredients),
      JSON.stringify(opts.steps ?? ['Cook gently 10 minutes.']),
      opts.status ?? 'published',
    )
    .run();
}

beforeEach(() => {
  DB = migratedD1All();
  sent.length = 0;
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

type El = { [k: string]: any };
function makeEl(tag: string, extra: El = {}): El {
  const classSet = new Set<string>();
  const syncCls = () => { el.className = [...classSet].join(' '); };
  const el: El = {
    tagName: tag,
    value: '',
    textContent: '',
    className: '',
    hidden: false,
    disabled: false,
    checked: false,
    placeholder: '',
    rows: 2,
    type: 'text',
    min: '',
    max: '',
    style: {} as Record<string, string>,
    children: [] as El[],
    attrs: {} as Record<string, string>,
    listeners: {} as Record<string, Array<(e: unknown) => void>>,
    parentNode: null as El | null,
    classList: {
      add(c: string) { classSet.add(c); syncCls(); },
      remove(c: string) { classSet.delete(c); syncCls(); },
      contains(c: string) { return classSet.has(c); },
      toggle(c: string, force?: boolean) {
        const on = force === undefined ? !classSet.has(c) : Boolean(force);
        if (on) classSet.add(c); else classSet.delete(c);
        syncCls();
        return on;
      },
    },
    setAttribute(k: string, v: string) { el.attrs[k] = String(v); },
    getAttribute(k: string) { return k in el.attrs ? el.attrs[k] : null; },
    removeAttribute(k: string) { delete el.attrs[k]; },
    appendChild(c: El) { el.children.push(c); c.parentNode = el; return c; },
    removeChild(c: El) { el.children = el.children.filter((x: El) => x !== c); c.parentNode = null; return c; },
    get firstChild() { return el.children[0] ?? null; },
    addEventListener(ev: string, fn: (e: unknown) => void) { (el.listeners[ev] ??= []).push(fn); },
    focus() {},
    scrollIntoView() {},
    closest() { return null; },
    querySelector(sel: string): El | null { return walk(el, sel)[0] ?? null; },
    querySelectorAll(sel: string): El[] { return walk(el, sel); },
    ...extra,
  };
  if (extra['attrs']) {
    for (const [k, v] of Object.entries(extra['attrs'] as Record<string, string>)) el.attrs[k] = v;
  }
  return el;
}

function matchesSel(el: El, sel: string): boolean {
  const parts = sel.split(',').map((s) => s.trim());
  for (const part of parts) {
    const m = /^([a-z0-9]*)(\.[a-z0-9_-]+)?((?:\[[^\]]+\])+)?$/i.exec(part);
    if (!m) continue;
    const [, tag, cls, attrsPart] = m;
    if (tag && el.tagName !== tag) continue;
    if (cls && !String(el.className).split(' ').includes(cls.slice(1))) continue;
    let ok = true;
    if (attrsPart) {
      const re = /\[([^=\]]+)(?:="([^"]*)")?\]/g;
      let am: RegExpExecArray | null;
      while ((am = re.exec(attrsPart))) {
        const k = am[1]!;
        if (am[2] !== undefined) {
          if ((el.attrs[k] ?? el[k]) !== am[2]) { ok = false; break; }
        } else if (!(k in el.attrs)) {
          ok = false; break;
        }
      }
    }
    if (ok && (tag || cls || attrsPart)) return true;
  }
  return false;
}

function walk(root: El, sel: string): El[] {
  const out: El[] = [];
  for (const c of root.children as El[]) {
    if (matchesSel(c, sel)) out.push(c);
    out.push(...walk(c, sel));
  }
  return out;
}

describe('UX Phase 5 — Growth Loops (S4, S9, S12, Q6)', () => {
  it('S4: renders structured builders, 80-line counters, splits multi-line paste, syncs step timers, and rejects >80 lines on save', async () => {
    // 1. HTML capture form exposes structured builders + 80-line counters + section rendering on RecipeView
    const formRes = await app.request(`${ORIGIN}/account/recipes/new`, {}, makeEnv());
    expect(formRes.status).toBe(200);
    const formHtml = await formRes.text();
    expect(formHtml).toContain('data-ing-builder');
    expect(formHtml).toContain('data-step-builder');
    expect(formHtml).toContain('data-ing-counter');
    expect(formHtml).toContain('0 / 80 lines');
    expect(formHtml).toContain('capture-units');

    const recipeHtml = renderRecipe({
      recipe: { id: 'sec1', sourceId: 's1', originCountry: 'us', imageKey: null, createdAt: '2026-01-01', category: 'mains' },
      locale: { recipeId: 'sec1', country: 'us', lang: 'en', title: 'Tacos', slug: 'tacos', intro: 'Crisp.', ingredientsJson: JSON.stringify(['For the salsa:', '2 tbsp olive oil']), stepsJson: JSON.stringify(['Simmer 10 min.']), status: 'published' },
      source: { id: 's1', name: '2yolks', url: 'https://2yolks.com/', license: 'CC0-1.0', clearedAt: '2026-01-01', notes: null },
    }, []);
    expect(recipeHtml).toContain('<li class="ing-section-head"><strong>For the salsa</strong></li>');

    // 2. Client ES5 helpers + CAPTURE_CLIENT_SCRIPT split pasted lines and sync step timer cards
    const helpers = new Function(`${CAPTURE_HELPERS_JS}; return { parseIngRow: parseIngRow, formatIngRow: formatIngRow };`)() as {
      parseIngRow: (l: string) => { isSection: boolean; qty: string; unit: string; item: string };
      formatIngRow: (r: { isSection: boolean; qty: string; unit: string; item: string }) => string;
    };
    expect(helpers.parseIngRow('For the sauce:')).toEqual({ isSection: true, qty: '', unit: '', item: 'For the sauce' });
    expect(helpers.parseIngRow('2 cups of flour')).toEqual({ isSection: false, qty: '2', unit: 'cups', item: 'flour' });
    expect(helpers.formatIngRow({ isSection: false, qty: '2', unit: 'cups', item: 'flour' })).toBe('2 cups flour');

    const root = makeEl('main');
    const form = makeEl('form', { attrs: { 'data-capture-form': '' } });
    const ingBuilder = makeEl('div', { attrs: { 'data-ing-builder': '' } });
    const ingRows = makeEl('div', { attrs: { 'data-ing-rows': '' } });
    const ingAdd = makeEl('button', { attrs: { 'data-ing-add': '' } });
    const ingAddSec = makeEl('button', { attrs: { 'data-ing-add-section': '' } });
    const ingTa = makeEl('textarea', { attrs: { name: 'ingredients', id: 'f-ingredients' } });
    const ingCounter = makeEl('span', { attrs: { 'data-ing-counter': '', 'data-tpl': '{n} / {max} lines' } });
    ingBuilder.appendChild(ingRows); ingBuilder.appendChild(ingAdd); ingBuilder.appendChild(ingAddSec); ingBuilder.appendChild(ingTa);
    const stepBuilder = makeEl('div', { attrs: { 'data-step-builder': '' } });
    const stepCards = makeEl('div', { attrs: { 'data-step-cards': '' } });
    const stepAdd = makeEl('button', { attrs: { 'data-step-add': '' } });
    const stepTa = makeEl('textarea', { attrs: { name: 'steps', id: 'f-steps' } });
    const stepCounter = makeEl('span', { attrs: { 'data-step-counter': '', 'data-tpl': '{n} / {max} lines' } });
    stepBuilder.appendChild(stepCards); stepBuilder.appendChild(stepAdd); stepBuilder.appendChild(stepTa);
    const checksBox = makeEl('ul', { attrs: { 'data-live-checks': '' } });
    for (const k of ['title', 'ingredients', 'qty', 'cups', 'steps', 'servings', 'source']) {
      checksBox.appendChild(makeEl('li', { attrs: { 'data-check': k } }));
    }
    const fields: Record<string, El> = {
      category: makeEl('select', { attrs: { name: 'category' }, options: [{ value: '', textContent: '' }] }),
      title: makeEl('input', { attrs: { name: 'title' } }),
      locale: makeEl('select', { attrs: { name: 'locale' }, value: 'us:en' }),
      intro: makeEl('textarea', { attrs: { name: 'intro' } }),
      ingredients: ingTa,
      steps: stepTa,
      prep: makeEl('input', { attrs: { name: 'prep' } }),
      cook: makeEl('input', { attrs: { name: 'cook' } }),
      servings: makeEl('input', { attrs: { name: 'servings' } }),
      display_name: makeEl('input', { attrs: { name: 'display_name' } }),
      source_kind: makeEl('select', { attrs: { name: 'source_kind' }, value: 'original' }),
      source_url: makeEl('input', { attrs: { name: 'source_url' } }),
      attest: makeEl('input', { attrs: { name: 'attest' } }),
    };
    for (const k of Object.keys(fields)) {
      if (k !== 'ingredients' && k !== 'steps') form.appendChild(fields[k]!);
    }
    form.appendChild(ingCounter); form.appendChild(ingBuilder);
    form.appendChild(stepCounter); form.appendChild(stepBuilder);
    root.appendChild(form);
    root.appendChild(checksBox);
    const fakeDoc = {
      documentElement: { lang: 'en' },
      body: { style: {} },
      createElement: (tag: string) => makeEl(tag),
      getElementById(id: string) {
        if (id === 'capture-check-strings') return { textContent: CAPTURE_CHECK_STRINGS };
        if (id === 'capture-cat-labels') return { textContent: JSON.stringify({ en: { __prompt: 'P', __unsure: 'U', __preamble: 'A', __preambleHint: 'H' } }) };
        return null;
      },
      querySelector: (s: string) => walk(root, s)[0] ?? null,
      querySelectorAll: (s: string) => walk(root, s),
    };
    new Function('window', 'document', CAPTURE_CLIENT_SCRIPT)({ location: { search: '' } }, fakeDoc);
    // Simulate multi-line paste into first ingredient item input
    const firstRowItem = ingRows.children[0]!.children[2]!;
    firstRowItem.listeners['paste']![0]!({
      preventDefault() {},
      clipboardData: { getData: () => 'For the sauce:\n2 cups flour\n250 g butter' },
    });
    expect(ingRows.children).toHaveLength(4);
    expect(ingTa.value).toBe('For the sauce:\n2 cups flour\n250 g butter');
    expect(ingCounter.textContent).toBe('3 / 80 lines');

    // Delete first section row & swap order
    ingRows.children[0]!.children[1]!.children[2]!.listeners['click']![0]!({});
    expect(ingTa.value).toBe('2 cups flour\n250 g butter');

    // Edit step card 1 text & timer
    const firstStepCard = stepCards.children[0]!;
    const cardTa = firstStepCard.querySelector('.step-card-text')!;
    const cardTimer = firstStepCard.querySelector('input')!;
    cardTa.value = 'Toast walnuts';
    cardTa.listeners['input']![0]!({});
    cardTimer.value = '15';
    cardTimer.listeners['input']![0]!({});
    expect(stepTa.value).toBe('Toast walnuts (15 min)');

    // 3. Server enforces 80-line cap with clear 400 error & aria-invalid
    const cookie = await signIn();
    const eightyOneIng = Array.from({ length: 81 }, (_, i) => `1 g item ${i + 1}`).join('\n');
    const saveRes = await app.request(
      `${ORIGIN}/account/recipes/save`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          title: 'Long Recipe',
          locale: 'us:en',
          ingredients: eightyOneIng,
          steps: Array.from({ length: 81 }, (_, i) => `Step ${i + 1}`).join('\n'),
          display_name: 'Sam',
          source_kind: 'original',
        }).toString(),
      },
      makeEnv(),
    );
    expect(saveRes.status).toBe(400);
    const saveHtml = await saveRes.text();
    expect(saveHtml).toContain('Up to 80 ingredient lines allowed');
    expect(saveHtml).toContain('Up to 80 steps allowed');
    expect(saveHtml).toContain('id="f-ingredients" required aria-invalid="true"');
    expect(saveHtml).toContain('id="f-steps" required aria-invalid="true"');
  });

  it('S9: adds Remix CTA on live recipes, pre-fills adapted draft cleanly, gates private drafts, and celebrates live recipes on /account', async () => {
    await seedPublished({
      id: 'pub1',
      slug: 'skillet-beans',
      title: 'Skillet White Beans',
      ingredients: ['400 g cannellini beans', '2 tbsp olive oil'],
      steps: ['Simmer 8 min.'],
      authorName: 'Elena Morales',
    });
    await seedPublished({
      id: 'priv1',
      slug: 'secret-draft',
      title: 'Secret Uncleared Draft',
      ingredients: ['1 cup sugar'],
      clearedAt: null,
      status: 'draft',
    });

    // Live recipe page shows Remix callout
    const recRes = await app.request(`${ORIGIN}/us/recipes/skillet-beans`, {}, makeEnv());
    expect(recRes.status).toBe(200);
    const recHtml = await recRes.text();
    expect(recHtml).toContain('data-remix-cta');
    expect(recHtml).toContain('/account/recipes/new?remix=pub1');

    // /account/recipes/new?remix=pub1 pre-fills adapted draft with credit
    const remixRes = await app.request(`${ORIGIN}/account/recipes/new?remix=pub1`, {}, makeEnv());
    expect(remixRes.status).toBe(200);
    const remixHtml = await remixRes.text();
    expect(remixHtml).toContain('data-remix-banner');
    expect(remixHtml).toContain('My Skillet White Beans');
    expect(remixHtml).toContain('https://2yolks.com/us/recipes/skillet-beans');
    expect(remixHtml).toContain('<option value="adapted" selected>');

    // Security gate: private/uncleared recipe cannot be remixed
    const privRes = await app.request(`${ORIGIN}/account/recipes/new?remix=priv1`, {}, makeEnv());
    expect(privRes.status).toBe(200);
    const privHtml = await privRes.text();
    expect(privHtml).not.toContain('Secret Uncleared Draft');
    expect(privHtml).not.toContain('data-remix-banner');

    // Live recipe celebration on /account dashboard + valid live share script compilation
    expect(() => new Function(ACCOUNT_LIVE_SHARE_SCRIPT)).not.toThrow();
    const cookie = await signIn('creator@example.com');
    const userRow = await DB.prepare("SELECT id FROM users WHERE email = 'creator@example.com'").first<{ id: string }>();
    await DB.prepare("UPDATE recipes SET owner_user_id = ?, submitted_at = '2026-01-03T00:00:00Z', review_status = 'published' WHERE id = 'pub1'")
      .bind(userRow!.id)
      .run();
    const dashRes = await app.request(`${ORIGIN}/account`, { headers: { cookie } }, makeEnv());
    expect(dashRes.status).toBe(200);
    const dashHtml = await dashRes.text();
    expect(dashHtml).toContain('data-live-celebration');
    expect(dashHtml).toContain('Your recipe is live');
    expect(dashHtml).toContain('data-acct-story-card');
    expect(dashHtml).toContain('data-acct-copy-url');
    expect(dashHtml).toContain('https://wa.me/?text=');
    expect(dashHtml).toContain('View live recipe');
    expect(dashHtml).toContain('class="status-timeline"');
  });

  it('S12: turns safe zero-result search gaps into recipe prompts on /search and /account/recipes/new while filtering XSS/URL junk', async () => {
    await seedPublished({
      id: 'pub2',
      slug: 'garlic-eggs',
      title: 'Garlic Skillet Eggs',
      ingredients: ['4 eggs', '2 cloves garlic'],
    });
    // Zero-hit search logs search_gap_logs and links CTA to ?prompt=...
    const missRes = await app.request(`${ORIGIN}/search?q=vegetarian+lasagna`, {}, makeEnv());
    expect(missRes.status).toBe(200);
    const missHtml = await missRes.text();
    expect(missHtml).toContain('/account/recipes/new?prompt=vegetarian%20lasagna');

    // Insert adversarial junk alongside real search gap
    await DB.prepare("INSERT INTO search_gap_logs (query, locale) VALUES ('https://spam.example/x', 'en'), ('<script>alert(1)</script>', 'en'), ('chickpea curry', 'en')").run();

    const newRes = await app.request(`${ORIGIN}/account/recipes/new`, {}, makeEnv());
    expect(newRes.status).toBe(200);
    const newHtml = await newRes.text();
    expect(newHtml).toContain('data-gap-prompts');
    expect(newHtml).toContain('vegetarian lasagna');
    expect(newHtml).not.toContain('https://spam.example');
    expect(newHtml).not.toContain('<script>alert(1)');

    // Second empty search surfaces existing gap requests
    const miss2 = await app.request(`${ORIGIN}/search?q=gnocchi`, {}, makeEnv());
    const miss2Html = await miss2.text();
    expect(miss2Html).toContain('data-empty-gap-prompts');
    expect(miss2Html).toContain('prompt=vegetarian%20lasagna');

    // Clicking or visiting ?prompt=... pre-fills title cleanly
    const prefillRes = await app.request(`${ORIGIN}/account/recipes/new?prompt=vegetarian+lasagna`, {}, makeEnv());
    const prefillHtml = await prefillRes.text();
    expect(prefillHtml).toContain('data-gap-prefilled');
    expect(prefillHtml).toContain('value="Vegetarian lasagna"');
  });

  it('Q6: supports Cook with what you have (/search?have=...) ranking best matches, noindex, and combining with filters', async () => {
    await seedPublished({
      id: 'pan3',
      slug: 'tomato-garlic-eggs',
      title: 'Tomato Garlic Eggs',
      ingredients: ['4 eggs', '2 cloves garlic', '2 cups tomatoes', '1 tbsp olive oil'],
    });
    await seedPublished({
      id: 'pan2',
      slug: 'garlic-chicken-skillet',
      title: 'Garlic Chicken Skillet',
      ingredients: ['500 g chicken breast', '2 cloves garlic', '4 eggs'],
    });
    await seedPublished({
      id: 'pan1',
      slug: 'plain-rice',
      title: 'Steamed Rice',
      ingredients: ['2 cups white rice', '3 cups water'],
    });

    const res = await app.request(`${ORIGIN}/search?have=eggs,tomatoes,garlic`, {}, makeEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    const html = await res.text();
    expect(html).toContain('data-pantry-picker');
    expect(html).toContain('data-pantry-match');
    expect(html).toContain('3/3: eggs, tomatoes, garlic');
    expect(html).toContain('2/3: eggs, garlic');
    expect(html).not.toContain('Steamed Rice');
    // 3/3 match ranks before 2/3 match
    expect(html.indexOf('Tomato Garlic Eggs')).toBeLessThan(html.indexOf('Garlic Chicken Skillet'));

    // Combines cleanly with vegetarian diet filter (excludes Garlic Chicken Skillet)
    const vegRes = await app.request(`${ORIGIN}/search?have=eggs,tomatoes,garlic&diet=vegetarian`, {}, makeEnv());
    const vegHtml = await vegRes.text();
    expect(vegHtml).toContain('Tomato Garlic Eggs');
    expect(vegHtml).not.toContain('Garlic Chicken Skillet');
  });
});
