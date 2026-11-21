import { describe, expect, it, beforeEach } from 'vitest';
import {
  THEME_CLIENT_SCRIPT,
  GLOBAL_CHROME_SCRIPT,
  RECIPE_CLIENT_SCRIPT,
  renderHome,
  renderRecipe,
  DESIGN_SYSTEM_CSS,
} from '@2yolks/web/server';
import app from './index';
import { migratedD1All } from './testd1';

const ORIGIN = 'https://2yolks.com';

let DB: D1Database;

function makeEnv(extra: Record<string, unknown> = {}) {
  return {
    DB,
    IMAGES: {},
    ASSETS: { fetch: async () => new Response('no asset', { status: 404 }) },
    ALLOW_DEMO_SEED: 'false',
    CANONICAL_ORIGIN: ORIGIN,
    ...extra,
  };
}

async function seedSource(id = 'src-cleared') {
  await DB.prepare('INSERT OR IGNORE INTO sources (id, name, url, license, cleared_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, `Source ${id}`, `https://example.com/${id}`, 'CC-BY-4.0', '2026-01-01T00:00:00Z')
    .run();
}

async function seedRecipe(opts: {
  id: string;
  slug: string;
  title: string;
  category?: string;
  authorName?: string | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  restMinutes?: number | null;
  totalMinutes?: number | null;
  testedAt?: string | null;
  ingredients?: string[];
  steps?: string[];
  image?: { id: string; style: 'photo' | 'illustration' | 'graphic' } | null;
  stepImageId?: string | null;
}) {
  await DB.prepare(
    'INSERT INTO recipes (id, source_id, origin_country, category, prep_minutes, cook_minutes, rest_minutes, total_minutes, tested_at, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      opts.id,
      'src-cleared',
      'mx',
      opts.category ?? 'mains',
      opts.prepMinutes ?? 10,
      opts.cookMinutes ?? 20,
      opts.restMinutes ?? 5,
      opts.totalMinutes ?? 35,
      opts.testedAt === undefined ? null : opts.testedAt,
      opts.authorName === undefined ? null : opts.authorName,
      '2026-01-01T00:00:00Z',
    )
    .run();

  await DB.prepare(
    'INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      opts.id,
      'us',
      'en',
      opts.title,
      opts.slug,
      'Bright homemade dish.',
      JSON.stringify(opts.ingredients ?? ['2 eggs', '200 g flour', '1 lime', '10 ml olive oil', '500 g chicken breast']),
      JSON.stringify(opts.steps ?? ['Heat skillet and simmer 12 minutes until tender.', 'Serve warm with lime.']),
      'published',
    )
    .run();

  if (opts.image) {
    await DB.prepare(
      'INSERT INTO recipe_images (id, recipe_id, kind, r2_key, mime, bytes, style, source_name, source_url, license, cleared_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        opts.image.id,
        opts.id,
        'hero',
        `recipes/${opts.image.id}.webp`,
        'image/webp',
        1024,
        opts.image.style,
        '2yolks kitchen',
        'https://2yolks.com/',
        'CC0-1.0',
        '2026-01-01T00:00:00Z',
        '2026-01-01T00:00:00Z',
      )
      .run();
  }

  if (opts.stepImageId) {
    await DB.prepare(
      'INSERT INTO recipe_images (id, recipe_id, kind, step_index, r2_key, mime, bytes, style, source_name, source_url, license, cleared_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        opts.stepImageId,
        opts.id,
        'step',
        0,
        `recipes/${opts.stepImageId}.webp`,
        'image/webp',
        1024,
        'photo',
        '2yolks kitchen',
        'https://2yolks.com/',
        'CC0-1.0',
        '2026-01-01T00:00:00Z',
        '2026-01-01T00:00:00Z',
      )
      .run();
  }
}

beforeEach(async () => {
  DB = migratedD1All();
  await seedSource('src-cleared');
});

describe('UX Phase 4 Graphic System (D1-D3, D5-D10)', () => {
  it('D1 & D10: unifies CSS into one <style> block, respects OS color scheme, sets aria-pressed, and includes reduced-motion rules', async () => {
    await seedRecipe({ id: 'r1', slug: 'skillet-chicken', title: 'Skillet Chicken' });
    const res = await app.request(`${ORIGIN}/`, {}, makeEnv());
    expect(res.status).toBe(200);
    const html = await res.text();

    expect((html.match(/<style>/g) || []).length).toBe(1);
    expect(html).toContain("--font-display:'Barlow Condensed'");
    expect(DESIGN_SYSTEM_CSS).toContain('@media (prefers-reduced-motion: reduce)');
    expect(DESIGN_SYSTEM_CSS).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toMatch(/data-theme-toggle="true" aria-pressed="false"/);
    expect(html).toContain('prefers-color-scheme: dark');

    // Execute THEME_CLIENT_SCRIPT in fake DOM with prefers-color-scheme: dark
    const docAttrs: Record<string, string> = {};
    const store = new Map<string, string>();
    const btnListeners: Record<string, (() => void)[]> = {};
    const btn = {
      attrs: { 'aria-pressed': 'false' } as Record<string, string>,
      setAttribute(k: string, v: string) { this.attrs[k] = v; },
      addEventListener(ev: string, fn: () => void) { (btnListeners[ev] ??= []).push(fn); },
    };
    const fakeDoc = {
      documentElement: {
        getAttribute: (k: string) => docAttrs[k] ?? null,
        setAttribute: (k: string, v: string) => { docAttrs[k] = v; },
      },
      querySelectorAll: (sel: string) => (sel === '[data-theme-toggle]' ? [btn] : []),
    };
    const fakeWin = {
      matchMedia: (q: string) => ({ matches: q.includes('dark'), addEventListener: () => {} }),
    };
    const fakeLs = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    };
    new Function('window', 'document', 'localStorage', THEME_CLIENT_SCRIPT)(fakeWin, fakeDoc, fakeLs);
    // Initial sync with OS dark preference marks toggle pressed=true
    expect(btn.attrs['aria-pressed']).toBe('true');
    // Clicking flips from dark -> light
    btnListeners.click?.forEach((fn) => fn());
    expect(docAttrs['data-theme']).toBe('light');
    expect(store.get('2y-theme')).toBe('light');
    expect(btn.attrs['aria-pressed']).toBe('false');
  });

  it('D2 & D3: defaults to photo-first Cards grid, renders SVG CategoryArt on graphic/imageless cards, and avoids double untested badges', async () => {
    await seedRecipe({
      id: 'r-gfx',
      slug: 'pozole-graphic',
      title: 'Pozole Verde',
      category: 'soups-stews',
      image: { id: 'img-gfx', style: 'graphic' },
    });
    await seedRecipe({
      id: 'r-noimg',
      slug: 'plain-tacos',
      title: 'Plain Tacos',
      category: 'tacos-tortillas',
      image: null,
    });

    for (const path of ['/', '/search?q=tacos', '/recipes/soups-stews']) {
      const res = await app.request(`${ORIGIN}${path}`, {}, makeEnv());
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('data-view-btn="grid" aria-pressed="true"');
      expect(html).toContain('data-view="grid"');
    }

    const res = await app.request(`${ORIGIN}/`, {}, makeEnv());
    const html = await res.text();
    // Graphic-style card uses CategoryArt SVG + >Graphic</span> and NOT /img/recipe/img-gfx
    expect(html).toContain('class="recipe-thumb recipe-thumb--graphic"');
    expect(html).toContain('class="category-art-svg"');
    expect(html).toContain('>Graphic</span>');
    expect(html).not.toContain('/img/recipe/img-gfx');

    // Imageless card uses card-art-fallback without has-thumb
    expect(html).toContain('class="card-art-fallback"');
    expect(html).toMatch(/<li data-recipe-item="true"[^>]*data-title="Plain Tacos"[^>]*><span class="recipe-number"><\/span><span class="card-art-fallback"/);

    // "Not yet tested" appears at most once inside each card <li>
    const cardMatch = html.match(/<li data-recipe-item="true"[\s\S]*?<\/li>/g) || [];
    expect(cardMatch.length).toBeGreaterThanOrEqual(2);
    for (const card of cardMatch) {
      expect((card.match(/Not yet tested/g) || []).length).toBeLessThanOrEqual(1);
    }
  });

  it('D5 & D6: renders story-style category rail medallions and switches Hero to 2x2 photo mosaic when >=2 cleared photos exist', () => {
    const noPhotoHtml = renderHome({
      recipes: [
        { id: 'r1', country: 'us', lang: 'en', slug: 'a', title: 'One Soup', category: 'soups-stews', untested: true },
        { id: 'r2', country: 'us', lang: 'en', slug: 'b', title: 'One Photo Taco', category: 'tacos-tortillas', untested: true, imageId: 'ph1', imageStyle: 'photo' },
      ],
      locales: [],
      lang: 'en',
    });
    expect(noPhotoHtml).toContain('class="cat-nav cat-rail"');
    expect(noPhotoHtml).toContain('class="cat-rail-ring"');
    expect(noPhotoHtml).toContain('/img/identity/after-hours.webp');
    expect(noPhotoHtml).not.toContain('data-hero-mosaic');

    const mosaicHtml = renderHome({
      recipes: [
        { id: 'r1', country: 'us', lang: 'en', slug: 'a', title: 'Photo Soup', category: 'soups-stews', untested: true, imageId: 'ph1', imageStyle: 'photo' },
        { id: 'r2', country: 'us', lang: 'en', slug: 'b', title: 'Photo Tacos', category: 'tacos-tortillas', untested: true, imageId: 'ph2', imageStyle: 'photo' },
      ],
      locales: [],
      lang: 'en',
    });
    expect(mosaicHtml).toContain('data-hero-mosaic="true"');
    expect(mosaicHtml).toContain('/img/recipe/ph1');
    expect(mosaicHtml).toContain('/img/recipe/ph2');
    expect(mosaicHtml).not.toContain('/img/identity/after-hours.webp');
  });

  it('D7 & D8: renders recipe effort/time meter, ingredient micro-icons, tappable step timer chips, step photos, related photos, and contributor hubs /cooks/:slug', async () => {
    await seedRecipe({
      id: 'r-elena-1',
      slug: 'elena-chicken',
      title: 'Elena Lemon Chicken',
      category: 'mains',
      authorName: 'Elena Morales',
      prepMinutes: 15,
      cookMinutes: 35,
      restMinutes: 10,
      totalMinutes: 60,
      testedAt: '2026-10-05T00:00:00Z',
      image: { id: 'ph-elena-1', style: 'photo' },
      stepImageId: 'step-elena-1',
    });
    await seedRecipe({
      id: 'r-elena-2',
      slug: 'elena-beans',
      title: 'Elena Black Beans',
      category: 'mains',
      authorName: 'Elena Morales',
      totalMinutes: 25,
      testedAt: null,
      image: { id: 'ph-elena-2', style: 'photo' },
    });

    // Add 2 approved test reports -> cookedCount = 2 without ever exposing user email
    await DB.prepare('INSERT INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)')
      .bind('u-cook-1', 'secret-cook1@example.com', 'Sam T.', '2026-01-01T00:00:00Z')
      .run();
    await DB.prepare('INSERT INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)')
      .bind('u-cook-2', 'secret-cook2@example.com', 'Alex', '2026-01-01T00:00:00Z')
      .run();
    await DB.prepare('INSERT INTO recipe_test_reports (id, recipe_id, user_id, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind('rep-1', 'r-elena-1', 'u-cook-1', 'Delicious', 'approved', '2026-10-06T00:00:00Z')
      .run();
    await DB.prepare('INSERT INTO recipe_test_reports (id, recipe_id, user_id, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind('rep-2', 'r-elena-1', 'u-cook-2', 'Worked great', 'approved', '2026-10-07T00:00:00Z')
      .run();

    // Recipe page checks
    const recRes = await app.request(`${ORIGIN}/us/recipes/elena-chicken`, {}, makeEnv());
    expect(recRes.status).toBe(200);
    const recHtml = await recRes.text();
    expect(recHtml).toContain('Shared by Elena Morales');
    expect(recHtml).toContain('href="/cooks/elena-morales"');
    expect(recHtml).toContain('Cooked by 2');
    expect(recHtml).toContain('class="recipe-meter"');
    expect(recHtml).toContain('class="time-seg-prep"');
    expect(recHtml).toContain('ing-icon--egg');
    expect(recHtml).toContain('ing-icon--grain');
    expect(recHtml).toContain('ing-icon--protein');
    expect(recHtml).toContain('data-inline-timer="12"');
    expect(recHtml).toContain('data-step-text="true"');
    expect(recHtml).toContain('/img/recipe/step-elena-1');
    expect(recHtml).toContain('class="related-media"');
    expect(recHtml).toContain('/img/recipe/ph-elena-2');
    expect(recHtml).not.toContain('secret-cook1@example.com');

    // /cooks directory & /cooks/elena-morales hub & 404 & sitemap
    const dirRes = await app.request(`${ORIGIN}/cooks`, {}, makeEnv());
    expect(dirRes.status).toBe(200);
    expect(await dirRes.text()).toContain('Elena Morales');

    const hubRes = await app.request(`${ORIGIN}/cooks/elena-morales`, {}, makeEnv());
    expect(hubRes.status).toBe(200);
    const hubHtml = await hubRes.text();
    expect(hubHtml).toContain('class="hub-avatar-lg"');
    expect(hubHtml).toContain('Elena Lemon Chicken');
    expect(hubHtml).toContain('Cooked by 2');
    expect(hubHtml).not.toContain('secret-cook1@example.com');

    expect((await app.request(`${ORIGIN}/cooks/nobody`, {}, makeEnv())).status).toBe(404);

    const smRes = await app.request(`${ORIGIN}/sitemap.xml`, {}, makeEnv());
    const sm = await smRes.text();
    expect(sm).toContain('https://2yolks.com/cooks');
    expect(sm).toContain('https://2yolks.com/cooks/elena-morales');
  });

  it('D7 & D9 client runtime: toggles inline step timer chip and triggers Save ♥ pop animation (respecting reduced-motion)', () => {
    // 1. Test RECIPE_CLIENT_SCRIPT inline timer chip
    const timerClasses = new Set<string>(['step-timer-chip']);
    const chipListeners: Record<string, (() => void)[]> = {};
    const disp = { textContent: 'Timer · 12 min' };
    const chip = {
      attrs: { 'data-inline-timer': '12', 'data-timer-label-base': 'Timer · 12 min', 'data-done-label': 'Done!', 'aria-pressed': 'false' } as Record<string, string>,
      getAttribute(k: string) { return this.attrs[k] ?? null; },
      setAttribute(k: string, v: string) { this.attrs[k] = v; },
      querySelector(sel: string) { return sel === '[data-chip-display]' ? disp : null; },
      addEventListener(ev: string, fn: () => void) { (chipListeners[ev] ??= []).push(fn); },
      classList: {
        add(c: string) { timerClasses.add(c); },
        remove(c: string) { timerClasses.delete(c); },
      },
    };
    const fakeDoc = {
      querySelectorAll: (sel: string) => (sel === '[data-inline-timer]' ? [chip] : []),
      querySelector: () => null,
      getElementById: () => null,
      addEventListener: () => {},
    };
    new Function('window', 'document', RECIPE_CLIENT_SCRIPT)({ location: { href: 'https://2yolks.com/us/recipes/test' } }, fakeDoc);

    chipListeners.click?.forEach((fn) => fn());
    expect(timerClasses.has('is-running')).toBe(true);
    expect(chip.attrs['aria-pressed']).toBe('true');
    expect(disp.textContent).toMatch(/^(12:00|11:59)$/);

    // Clicking again stops and restores base label
    chipListeners.click?.forEach((fn) => fn());
    expect(timerClasses.has('is-running')).toBe(false);
    expect(chip.attrs['aria-pressed']).toBe('false');
    expect(disp.textContent).toBe('Timer · 12 min');

    // 2. Test GLOBAL_CHROME_SCRIPT yolk-pop respects prefers-reduced-motion
    function testPop(reducedMotion: boolean) {
      const cls = new Set<string>(['save-btn']);
      const listeners: Record<string, ((e: unknown) => void)[]> = {};
      const lsMap = new Map<string, string>();
      const ls = {
        getItem: (k: string) => lsMap.get(k) ?? null,
        setItem: (k: string, v: string) => { lsMap.set(k, v); },
        removeItem: (k: string) => { lsMap.delete(k); },
      };
      const saveBtn = {
        attrs: { 'data-save-recipe': 'r1', 'aria-pressed': 'false', 'data-recipe-meta': '{"id":"r1","title":"A","href":"/"}' } as Record<string, string>,
        getAttribute(k: string) { return this.attrs[k] ?? null; },
        setAttribute(k: string, v: string) { this.attrs[k] = v; },
        addEventListener(ev: string, fn: (e: unknown) => void) { (listeners[ev] ??= []).push(fn); },
        querySelector: () => null,
        classList: {
          add(c: string) { cls.add(c); },
          remove(c: string) { cls.delete(c); },
        },
      };
      const gDoc = {
        documentElement: { lang: 'en' },
        querySelector: () => null,
        querySelectorAll: (sel: string) => (sel === '[data-save-recipe]' ? [saveBtn] : []),
        getElementById: () => null,
        addEventListener: () => {},
      };
      const gWin = {
        localStorage: ls,
        matchMedia: (q: string) => ({ matches: q.includes('reduce') ? reducedMotion : false }),
      };
      new Function('window', 'document', 'localStorage', GLOBAL_CHROME_SCRIPT)(gWin, gDoc, ls);
      listeners.click?.forEach((fn) => fn({ preventDefault() {}, stopPropagation() {} }));
      return cls.has('is-popping');
    }

    expect(testPop(false)).toBe(true);
    expect(testPop(true)).toBe(false);
  });

  it('keeps pure renderRecipe compatible with RecipeView defaults when authorName/cookedCount are omitted', () => {
    const html = renderRecipe(
      {
        recipe: { id: 'r0', sourceId: 's0', originCountry: 'us', imageKey: null, createdAt: '2026-01-01', category: 'mains' },
        locale: { recipeId: 'r0', country: 'us', lang: 'en', title: 'Simple Toast', slug: 'simple-toast', intro: 'Crisp.', ingredientsJson: '["2 slices bread"]', stepsJson: '["Toast 3 min."]', status: 'published' },
        source: { id: 's0', name: '2yolks', url: 'https://2yolks.com/', license: 'CC0-1.0', clearedAt: '2026-01-01', notes: null },
      },
      [{ hreflang: 'en-US', href: 'https://2yolks.com/us/recipes/simple-toast' }],
    );
    expect(html).not.toContain('class="contributor-byline"');
    expect(html).toContain('data-inline-timer="3"');
    expect(html).toContain('ing-icon--grain');
  });
});
