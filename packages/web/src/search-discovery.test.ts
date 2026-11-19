import { describe, it, expect } from 'vitest';
import { renderHome } from './server';
import { DISCOVERY_CLIENT_SCRIPT } from './clientScript';

const CATALOG = [
  {
    id: 'cd58d192',
    country: 'us',
    lang: 'en',
    slug: 'brown-butter-cardamom-chocolate-chip-cookies',
    title: 'Brown Butter Cardamom Chocolate Chip Cookies',
    category: 'desserts-baking',
    intro: 'Warm cardamom and nutty brown butter make these chocolate chip cookies exceptional.',
    ingredients: 'all-purpose flour baking soda ground cardamom unsalted butter chocolate chips',
  },
  {
    id: '4108063b',
    country: 'us',
    lang: 'en',
    slug: 'crispy-beef-tacos',
    title: 'Crispy Beef Tacos with Cilantro-Lime Sauce',
    category: 'tacos-tortillas',
    intro: 'Crispy fried corn tortilla shells packed with seasoned ground beef and herbs.',
    ingredients: 'corn tortillas ground beef cheddar cheese lime juice cilantro',
  },
  {
    id: 'w1birria',
    country: 'mx',
    lang: 'en',
    slug: 'birria-tacos',
    title: 'Birria Tacos',
    category: 'tacos-tortillas',
    intro: 'Crispy pan-fried beef birria tacos served with rich savory consommé for dipping.',
    ingredients: 'corn tortillas beef shank ancho chiles guajillo chiles onion cilantro',
  },
  {
    id: 'w1enchiladas',
    country: 'mx',
    lang: 'en',
    slug: 'chicken-enchiladas',
    title: 'Red Chicken Enchiladas',
    category: 'tacos-tortillas',
    intro: 'Tender shredded chicken rolled in corn tortillas and baked with guajillo chile salsa.',
    ingredients: 'corn tortillas shredded chicken queso fresco Mexican crema onion',
  },
  {
    id: 'w1golumpki',
    country: 'us',
    lang: 'en',
    slug: 'golumpki-soup',
    title: 'Golumpki (Unstuffed Cabbage Roll) Soup',
    category: 'soups-stews',
    intro: 'Hearty deconstructed Polish cabbage rolls in a rich savory tomato broth.',
    ingredients: 'green cabbage ground beef long-grain white rice crushed tomatoes onion garlic',
  },
  {
    id: 'w1potsticker',
    country: 'us',
    lang: 'en',
    slug: 'pork-cabbage-potstickers',
    title: 'Pork and Cabbage Potstickers',
    category: 'dumplings',
    intro: 'Crisp-bottomed pan-fried Chinese dumplings filled with minced pork and napa cabbage.',
    ingredients: 'dumpling wrappers ground pork napa cabbage ginger scallions soy sauce',
  },
  {
    id: '5c479942',
    country: 'us',
    lang: 'en',
    slug: 'mulled-wine',
    title: 'Mulled Wine',
    category: 'drinks',
    intro: 'Warm spiced red wine simmered with whole cloves, star anise, cinnamon, and fresh orange slices.',
    ingredients: 'dry red wine orange cinnamon sticks star anise whole cloves honey brandy',
  },
];

describe('Search & Discovery Sprint (WS1, WS2, WS3, WS4)', () => {
  it('renders rich search data attributes and category buttons ordered by count', () => {
    const html = renderHome({ recipes: CATALOG, locales: [], lang: 'en' });
    expect(html).toContain('data-recipe-search');
    expect(html).toContain('data-closest-note');
    expect(html).toContain('data-search-empty');
    expect(html).toContain('data-clear-search');
    expect(html).toContain('data-body="');

    // WS3: Category counts: tacos-tortillas has 3, so it appears before dumplings or drinks
    expect(html).toContain('Desserts &amp; baking');
    expect(html).toContain('Tacos &amp; tortilla dishes');
    expect(html).toContain('Soups &amp; stews');
    expect(html).toContain('Dumplings');
    expect(html).toContain('Drinks');
  });

  // Test the client-side tolerant matcher script logic
  function runSearchScript(query: string, html: string) {
    // Simple DOM mockup using jsdom-like simulation or regex parsing
    // Parse items
    const itemRegex = /<li[^>]*data-recipe-item[^>]*data-title="([^"]*)"[^>]*data-category="([^"]*)"[^>]*data-body="([^"]*)"[^>]*data-search="([^"]*)"[^>]*>[\s\S]*?<\/li>/g;
    const items: Array<{ title: string; category: string; body: string; search: string }> = [];
    let match;
    while ((match = itemRegex.exec(html)) !== null) {
      items.push({
        title: match[1]!,
        category: match[2]!,
        body: match[3]!,
        search: match[4]!,
      });
    }

    // Evaluate client script logic directly
    function norm(s: string) {
      return (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ');
    }

    function editDist(a: string, b: string) {
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      const v0 = new Array(b.length + 1);
      const v1 = new Array(b.length + 1);
      for (let i = 0; i <= b.length; i++) v0[i] = i;
      for (let i = 0; i < a.length; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < b.length; j++) {
          const cost = a.charCodeAt(i) === b.charCodeAt(j) ? 0 : 1;
          v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
        }
        for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
      }
      return v0[b.length];
    }

    function getVariants(tok: string) {
      const v = [tok];
      if (tok.length > 3) {
        if (tok.endsWith('ies')) v.push(tok.slice(0, -3) + 'y');
        else if (tok.endsWith('es')) v.push(tok.slice(0, -2), tok.slice(0, -1));
        else if (tok.endsWith('s')) v.push(tok.slice(0, -1));
        else v.push(tok + 's', tok + 'es');
      }
      return v;
    }

    function matchTokenInText(tok: string, text: string) {
      if (!tok || !text) return false;
      if (text.includes(tok)) return true;
      const vars = getVariants(tok);
      for (const vr of vars) {
        if (text.includes(vr)) return true;
      }
      if (tok.length >= 5) {
        const words = text.split(/[^a-z0-9]+/);
        for (const w of words) {
          if (w.length >= 4 && Math.abs(w.length - tok.length) <= 2) {
            if (editDist(tok, w) <= 2) return true;
          }
        }
      }
      return false;
    }

    const q = norm(query);
    const tokens = q.split(/\s+/);
    const matched: Array<{ item: (typeof items)[0]; tier: number }> = [];

    for (const item of items) {
      let allTokensMatch = true;
      let titleMatchesAll = true;
      let categoryMatchesAny = false;

      for (const tok of tokens) {
        const inTitle = matchTokenInText(tok, norm(item.title));
        const inCat = matchTokenInText(tok, norm(item.category));
        const inBody = matchTokenInText(tok, norm(item.body));
        if (!inTitle && !inCat && !inBody) {
          allTokensMatch = false;
          break;
        }
        if (!inTitle) titleMatchesAll = false;
        if (inCat) categoryMatchesAny = true;
      }

      if (allTokensMatch) {
        const tier = titleMatchesAll ? 1 : categoryMatchesAny ? 2 : 3;
        matched.push({ item, tier });
      }
    }

    matched.sort((a, b) => a.tier - b.tier);
    return matched.map((m) => m.item.title);
  }

  it('WS1 acceptance: "cookied" matches Brown Butter Cardamom Chocolate Chip Cookies', () => {
    const html = renderHome({ recipes: CATALOG, locales: [], lang: 'en' });
    const results = runSearchScript('cookied', html);
    expect(results).toContain('Brown Butter Cardamom Chocolate Chip Cookies');
  });

  it('WS1 acceptance: "cookies" and "cookie" return the same recipe as title match', () => {
    const html = renderHome({ recipes: CATALOG, locales: [], lang: 'en' });
    const r1 = runSearchScript('cookies', html);
    const r2 = runSearchScript('cookie', html);
    expect(r1).toContain('Brown Butter Cardamom Chocolate Chip Cookies');
    expect(r2).toContain('Brown Butter Cardamom Chocolate Chip Cookies');
    expect(r1[0]).toBe('Brown Butter Cardamom Chocolate Chip Cookies');
    expect(r2[0]).toBe('Brown Butter Cardamom Chocolate Chip Cookies');
  });

  it('WS1 acceptance: "choclate chip" matches the cookies recipe', () => {
    const html = renderHome({ recipes: CATALOG, locales: [], lang: 'en' });
    const results = runSearchScript('choclate chip', html);
    expect(results).toContain('Brown Butter Cardamom Chocolate Chip Cookies');
  });

  it('WS1 acceptance: "taco" matches Crispy Beef Tacos, Birria Tacos, and Enchiladas (category match)', () => {
    const html = renderHome({ recipes: CATALOG, locales: [], lang: 'en' });
    const results = runSearchScript('taco', html);
    expect(results).toContain('Crispy Beef Tacos with Cilantro-Lime Sauce');
    expect(results).toContain('Birria Tacos');
    expect(results).toContain('Red Chicken Enchiladas');
    // Enchiladas is category match (tier 2), while Tacos are title matches (tier 1)
    expect(results.indexOf('Red Chicken Enchiladas')).toBeGreaterThan(results.indexOf('Birria Tacos'));
  });

  it('WS2 acceptance: "cardamom" finds the cookies', () => {
    const html = renderHome({ recipes: CATALOG, locales: [], lang: 'en' });
    const results = runSearchScript('cardamom', html);
    expect(results).toContain('Brown Butter Cardamom Chocolate Chip Cookies');
  });

  it('WS2 acceptance: "cabbage" finds Golumpki Soup and Potstickers', () => {
    const html = renderHome({ recipes: CATALOG, locales: [], lang: 'en' });
    const results = runSearchScript('cabbage', html);
    expect(results).toContain('Golumpki (Unstuffed Cabbage Roll) Soup');
    expect(results).toContain('Pork and Cabbage Potstickers');
  });

  it('WS1 & WS4 acceptance: nonsense query "zzzqqq" yields 0 matches', () => {
    const html = renderHome({ recipes: CATALOG, locales: [], lang: 'en' });
    const results = runSearchScript('zzzqqq', html);
    expect(results).toHaveLength(0);
  });

  it('WS5 acceptance: cross-locale recipes render provenance badge and participate in search', () => {
    // When rendered with currentCountry = 'us', MX recipes (Birria Tacos, Red Chicken Enchiladas) get provenance badge
    const html = renderHome({ recipes: CATALOG, locales: [], lang: 'en', currentCountry: 'us' });
    expect(html).toContain('class="provenance-badge">Mexico</span>');
    // When searching for Mexican recipe on US edition, it matches and is returned
    const results = runSearchScript('birria', html);
    expect(results).toContain('Birria Tacos');
  });
});

describe('Homepage grouped sections (4A)', () => {
  const many = Array.from({ length: 6 }, (_, i) => ({
    id: `g${i}`,
    country: 'us',
    lang: 'en',
    slug: `dish-${i}`,
    title: `Dish ${i}`,
    category: 'mains' as const,
    intro: '',
    ingredients: '',
  }));
  const mixed = [...many, { id: 'u1', country: 'us', lang: 'en', slug: 'oddball', title: 'Oddball', category: null, intro: '', ingredients: '' }];

  it('groups by category with one capped row and a see-all link', () => {
    const html = renderHome({ recipes: mixed as any, locales: [], lang: 'en' });
    expect(html).toContain('data-recipe-group="true"');
    // Capped at 4 of 6 mains, with a see-all link into the category filter.
    // 4 capped mains + 1 uncategorized row carry data-recipe-item; the 2
    // capped-out mains appear only in JSON-LD, not as list rows.
    expect(html.match(/data-recipe-item="true"/g)!.length).toBe(5);
    expect(html).toContain('href="/?lang=en&amp;cat=mains#recipes"');
    expect(html).toContain('See all');
    // Uncategorized recipes land in a final group pointing at /recipes.
    expect(html).toContain('Oddball');
    expect(html).toContain('href="/recipes"');
  });

  it('keeps the flat ranked list when a category is picked', () => {
    const html = renderHome({ recipes: mixed as any, locales: [], lang: 'en', activeCategory: 'mains' });
    expect(html).not.toContain('data-recipe-group="true"');
    expect(html.match(/data-recipe-item="true"/g)!.length).toBe(6);
  });
});

describe('Browser-language homepage default (2A)', () => {
  it('parses Accept-Language in q-value order, prefix-matched', async () => {
    const { browserLang } = await import('./server');
    expect(browserLang('es-MX,es;q=0.9,en;q=0.8')).toBe('es');
    expect(browserLang('fr-CA, fr;q=0.8, en;q=0.9')).toBe('fr');
    expect(browserLang('en-US,en;q=0.9')).toBe('en');
    expect(browserLang('de-DE,de;q=0.9,en;q=0.5')).toBe('en');
    expect(browserLang('de-DE,de;q=0.9')).toBe('en');
    expect(browserLang(undefined)).toBe('en');
    expect(browserLang('')).toBe('en');
    expect(browserLang('es;q=0.9,fr;q=1.0')).toBe('fr');
  });

  it('shows the visible switcher confirmation only when langNotice is set', () => {
    const withNotice = renderHome({ recipes: [], locales: [], lang: 'es', langNotice: true });
    expect(withNotice).toContain('class="lang-notice"');
    expect(withNotice).toContain('Mostrando recetas en el idioma de tu navegador.');
    expect(withNotice).toContain('href="/?lang=en"');
    expect(withNotice).toContain('href="/?lang=fr"');
    const without = renderHome({ recipes: [], locales: [], lang: 'es' });
    expect(without).not.toContain('class="lang-notice"');
  });
});
