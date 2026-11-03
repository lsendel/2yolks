import { renderToString } from 'react-dom/server';

/** Escape text interpolated into raw HTML head elements. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** JSON.stringify safe for inline <script>: escapes </script> breakouts. */
export function safeJsonLd(value: object): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
import { Home, CountryHome, RecipeView, AboutView, PrivacyView, HowWeTestView, NotFoundView, type HomeProps, type CountryHomeProps } from './App';
import { RECIPE_CLIENT_SCRIPT } from './clientScript';
import type { RecipePage, IngredientEntry } from '@2yolks/contracts';
import { uiStrings, renderIngredient, renderStep, defaultUnitSystem } from '@2yolks/contracts';

interface ShellOptions {
  title: string;
  /** hreflang alternates: exact content equivalents only */
  alternates?: { hreflang: string; href: string }[];
  jsonLd?: object;
  noindex?: boolean;
  og?: { title: string; description?: string; url: string; locale: string; image?: string | null };
}

const BASE_CSS = `
:root { color-scheme: light; --brand: #c2410c; --ink: #1c1917; --muted: #57534e; --bg: #fffbf5; --card: #ffffff; }
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; background: var(--bg); color: var(--ink); line-height: 1.6; }
a { color: var(--brand); }
.site-header { background: var(--card); border-bottom: 1px solid #e7e5e4; padding: 0.75rem 1rem; }
.site-header a.brand { font-weight: 700; font-size: 1.25rem; text-decoration: none; color: var(--brand); }
main { max-width: 42rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
.tagline { color: var(--muted); margin-top: -0.5rem; }
.cards { list-style: none; padding: 0; display: grid; gap: 0.75rem; }
.cards a { display: block; background: var(--card); border: 1px solid #e7e5e4; border-radius: 0.5rem; padding: 0.75rem 1rem; text-decoration: none; color: var(--ink); font-weight: 600; }
.cards a:hover { border-color: var(--brand); }
.recipe-source { color: var(--muted); font-size: 0.9rem; border-top: 1px solid #e7e5e4; margin-top: 2rem; padding-top: 1rem; }
.langs { font-size: 0.9rem; color: var(--muted); display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; }
.langs a { display: inline-flex; align-items: center; min-height: 44px; }
.recipe-actions { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: center; margin: 0.5rem 0 1rem; }
main img { max-width: 100%; height: auto; }
h1 { overflow-wrap: break-word; }
.recipe-actions .jump { font-weight: 600; }
.recipe-actions .cook-open { margin-left: auto; background: var(--brand); color: #fff; border: 0; border-radius: 0.5rem; padding: 0.5rem 1rem; font-weight: 700; cursor: pointer; }
.scaler { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; margin: 0 0 0.75rem; }
.unit-toggle { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; margin: 0 0 0.75rem; }
.unit-toggle button { border: 1px solid #e7e5e4; background: var(--card); border-radius: 0.375rem; padding: 0.25rem 0.6rem; cursor: pointer; font-weight: 600; }
.unit-toggle button[aria-pressed="true"] { background: var(--brand); color: #fff; border-color: var(--brand); }
.scaler-label { color: var(--muted); font-size: 0.9rem; margin-right: 0.25rem; }
.scaler button { border: 1px solid #e7e5e4; background: var(--card); border-radius: 0.375rem; padding: 0.25rem 0.6rem; cursor: pointer; font-weight: 600; }
.scaler button[aria-pressed="true"] { background: var(--brand); color: #fff; border-color: var(--brand); }
ul.ingredients { list-style: none; padding: 0; }
ul.ingredients li { padding: 0.15rem 0; }
ul.ingredients label { display: flex; gap: 0.5rem; align-items: baseline; cursor: pointer; }
ul.ingredients input { transform: translateY(0.1em); }
ul.ingredients input:checked ~ .line { text-decoration: line-through; color: var(--muted); }
ol.steps li { margin: 0.5rem 0; }
.cook-mode { position: fixed; inset: 0; background: var(--bg); z-index: 50; display: flex; }
.cook-mode[hidden] { display: none; }
.cook-inner { max-width: 42rem; margin: auto; padding: 1.5rem; width: 100%; display: flex; flex-direction: column; gap: 1.5rem; min-height: 60vh; justify-content: center; }
.cook-top { display: flex; justify-content: space-between; align-items: center; color: var(--muted); }
.cook-close { background: none; border: 1px solid #e7e5e4; border-radius: 0.375rem; padding: 0.35rem 0.75rem; cursor: pointer; }
.cook-step { font-size: 1.6rem; line-height: 1.4; font-weight: 600; }
.cook-nav { display: flex; justify-content: space-between; gap: 1rem; }
.cook-nav button { flex: 1; background: var(--brand); color: #fff; border: 0; border-radius: 0.5rem; padding: 0.75rem; font-size: 1.1rem; font-weight: 700; cursor: pointer; }
.cook-nav button:first-child { background: var(--card); color: var(--ink); border: 1px solid #e7e5e4; }
.cook-timer { display: flex; gap: 0.75rem; align-items: center; }
.cook-timer[hidden] { display: none; }
.timer-btn { border: 1px solid var(--brand); color: var(--brand); background: none; border-radius: 0.5rem; padding: 0.4rem 0.9rem; font-weight: 600; cursor: pointer; }
.badge { display: inline-block; margin-left: 0.5rem; padding: 0 0.5rem; border-radius: 999px; background: #fef3c7; color: #78350f; border: 1px solid #fcd34d; font-size: 0.75rem; font-weight: 700; vertical-align: middle; }
.machine-note { background: #eff6ff; border: 1px solid #93c5fd; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.95rem; }
.machine-note .badge { margin-left: 0; }
.untested { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.95rem; }
.untested .badge { margin-left: 0; }
.recipe-actions .print-open { background: var(--card); color: var(--ink); border: 1px solid #e7e5e4; border-radius: 0.5rem; padding: 0.5rem 1rem; font-weight: 600; cursor: pointer; }
.share { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; align-items: center; margin: 1.5rem 0 0; font-size: 0.95rem; }
.share-label { color: var(--muted); }
.share button { border: 1px solid #e7e5e4; background: var(--card); border-radius: 0.375rem; padding: 0.25rem 0.7rem; cursor: pointer; font-weight: 600; }
.share button[hidden] { display: none; }
.site-footer { max-width: 42rem; margin: 0 auto; padding: 1rem; color: var(--muted); font-size: 0.9rem; border-top: 1px solid #e7e5e4; }
@media print { .share, .site-header, .site-footer, .recipe-actions, .scaler, .unit-toggle, .cook-mode, .langs { display: none !important; } body { background: #fff; } main { max-width: none; } ul.ingredients input { display: none; } }
.timer-display { font-size: 1.4rem; font-weight: 700; font-variant-numeric: tabular-nums; }
`;

const PIN_IMAGE_KEYS = new Set<string>(["w1golumpki:en", "w1potsticker:en", "w1pozole:es", "w1enchiladas:es", "w1birria:es", "w1golumpki:es", "w1golumpki:fr", "w1potsticker:es", "w1potsticker:fr", "w1pozole:en", "w1pozole:fr", "w1enchiladas:en", "w1enchiladas:fr", "w1birria:en", "w1birria:fr"]);

function shell(body: string, { title, alternates = [], jsonLd, noindex = false, og }: ShellOptions): string {
  const links = alternates
    .map((a) => `<link rel="alternate" hreflang="${escapeHtml(a.hreflang)}" href="${escapeHtml(a.href)}" />`)
    .join('\n    ');
  const ld = jsonLd ? `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>` : '';
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    ${noindex ? '<meta name="robots" content="noindex, nofollow" />' : ''}
    ${links}
    ${og ? `<link rel="canonical" href="${escapeHtml(og.url)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="2yolks" />
    <meta property="og:title" content="${escapeHtml(og.title)}" />
    <meta property="og:url" content="${escapeHtml(og.url)}" />
    <meta property="og:locale" content="${escapeHtml(og.locale)}" />
    ${og.description ? `<meta property="og:description" content="${escapeHtml(og.description)}" /><meta name="description" content="${escapeHtml(og.description)}" />` : ''}
    ${og.image ? `<meta property="og:image" content="${escapeHtml(og.image)}" />` : ''}
    <meta name="twitter:card" content="${og.image ? 'summary_large_image' : 'summary'}" />` : ''}
    ${ld}
    <style>${BASE_CSS}</style>
    ${ANALYTICS_BEACON}
  </head>
  <body><header class="site-header"><a class="brand" href="/">2yolks</a></header>${body}<footer class="site-footer"><a href="/about">About / Acerca de</a> &middot; <a href="/how-we-test">How we test / C&oacute;mo probamos</a> &middot; <a href="/privacy">Privacy / Privacidad</a></footer></body>
</html>`;
}

// Cloudflare Web Analytics (free, cookieless). The site token is public by design.
const ANALYTICS_BEACON =
  `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "24832070d4c94429a9e409048f9a6b30"}'></script>`;

export function renderHome(props: HomeProps): string {
  return shell(renderToString(<Home {...props} />), { title: '2yolks' });
}

export function renderCountryHome(props: CountryHomeProps): string {
  return shell(renderToString(<CountryHome {...props} />), {
    title: `2yolks - ${props.countryName}`,
  });
}

export function renderPrivacy(): string {
  return shell(renderToString(<PrivacyView />), { title: 'Privacy - 2yolks' });
}

export function renderAbout(): string {
  return shell(renderToString(<AboutView />), { title: 'About 2yolks' });
}

export function renderHowWeTest(): string {
  return shell(renderToString(<HowWeTestView />), { title: 'How we test and label recipes - 2yolks' });
}

export function renderNotFound(): string {
  return shell(renderToString(<NotFoundView />), { title: 'Page not found - 2yolks', noindex: true });
}

export function renderRecipe(page: RecipePage, alternates: { hreflang: string; href: string }[]): string {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: page.locale.title,
    inLanguage: page.locale.lang,
    ...(page.locale.intro ? { description: page.locale.intro } : {}),
    author: { '@type': 'Organization', name: '2yolks' },
    recipeIngredient: (JSON.parse(page.locale.ingredientsJson) as IngredientEntry[]).map((e) => renderIngredient(e, page.locale.lang, defaultUnitSystem(page.locale.country), 1)),
    recipeInstructions: (JSON.parse(page.locale.stepsJson) as string[]).map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text: renderStep(s, JSON.parse(page.locale.ingredientsJson) as IngredientEntry[], page.locale.lang, defaultUnitSystem(page.locale.country), 1),
    })),
  };
  const t = uiStrings(page.locale.lang);
  const self = alternates.find((a) => a.hreflang.toLowerCase() === `${page.locale.lang}-${page.locale.country}`.toLowerCase());
  const canonicalUrl = self?.href;
  // Title-only graphic (no food photo), built by scripts/build-pin-graphics.py. Only recipes with a built file get one.
  const imageUrl = canonicalUrl && PIN_IMAGE_KEYS.has(`${page.locale.recipeId}:${page.locale.lang}`) ? `${new URL(canonicalUrl).origin}/img/pin/${page.locale.recipeId}.${page.locale.lang}.png` : null;
  const cookData = safeJsonLd({
    steps: (JSON.parse(page.locale.stepsJson) as string[]).map((st) => renderStep(st, JSON.parse(page.locale.ingredientsJson) as IngredientEntry[], page.locale.lang, defaultUnitSystem(page.locale.country), 1)),
    strings: { timerDone: t.timerDone },
  });
  const body =
    renderToString(<RecipeView page={page} alternates={alternates} canonicalUrl={canonicalUrl} imageUrl={imageUrl} />) +
    `<script type="application/json" id="cook-data">${cookData}</script>` +
    `<script>${RECIPE_CLIENT_SCRIPT}</script>`;
  return shell(body, {
    title: `${page.locale.title} - 2yolks`,
    alternates,
    jsonLd,
    og: canonicalUrl ? { title: page.locale.title, description: page.locale.intro ?? undefined, url: canonicalUrl, locale: `${page.locale.lang}_${page.locale.country.toUpperCase()}`, image: imageUrl } : undefined,
    // Synthetic/dev-only sources must never be indexed as real recipes.
    noindex: page.source.license === 'internal-demo',
  });
}
