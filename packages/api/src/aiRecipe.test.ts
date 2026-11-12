import { describe, it, expect, beforeEach } from 'vitest';
import app from './index';
import { migratedD1All } from './testd1';
import { sha256Hex, SESSION_COOKIE } from './account';
import {
  AI_MODEL,
  GEMINI_INTERACTIONS_URL,
  GEMINI_API_REVISION,
  assistRecipeWithGemini,
  assistRecipeDeterministic,
  translateStructuredRecipeWithGemini,
  reserveAiBudget,
} from './aiRecipe';

const ORIGIN = 'https://2yolks.com';

describe('Gemini 3.8 Flash multimodal recipe co-editor & SVG story card routes', () => {
  let DB: D1Database;

  beforeEach(() => {
    DB = migratedD1All();
  });

  async function createSessionCookie(email = 'chef@example.com'): Promise<string> {
    const userId = 'u_chef01';
    const token = 'a'.repeat(64);
    const now = Date.now();
    await DB.prepare('INSERT INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)')
      .bind(userId, email, 'Chef Lucia', new Date(now).toISOString())
      .run();
    await DB.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256Hex(token), userId, now + 86_400_000, now)
      .run();
    return `${SESSION_COOKIE}=${token}`;
  }

  it('calls Gemini Interactions API with gemini-3.8-flash, store:false, multimodal image+audio, and JSON schema', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const mockFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          id: 'int_123',
          steps: [
            {
              type: 'model_output',
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    title: 'Salsa Macha de Cacahuate',
                    category: 'snacks-dips',
                    intro: 'Crisp toasted peanuts, sesame seeds, and smoky árbol chiles in olive oil.',
                    ingredients: ['120 g raw peanuts', '25 g dried chile de árbol, stemmed', '240 ml extra-virgin olive oil'],
                    steps: ['Warm the olive oil with garlic and peanuts over medium-low heat until golden.', 'Off the heat, stir in chiles and sesame seeds, cool 10 minutes, and pulse coarsely.'],
                    prepMinutes: 10,
                    cookMinutes: 12,
                    servings: 8,
                    improvements: ['Added gram & ml weights and split the off-heat chile step so they never burn.'],
                    followUpQuestions: [
                      {
                        id: 'salt',
                        question: 'How much salt did you season the jar with?',
                        field: 'ingredients',
                        quickChoices: ['1 tsp fine sea salt', '1 ½ tsp kosher salt'],
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const out = await assistRecipeWithGemini(
      {
        mode: 'extract',
        uiLang: 'en',
        recipeLocale: 'mx:es',
        notes: 'Fried peanuts and garlic in olive oil, added arbol chiles off heat.',
        image: { mimeType: 'image/jpeg', data: 'aGVsbG8=' },
        audio: { mimeType: 'audio/webm', data: 'd29ybGQ=' },
      },
      'test-gemini-key',
      mockFetch,
    );

    expect(capturedUrl).toBe(GEMINI_INTERACTIONS_URL);
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers['Api-Revision']).toBe(GEMINI_API_REVISION);
    expect(headers['x-goog-api-key']).toBe('test-gemini-key');
    const body = JSON.parse(String(capturedInit?.body));
    expect(body.model).toBe(AI_MODEL);
    expect(body.store).toBe(false);
    expect(body.response_format.mime_type).toBe('application/json');
    expect(body.input).toHaveLength(3);
    expect(body.input[1]).toEqual({ type: 'image', data: 'aGVsbG8=', mime_type: 'image/jpeg' });
    expect(body.input[2]).toEqual({ type: 'audio', data: 'd29ybGQ=', mime_type: 'audio/webm' });

    expect(out.provider).toBe('gemini');
    expect(out.recipe.title).toBe('Salsa Macha de Cacahuate');
    expect(out.recipe.category).toBe('snacks-dips');
    expect(out.recipe.ingredients).toHaveLength(3);
    expect(out.followUpQuestions[0]?.quickChoices).toContain('1 tsp fine sea salt');
  });

  it('deterministic co-editor splits multi-action steps and flags missing oven temp & quantities', () => {
    const out = assistRecipeDeterministic({
      mode: 'polish',
      uiLang: 'en',
      recipeLocale: 'us:en',
      draft: {
        title: 'Cardamom Skillet Cookie',
        ingredients: ['200 g flour', 'cardamom pods'],
        steps: ['Cream butter and sugar until fluffy. Fold in flour and chocolate chips, then bake in the oven for 22 minutes until golden at the edges.'],
      },
    });
    expect(out.provider).toBe('deterministic');
    expect(out.recipe.category).toBe('desserts-baking');
    expect(out.recipe.steps).toHaveLength(2);
    expect(out.recipe.cookMinutes).toBe(22);
    const qIds = out.followUpQuestions.map((q) => q.id);
    expect(qIds).toContain('oven_temp');
    expect(qIds).toContain('ing_qty');
  });

  it('enforces atomic D1 per-user and daily free-tier AI caps', async () => {
    for (let i = 0; i < 3; i++) {
      expect(await reserveAiBudget(DB, 'u1', 'extract', 5, 3)).toBe(true);
    }
    // 4th try by same user within 10 min hits perUserWindowCap (3)
    expect(await reserveAiBudget(DB, 'u1', 'extract', 5, 3)).toBe(false);
    // Another user still has room up to dailyCap (5)
    expect(await reserveAiBudget(DB, 'u2', 'polish', 5, 3)).toBe(true);
    expect(await reserveAiBudget(DB, 'u2', 'polish', 5, 3)).toBe(true);
    // 6th total try across the site hits dailyCap (5)
    expect(await reserveAiBudget(DB, 'u3', 'extract', 5, 3)).toBe(false);
  });

  it('serves POST /account/recipes/ai-assist with auth, CSRF, and D1 cap enforcement', async () => {
    const unauth = await app.request(
      `${ORIGIN}/account/recipes/ai-assist`,
      { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{}' },
      { DB, CANONICAL_ORIGIN: ORIGIN, ASSETS: { fetch: async () => new Response('no', { status: 404 }) } as unknown as Fetcher },
    );
    expect(unauth.status).toBe(303);
    expect(unauth.headers.get('location')).toBe('/account');

    const cookie = await createSessionCookie();
    const csrfBlocked = await app.request(
      `${ORIGIN}/account/recipes/ai-assist`,
      { method: 'POST', headers: { origin: 'https://evil.example', cookie, 'content-type': 'application/json' }, body: '{}' },
      { DB, CANONICAL_ORIGIN: ORIGIN, ASSETS: { fetch: async () => new Response('no', { status: 404 }) } as unknown as Fetcher },
    );
    expect(csrfBlocked.status).toBe(403);

    const okRes = await app.request(
      `${ORIGIN}/account/recipes/ai-assist?lang=es`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'extract',
          uiLang: 'es',
          recipeLocale: 'mx:es',
          notes: 'Pozole rojo rápido\n1 kg espaldilla de cerdo\nHervir la carne 90 minutos. Licuar chiles y servir.',
        }),
      },
      { DB, CANONICAL_ORIGIN: ORIGIN, AI_DAILY_CAP: '1', ASSETS: { fetch: async () => new Response('no', { status: 404 }) } as unknown as Fetcher },
    );
    expect(okRes.status).toBe(200);
    const json = (await okRes.json()) as { ok: boolean; recipe: { title: string; category: string; steps: string[] } };
    expect(json.ok).toBe(true);
    expect(json.recipe.title).toBe('Pozole rojo rápido');
    expect(json.recipe.category).toBe('soups-stews');
    expect(json.recipe.steps).toHaveLength(2);

    // Next request exceeds AI_DAILY_CAP=1 -> 429 localized message
    const capped = await app.request(
      `${ORIGIN}/account/recipes/ai-assist?lang=es`,
      {
        method: 'POST',
        headers: { origin: ORIGIN, cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'polish', notes: '1 kg carne' }),
      },
      { DB, CANONICAL_ORIGIN: ORIGIN, AI_DAILY_CAP: '1', ASSETS: { fetch: async () => new Response('no', { status: 404 }) } as unknown as Fetcher },
    );
    expect(capped.status).toBe(429);
  });

  it('serves localized static pages (?lang=es/fr) and 9:16 SVG Story cards gated by publish status', async () => {
    const assets = { fetch: async () => new Response('no', { status: 404 }) } as unknown as Fetcher;
    const aboutEs = await app.request(`${ORIGIN}/about?lang=es`, {}, { DB, CANONICAL_ORIGIN: ORIGIN, ASSETS: assets });
    expect(aboutEs.status).toBe(200);
    const aboutHtml = await aboutEs.text();
    expect(aboutHtml).toContain('<html lang="es">');
    expect(aboutHtml).toContain('<h1>Acerca de 2yolks</h1>');
    expect(aboutHtml).not.toContain('<h1>About 2yolks</h1>');

    const privacyFr = await app.request(`${ORIGIN}/privacy?lang=fr`, {}, { DB, CANONICAL_ORIGIN: ORIGIN, ASSETS: assets });
    expect(await privacyFr.text()).toContain('<h1>Confidentialité</h1>');

    // Seed one published recipe and one draft recipe
    await DB.prepare("INSERT INTO sources (id, name, url, license, cleared_at) VALUES ('s_pub', '2yolks', 'https://2yolks.com/', 'CC0-1.0', '2026-11-01')").run();
    await DB.prepare("INSERT INTO recipes (id, source_id, origin_country, created_at, total_minutes, base_servings, category, tested_at) VALUES ('r_pub', 's_pub', 'mx', '2026-11-01', 45, 4, 'tacos-tortillas', '2026-11-10')").run();
    await DB.prepare(`INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status)
      VALUES ('r_pub', 'mx', 'es', 'Tacos Dorados', 'tacos-dorados', 'Crujientes y dorados.', '["12 tortillas de maíz","300 g papa cocida"]', '["Rellenar y dorar."]', 'published')`).run();
    await DB.prepare(`INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status)
      VALUES ('r_pub', 'us', 'en', 'Secret Draft Tacos', 'secret-draft-tacos', null, '["12 tortillas"]', '["Fry."]', 'draft')`).run();

    const cardRes = await app.request(`${ORIGIN}/mx/recipes/tacos-dorados/card.svg`, {}, { DB, CANONICAL_ORIGIN: ORIGIN, ASSETS: assets });
    expect(cardRes.status).toBe(200);
    expect(cardRes.headers.get('content-type')).toContain('image/svg+xml');
    const svg = await cardRes.text();
    expect(svg).toContain('width="1080" height="1920"');
    expect(svg).toContain('Tacos Dorados');
    expect(svg).toContain('✓ Probada');
    expect(svg).toContain('2yolks.com/mx/recipes/tacos-dorados');

    // Draft locale must never leak via card.svg
    const draftCard = await app.request(`${ORIGIN}/us/recipes/secret-draft-tacos/card.svg`, {}, { DB, CANONICAL_ORIGIN: ORIGIN, ASSETS: assets });
    expect(draftCard.status).toBe(404);
  });

  it('translateStructuredRecipeWithGemini retries 503, repairs QA failures once, and enforces numbers/allergens', async () => {
    let calls = 0;
    const mockFetch: typeof fetch = async () => {
      calls++;
      if (calls === 1) return new Response('busy', { status: 503 });
      const payload =
        calls === 2
          ? {
              // Drops allergen word (egg -> omit) and omits step number 10 -> triggers 1 repair pass
              title: 'Crêpes aux cacahuètes',
              intro: null,
              ingredients: [
                { index: 0, text: null, name: 'beurre', note: null },
                { index: 1, text: '2 batidos grandes', name: null, note: null },
              ],
              steps: ['Mélanger {i:butter} et cuire quelques minutes.'],
            }
          : {
              title: 'Crêpes rapides',
              intro: null,
              ingredients: [
                { index: 0, text: null, name: 'beurre', note: 'fondu' },
                { index: 1, text: '2 gros œufs', name: null, note: null },
              ],
              steps: ['Mélanger {i:butter} et cuire 10 minutes.'],
            };
      return new Response(
        JSON.stringify({ id: `int_${calls}`, steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(payload) }] }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const out = await translateStructuredRecipeWithGemini(
      {
        sourceLang: 'en',
        targetLang: 'fr',
        title: 'Quick Crepes',
        intro: null,
        ingredients: [{ ref: 'butter', qty: 30, unit: 'g', name: 'butter', note: 'melted' }, '2 large eggs'],
        steps: ['Mix {i:butter} and cook 10 minutes.'],
      },
      'test-key',
      mockFetch,
      [0, 0],
    );
    expect(calls).toBe(3);
    expect(out.title).toBe('Crêpes rapides');
    expect(out.ingredients[0]).toEqual({ ref: 'butter', qty: 30, unit: 'g', name: 'beurre', note: 'fondu' });
    expect(out.ingredients[1]).toBe('2 gros œufs');
    expect(out.steps[0]).toContain('{i:butter}');

    // Always-bad output should throw QA gate error after exhausting the repair pass
    const badFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          steps: [
            {
              type: 'model_output',
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    title: 'Bad',
                    intro: null,
                    ingredients: [{ index: 0, text: null, name: 'mantequilla', note: null }, { index: 1, text: '2 piezas', name: null, note: null }],
                    steps: ['Mix {i:butter} and cook.'],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    await expect(
      translateStructuredRecipeWithGemini(
        {
          sourceLang: 'en',
          targetLang: 'es',
          title: 'Quick Crepes',
          intro: null,
          ingredients: [{ ref: 'butter', qty: 30, unit: 'g', name: 'butter' }, '2 large eggs'],
          steps: ['Mix {i:butter} and cook 10 minutes.'],
        },
        'test-key',
        badFetch,
        [0],
      ),
    ).rejects.toThrow('Translation failed QA gate');
  });

  it('POST /account/recipes/ai-assist supports mode=translate with targetLocale', async () => {
    const cookie = await createSessionCookie();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          steps: [
            {
              type: 'model_output',
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    title: 'Soupe tomate',
                    intro: 'Simple.',
                    ingredients: [{ index: 0, text: '2 tasses de bouillon', name: null, note: null }],
                    steps: ['Mijoter 15 minutes.'],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      )) as typeof fetch;
    try {
      const res = await app.request(
        `${ORIGIN}/account/recipes/ai-assist`,
        {
          method: 'POST',
          headers: { origin: ORIGIN, cookie, 'content-type': 'application/json' },
          body: JSON.stringify({
            mode: 'translate',
            uiLang: 'en',
            recipeLocale: 'us:en',
            targetLocale: 'us:fr',
            draft: {
              title: 'Tomato Soup',
              intro: 'Simple.',
              ingredients: ['2 cups stock'],
              steps: ['Simmer 15 minutes.'],
            },
          }),
        },
        { DB, CANONICAL_ORIGIN: ORIGIN, GEMINI_API_KEY: 'test-key', ASSETS: { fetch: async () => new Response('no', { status: 404 }) } as unknown as Fetcher },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; provider: string; recipe: { title: string; steps: string[] } };
      expect(body.ok).toBe(true);
      expect(body.provider).toBe('gemini');
      expect(body.recipe.title).toBe('Soupe tomate');
      expect(body.recipe.steps).toEqual(['Mijoter 15 minutes.']);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
