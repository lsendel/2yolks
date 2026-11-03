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
import {
  Home,
  CountryHome,
  RecipeView,
  AboutView,
  PrivacyView,
  HowWeTestView,
  NotFoundView,
  SiteHeader,
  SiteFooter,
  type HomeProps,
  type CountryHomeProps,
  type SiteNavItem,
} from './App';
import { RECIPE_CLIENT_SCRIPT } from './clientScript';
import type { RecipePage, IngredientEntry } from '@2yolks/contracts';
import { uiStrings, renderIngredient, renderStep, defaultUnitSystem, COUNTRY_INTROS, defaultLocale } from '@2yolks/contracts';

export type { SiteNavItem } from './App';

interface ShellOptions {
  title: string;
  /** hreflang alternates: exact content equivalents only */
  alternates?: { hreflang: string; href: string }[];
  jsonLd?: object;
  noindex?: boolean;
  og?: { title: string; description?: string; url: string; locale: string; image?: string | null };
  /** Countries-with-content nav for the header/footer. */
  nav?: SiteNavItem[];
  /** Locale for chrome strings (header/footer/skip link). */
  lang?: string;
}

const BASE_CSS = `
@font-face { font-family: 'Fraunces'; font-style: normal; font-weight: 300 700; font-display: swap; src: url('/fonts/fraunces-var.woff2') format('woff2'); }
:root { color-scheme: light; --brand: #c2410c; --brand-strong: #9a3412; --yolk: #f59e0b; --ink: #1c1917; --muted: #57534e; --bg: #fffbf5; --card: #ffffff; --line: #e7e5e4; --line-strong: #d6d3d1; --amber-bg: #fffbeb; --amber-line: #fcd34d; --amber-ink: #78350f; --blue-bg: #eff6ff; --blue-line: #93c5fd; --radius: 0.875rem; --shadow: 0 1px 2px rgb(28 25 23 / 0.05), 0 12px 32px -16px rgb(28 25 23 / 0.28); --font-body: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; --font-display: 'Fraunces', Georgia, 'Times New Roman', serif; }
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font-body); background: var(--bg); color: var(--ink); line-height: 1.6; }
a { color: var(--brand); }
a:focus-visible, button:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
h1, h2 { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.01em; line-height: 1.15; }
h1 { font-size: clamp(2rem, 4.5vw, 2.9rem); margin: 0.25rem 0 1rem; overflow-wrap: break-word; }
h2 { font-size: 1.65rem; margin: 2.25rem 0 0.75rem; }
main { max-width: 44rem; margin: 0 auto; padding: 1.5rem 1rem 3.5rem; }
main.wide { max-width: 72rem; }
main img { max-width: 100%; height: auto; }
/* Header */
.site-header { background: var(--card); border-bottom: 1px solid var(--line); }
.header-inner { max-width: 72rem; margin: 0 auto; padding: 0.7rem 1rem; display: flex; align-items: center; gap: 0.75rem 1rem; flex-wrap: wrap; }
.brand { display: inline-flex; align-items: center; gap: 0.55rem; text-decoration: none; color: var(--ink); }
.brand-mark { width: 1.75rem; height: 1.75rem; flex-shrink: 0; }
.brand-word { font-family: var(--font-display); font-weight: 600; font-size: 1.4rem; letter-spacing: -0.01em; }
.site-nav { margin-left: auto; display: flex; flex-wrap: wrap; gap: 0.15rem; }
.site-nav a { padding: 0.45rem 0.85rem; border-radius: 999px; color: var(--muted); text-decoration: none; font-weight: 600; font-size: 0.95rem; }
.site-nav a:hover { color: var(--ink); background: #f5f5f4; }
.site-nav a[aria-current="page"] { color: var(--brand-strong); background: #ffedd5; }
.skip { position: absolute; left: -9999px; top: 0; background: var(--card); color: var(--ink); padding: 0.5rem 1rem; border: 1px solid var(--line-strong); z-index: 100; }
.skip:focus { left: 0; }
/* Hero */
.hero { display: flex; align-items: center; gap: 2rem; padding: 3.25rem 0 1.75rem; }
.hero-text { max-width: 44rem; }
.hero h1 { font-size: clamp(2.4rem, 5.5vw, 3.9rem); line-height: 1.05; margin: 0 0 1rem; }
.lede { font-size: 1.15rem; color: var(--muted); max-width: 38rem; margin: 0; }
.hero-art { margin-left: auto; flex-shrink: 0; }
.hero-egg { width: clamp(96px, 13vw, 160px); height: auto; transform: rotate(6deg); filter: drop-shadow(0 16px 24px rgb(194 65 12 / 0.18)); }
/* Sections */
.section { padding: 1.75rem 0 1rem; }
.section > h2 { margin: 0 0 1.1rem; font-size: 1.75rem; }
.page-head { margin-bottom: 1.25rem; }
.page-head h1 { margin: 0 0 0.5rem; }
/* Country cards */
.country-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.country-card { position: relative; display: block; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.5rem 1.5rem 1.25rem; text-decoration: none; color: var(--ink); overflow: hidden; transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; }
.country-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, var(--brand), var(--yolk)); }
.country-card:hover { border-color: var(--line-strong); box-shadow: var(--shadow); transform: translateY(-2px); }
.country-card h3 { font-family: var(--font-display); font-size: 1.6rem; font-weight: 600; margin: 0.25rem 0 0.35rem; }
.country-card .meta { color: var(--muted); font-size: 0.95rem; margin: 0; padding-right: 1.5rem; }
.country-card .go { position: absolute; right: 1.25rem; bottom: 0.9rem; color: var(--brand); font-size: 1.3rem; font-weight: 700; }
.country-block { margin-top: 1.5rem; }
.country-block-head { font-size: 1.25rem; margin: 0 0 0.75rem; }
.country-block-head a { color: var(--ink); text-decoration: none; }
.country-block-head a:hover { color: var(--brand); }
/* Recipe cards */
.recipe-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.recipe-card { position: relative; display: flex; flex-direction: column; gap: 0.4rem; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.1rem 1.25rem; transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; }
.recipe-card:hover { border-color: var(--line-strong); box-shadow: var(--shadow); transform: translateY(-2px); }
.recipe-card h3 { font-family: var(--font-display); font-size: 1.2rem; font-weight: 600; line-height: 1.3; margin: 0; }
.recipe-card h3 a { color: var(--ink); text-decoration: none; }
.recipe-card h3 a:hover { color: var(--brand); }
.recipe-card h3 a.stretched::after { content: ''; position: absolute; inset: 0; border-radius: var(--radius); }
.recipe-card .meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem 0.6rem; margin: 0; color: var(--muted); font-size: 0.9rem; }
.meta-country { display: inline-flex; align-items: center; gap: 0.35rem; }
.yolk-dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--yolk); display: inline-block; }
.chips { display: flex; flex-wrap: wrap; gap: 0.375rem; margin: 0.25rem 0 0; position: relative; z-index: 1; }
.chip { display: inline-flex; align-items: center; font-size: 0.8rem; font-weight: 600; color: var(--muted); background: var(--bg); border: 1px solid var(--line); border-radius: 999px; padding: 0.18rem 0.65rem; text-decoration: none; }
.chip:hover { color: var(--brand); border-color: var(--brand); }
/* Category filter */
.cat-nav { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 1.25rem; }
.cat-nav .chip { font-size: 0.9rem; padding: 0.35rem 0.9rem; background: var(--card); }
.cat-nav .chip[aria-current="page"] { color: #fff; background: var(--brand); border-color: var(--brand); }
.empty-note { color: var(--muted); }
/* Breadcrumbs */
.crumbs-nav { margin-bottom: 0.75rem; }
.crumbs { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0; padding: 0; font-size: 0.9rem; color: var(--muted); }
.crumbs li + li::before { content: '\\203A'; margin-right: 0.5rem; color: var(--line-strong); }
.crumbs a { color: var(--muted); text-decoration: none; }
.crumbs a:hover { color: var(--brand); text-decoration: underline; }
.crumbs [aria-current="page"] { color: var(--ink); }
/* Recipe page */
.recipe-intro { font-size: 1.08rem; }
.hero-image { margin: 0.25rem 0 1rem; }
.hero-image img { width: 100%; height: auto; border-radius: var(--radius); border: 1px solid var(--line); display: block; }
.hero-image figcaption { color: var(--muted); font-size: 0.85rem; margin-top: 0.35rem; }
.time-meta { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; margin: 0 0 1rem; padding: 0.65rem 0.9rem; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); font-size: 0.95rem; }
.time-item { white-space: nowrap; }
.time-label { color: var(--muted); font-weight: 600; margin-right: 0.15rem; }
.badge { display: inline-block; padding: 0.05rem 0.55rem; border-radius: 999px; background: var(--amber-bg); color: var(--amber-ink); border: 1px solid var(--amber-line); font-size: 0.75rem; font-weight: 700; }
.machine-note { background: var(--blue-bg); border: 1px solid var(--blue-line); border-radius: var(--radius); padding: 0.6rem 0.9rem; font-size: 0.95rem; }
.untested { background: var(--amber-bg); border: 1px solid var(--amber-line); border-radius: var(--radius); padding: 0.6rem 0.9rem; font-size: 0.95rem; }
.langs { font-size: 0.9rem; color: var(--muted); display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; }
.langs a { display: inline-flex; align-items: center; min-height: 44px; }
.langs .chip { min-height: 0; }
.recipe-actions { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: center; margin: 0.5rem 0 1rem; }
.recipe-actions .jump { font-weight: 700; text-decoration: none; }
.recipe-actions .jump:hover { text-decoration: underline; }
.recipe-actions .cook-open { margin-left: auto; background: var(--brand); color: #fff; border: 0; border-radius: 999px; padding: 0.55rem 1.2rem; font-weight: 700; cursor: pointer; font-size: 0.95rem; }
.recipe-actions .cook-open:hover { background: var(--brand-strong); }
.recipe-actions .print-open { background: var(--card); color: var(--ink); border: 1px solid var(--line); border-radius: 999px; padding: 0.55rem 1.1rem; font-weight: 600; cursor: pointer; font-size: 0.95rem; }
.recipe-actions .print-open:hover { border-color: var(--line-strong); }
.scaler, .unit-toggle { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; margin: 0 0 0.75rem; }
.scaler-label { color: var(--muted); font-size: 0.9rem; margin-right: 0.25rem; }
.scaler button, .unit-toggle button { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 0.3rem 0.8rem; cursor: pointer; font-weight: 600; font-size: 0.9rem; color: var(--ink); }
.scaler button:hover, .unit-toggle button:hover { border-color: var(--brand); color: var(--brand); }
.scaler button[aria-pressed="true"], .unit-toggle button[aria-pressed="true"] { background: var(--brand); color: #fff; border-color: var(--brand); }
ul.ingredients { list-style: none; padding: 0; margin: 0.5rem 0 0; }
ul.ingredients li { padding: 0.35rem 0; border-bottom: 1px dashed var(--line); }
ul.ingredients li:last-child { border-bottom: 0; }
ul.ingredients label { display: flex; gap: 0.6rem; align-items: baseline; cursor: pointer; }
ul.ingredients input { transform: translateY(0.15em); accent-color: var(--brand); width: 1rem; height: 1rem; flex-shrink: 0; }
ul.ingredients input:checked ~ .line { text-decoration: line-through; color: var(--muted); }
ol.steps { list-style: none; padding: 0; margin: 0.5rem 0 0; counter-reset: step; }
ol.steps li { counter-increment: step; position: relative; padding-left: 2.9rem; margin: 1rem 0; }
ol.steps li::before { content: counter(step, decimal-leading-zero); position: absolute; left: 0; top: 0.05rem; font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; color: var(--brand); }
/* Cook mode */
.cook-mode { position: fixed; inset: 0; background: var(--bg); z-index: 50; display: flex; }
.cook-mode[hidden] { display: none; }
.cook-inner { max-width: 44rem; margin: auto; padding: 1.5rem; width: 100%; display: flex; flex-direction: column; gap: 1.5rem; min-height: 60vh; justify-content: center; }
.cook-top { display: flex; justify-content: space-between; align-items: center; color: var(--muted); }
.cook-close { background: var(--card); border: 1px solid var(--line); border-radius: 999px; padding: 0.4rem 1rem; cursor: pointer; font-weight: 600; }
.cook-step { font-family: var(--font-display); font-size: clamp(1.45rem, 4vw, 1.9rem); line-height: 1.35; font-weight: 500; margin: 0; }
.cook-nav { display: flex; justify-content: space-between; gap: 1rem; }
.cook-nav button { flex: 1; background: var(--brand); color: #fff; border: 0; border-radius: 999px; padding: 0.8rem; font-size: 1.05rem; font-weight: 700; cursor: pointer; }
.cook-nav button:first-child { background: var(--card); color: var(--ink); border: 1px solid var(--line); }
.cook-timer { display: flex; gap: 0.75rem; align-items: center; }
.cook-timer[hidden] { display: none; }
.timer-btn { border: 1px solid var(--brand); color: var(--brand); background: none; border-radius: 999px; padding: 0.45rem 1rem; font-weight: 600; cursor: pointer; }
.timer-display { font-size: 1.4rem; font-weight: 700; font-variant-numeric: tabular-nums; }
/* Share + source */
.share { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: center; margin: 1.75rem 0 0; font-size: 0.95rem; }
.share-label { color: var(--muted); }
.share button { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 0.3rem 0.85rem; cursor: pointer; font-weight: 600; font-size: 0.9rem; }
.share button:hover { border-color: var(--brand); color: var(--brand); }
.share button[hidden] { display: none; }
.share a { font-weight: 600; text-decoration: none; }
.share a:hover { text-decoration: underline; }
.recipe-source { color: var(--muted); font-size: 0.9rem; border-top: 1px solid var(--line); margin-top: 2rem; padding-top: 1rem; }
/* Footer */
.site-footer { border-top: 1px solid var(--line); background: #faf6ee; margin-top: 2rem; }
.footer-inner { max-width: 72rem; margin: 0 auto; padding: 2.25rem 1rem 1rem; display: grid; gap: 1.75rem; grid-template-columns: 2fr 1fr 1fr; }
.footer-note { color: var(--muted); font-size: 0.95rem; max-width: 20rem; margin: 0.5rem 0 0; }
.footer-col h4 { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin: 0.35rem 0 0.6rem; }
.footer-col a { display: block; color: var(--ink); text-decoration: none; padding: 0.22rem 0; font-size: 0.95rem; }
.footer-col a:hover { color: var(--brand); }
.footer-fine { max-width: 72rem; margin: 0 auto; padding: 1rem; color: var(--muted); font-size: 0.82rem; border-top: 1px dashed var(--line); }
@media (max-width: 640px) { .footer-inner { grid-template-columns: 1fr; gap: 1.25rem; } .hero { padding: 2.25rem 0 1.25rem; } .hero-art { display: none; } }
@media print { .share, .site-header, .site-footer, .recipe-actions, .scaler, .unit-toggle, .cook-mode, .langs, .crumbs-nav { display: none !important; } body { background: #fff; } main { max-width: none; } ul.ingredients input { display: none; } ul.ingredients li { border-bottom: 0; } }
`;

const PIN_IMAGE_KEYS = new Set<string>(["w1golumpki:en", "w1potsticker:en", "w1pozole:es", "w1enchiladas:es", "w1birria:es", "w1golumpki:es", "w1golumpki:fr", "w1potsticker:es", "w1potsticker:fr", "w1pozole:en", "w1pozole:fr", "w1enchiladas:en", "w1enchiladas:fr", "w1birria:en", "w1birria:fr"]);

function shell(body: string, { title, alternates = [], jsonLd, noindex = false, og, nav = [], lang = 'en' }: ShellOptions): string {
  const links = alternates
    .map((a) => `<link rel="alternate" hreflang="${escapeHtml(a.hreflang)}" href="${escapeHtml(a.href)}" />`)
    .join('\n    ');
  const ld = jsonLd ? `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>` : '';
  const header = renderToString(<SiteHeader nav={nav} lang={lang} />);
  const footer = renderToString(<SiteFooter nav={nav} lang={lang} />);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    ${noindex ? '<meta name="robots" content="noindex, nofollow" />' : ''}
    ${links}
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="preload" href="/fonts/fraunces-var.woff2" as="font" type="font/woff2" crossorigin />
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
  <body>${header}${body}${footer}</body>
</html>`;
}

// Cloudflare Web Analytics (free, cookieless). The site token is public by design.
const ANALYTICS_BEACON =
  `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "24832070d4c94429a9e409048f9a6b30"}'></script>`;

export function renderHome(props: HomeProps, nav?: SiteNavItem[]): string {
  return shell(renderToString(<Home {...props} />), { title: '2yolks', nav });
}

export function renderCountryHome(props: CountryHomeProps, nav?: SiteNavItem[]): string {
  const lang = COUNTRY_INTROS[props.country]?.lang ?? defaultLocale(props.country) ?? 'en';
  return shell(renderToString(<CountryHome {...props} />), {
    title: `2yolks - ${props.countryName}`,
    nav,
    lang,
  });
}

export function renderPrivacy(nav?: SiteNavItem[]): string {
  return shell(renderToString(<PrivacyView />), { title: 'Privacy - 2yolks', nav });
}

export function renderAbout(nav?: SiteNavItem[]): string {
  return shell(renderToString(<AboutView />), { title: 'About 2yolks', nav });
}

export function renderHowWeTest(nav?: SiteNavItem[]): string {
  return shell(renderToString(<HowWeTestView />), { title: 'How we test and label recipes - 2yolks', nav });
}

export function renderNotFound(): string {
  return shell(renderToString(<NotFoundView />), { title: 'Page not found - 2yolks', noindex: true });
}

export function renderRecipe(
  page: RecipePage,
  alternates: { hreflang: string; href: string }[],
  opts: { nav?: SiteNavItem[]; countryName?: string } = {},
): string {
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
  const pinUrl = canonicalUrl && PIN_IMAGE_KEYS.has(`${page.locale.recipeId}:${page.locale.lang}`) ? `${new URL(canonicalUrl).origin}/img/pin/${page.locale.recipeId}.${page.locale.lang}.png` : null;
  // A rights-tracked hero image (migration 0004) wins over the title graphic.
  const imageUrl = page.heroImage?.url ?? pinUrl;
  const cookData = safeJsonLd({
    steps: (JSON.parse(page.locale.stepsJson) as string[]).map((st) => renderStep(st, JSON.parse(page.locale.ingredientsJson) as IngredientEntry[], page.locale.lang, defaultUnitSystem(page.locale.country), 1)),
    strings: { timerDone: t.timerDone },
  });
  const body =
    renderToString(<RecipeView page={page} alternates={alternates} canonicalUrl={canonicalUrl} imageUrl={imageUrl} countryName={opts.countryName} />) +
    `<script type="application/json" id="cook-data">${cookData}</script>` +
    `<script>${RECIPE_CLIENT_SCRIPT}</script>`;
  return shell(body, {
    title: `${page.locale.title} - 2yolks`,
    alternates,
    jsonLd,
    nav: opts.nav,
    lang: page.locale.lang,
    og: canonicalUrl ? { title: page.locale.title, description: page.locale.intro ?? undefined, url: canonicalUrl, locale: `${page.locale.lang}_${page.locale.country.toUpperCase()}`, image: imageUrl } : undefined,
    // Synthetic/dev-only sources must never be indexed as real recipes.
    noindex: page.source.license === 'internal-demo',
  });
}
