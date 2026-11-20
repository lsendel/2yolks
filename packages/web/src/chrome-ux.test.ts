import { describe, it, expect } from 'vitest';
import { renderHome, renderRecipe, renderPrivacy } from './server';

const rows = [
  { id: 'r1', country: 'us', lang: 'en', slug: 'a', title: 'First recipe', category: 'soups-stews', untested: true, totalMinutes: 70 },
  { id: 'r2', country: 'mx', lang: 'en', slug: 'c', title: 'Second recipe', category: 'dumplings', untested: true },
];

const recipe = () =>
  renderRecipe(
    {
      recipe: { id: '9214e255', sourceId: 's1', originCountry: 'us', imageKey: null, createdAt: '2026-11-01', totalMinutes: 30, category: 'soups-stews' },
      locale: { recipeId: '9214e255', country: 'us', lang: 'en', title: 'Sweet Potato Casserole', slug: 'sweet-potato-casserole', intro: 'A rich holiday bake.', ingredientsJson: '["2 lb sweet potatoes"]', stepsJson: '["Bake 45 minutes."]', status: 'published' },
      source: { id: 's1', name: '2yolks', url: '/about', license: 'CC0-1.0', clearedAt: '2026-11-01', notes: null },
    },
    [{ hreflang: 'en-US', href: 'https://2yolks.com/us/recipes/sweet-potato-casserole' }],
  );

describe('Phase 1 navigation & search chrome', () => {
  it('home hero has a no-JS search form that lands on results, plus quick searches', () => {
    const html = renderHome({ recipes: rows, locales: [], lang: 'en' });
    expect(html).toContain('<form class="hero-search" role="search" action="/#recipes" method="get">');
    expect(html).toContain('name="q"');
    expect(html).toContain('href="/?q=chicken#recipes"');
    // language travels with the form and the chips
    const es = renderHome({ recipes: rows, locales: [], lang: 'es' });
    expect(es).toContain('<input type="hidden" name="lang" value="es"/>');
    expect(es).toContain('href="/?lang=es&amp;q=pollo#recipes"');
  });

  it('search results are announced and the header search link has a target', () => {
    const html = renderHome({ recipes: rows, locales: [], lang: 'en' });
    expect(html).toMatch(/role="status" aria-live="polite" data-search-status/);
    expect(html).toContain('id="search"');
    expect(html).toContain('href="/#search"');
  });

  it('offers "search all categories" only inside a category filter', () => {
    expect(renderHome({ recipes: rows, locales: [], lang: 'en' })).not.toMatch(/<a class="btn-clear" data-search-all/);
    const html = renderHome({ recipes: rows, locales: [], lang: 'fr', activeCategory: 'dumplings' });
    expect(html).toMatch(/<a class="btn-clear" data-search-all/);
    expect(html).toContain('Chercher dans toutes les catégories');
  });

  it('header has a compact mobile menu (native <details>) with every destination', () => {
    const html = renderHome({ recipes: rows, locales: [], lang: 'en' });
    const menu = html.slice(html.indexOf('<details class="mobile-menu">'), html.indexOf('</details>'));
    expect(menu).toContain('href="/recipes"');
    expect(menu).toContain('href="/account"');
    expect(menu).toContain('href="/how-we-test"');
    expect(menu).toContain('data-theme-toggle');
  });

  it('recipe share bar shows 3 primary actions and tucks the rest behind "More ways to share"', () => {
    const html = recipe();
    const bar = html.slice(html.indexOf('id="share-bar"'), html.indexOf('</nav>', html.indexOf('id="share-bar"')));
    const primary = bar.slice(0, bar.indexOf('<details class="share-more">'));
    expect(primary).toContain('data-share-native');
    expect(primary).toContain('data-share-copy');
    expect(primary).toContain('data-story-card');
    expect(primary).not.toContain('data-og-card');
    expect(bar).toContain('<summary>More ways to share</summary>');
    expect(bar.slice(bar.indexOf('<details'))).toContain('data-og-card');
  });

  it('privacy page discloses zero-result search logging and local draft copies', () => {
    for (const [lang, needle] of [['en', 'search words'], ['es', 'palabras buscadas'], ['fr', 'mots cherch']] as const) {
      expect(renderPrivacy(undefined, 'https://2yolks.com', lang)).toContain(needle);
    }
  });
});
