import { renderToString } from 'react-dom/server';

/** Escape text interpolated into raw HTML head elements. */
export function escapeHtml(text: string): string {
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
  RecipeIndex,
  CountryHome,
  RecipeView,
  AboutView,
  PrivacyView,
  HowWeTestView,
  NotFoundView,
  SiteHeader,
  SiteFooter,
  discoveryRecipes,
  type HomeProps,
  type CountryHomeProps,
  type SiteNavItem,
  type RecipeRow,
} from './App';
import { RECIPE_CLIENT_SCRIPT, DISCOVERY_CLIENT_SCRIPT, CAPTURE_CLIENT_SCRIPT, CAPTURE_CHECK_STRINGS } from './clientScript';
import type { RecipePage, IngredientEntry } from '@2yolks/contracts';
import { uiStrings, renderIngredient, renderStep, defaultUnitSystem, COUNTRY_INTROS, defaultLocale, categoryLabel, recipePathFor } from '@2yolks/contracts';

export type { SiteNavItem } from './App';

/** Format integer minutes as an ISO 8601 duration (e.g. PT1H10M, PT25M). */
export function isoDuration(minutes?: number | null): string | undefined {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return undefined;
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `PT${h > 0 ? `${h}H` : ''}${m > 0 || h === 0 ? `${m}M` : ''}`;
}

interface ShellOptions {
  title: string;
  /** hreflang alternates: exact content equivalents only */
  alternates?: { hreflang: string; href: string }[];
  jsonLd?: object | object[];
  noindex?: boolean;
  og?: {
    title: string;
    description?: string;
    url: string;
    locale: string;
    alternateLocales?: string[];
    image?: string | null;
    imageAlt?: string;
    type?: 'article' | 'website';
  };
  /** Countries-with-content nav for the header/footer. */
  nav?: SiteNavItem[];
  /** Locale for chrome strings (header/footer/skip link). */
  lang?: string;
}

import { AFTER_HOURS_CSS } from './identity';

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

const PIN_IMAGE_KEYS = new Set<string>([
  'w1golumpki:en',
  'w1potsticker:en',
  'w1pozole:es',
  'w1enchiladas:es',
  'w1birria:es',
  'w1golumpki:es',
  'w1golumpki:fr',
  'w1potsticker:es',
  'w1potsticker:fr',
  'w1pozole:en',
  'w1pozole:fr',
  'w1enchiladas:en',
  'w1enchiladas:fr',
  'w1birria:en',
  'w1birria:fr',
  '9214e255:en',
  '2ba6d505:en',
  '1c048512:en',
  'b9e37a49:en',
  'e9bc7550:en',
  '6e2a61f5:en',
  '22d307a4:en',
  '4e23e226:es',
]);

function shell(body: string, { title, alternates = [], jsonLd, noindex = false, og, nav = [], lang = 'en' }: ShellOptions): string {
  const links = alternates
    .map((a) => `<link rel="alternate" hreflang="${escapeHtml(a.hreflang)}" href="${escapeHtml(a.href)}" />`)
    .join('\n    ');
  const ldList = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  const ld = ldList.map((item) => `<script type="application/ld+json">${safeJsonLd(item)}</script>`).join('\n    ');
  const header = renderToString(<SiteHeader nav={nav} lang={lang} />);
  const footer = renderToString(<SiteFooter nav={nav} lang={lang} />);
  const ogAlternates = (og?.alternateLocales ?? [])
    .map((loc) => `<meta property="og:locale:alternate" content="${escapeHtml(loc)}" />`)
    .join('\n    ');
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#211729" />
    <title>${escapeHtml(title)}</title>
    ${noindex ? '<meta name="robots" content="noindex, nofollow" />' : ''}
    ${links}
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="preload" href="/fonts/fraunces-var.woff2" as="font" type="font/woff2" crossorigin />
    ${og ? `<link rel="canonical" href="${escapeHtml(og.url)}" />
    <meta property="og:type" content="${og.type ?? 'article'}" />
    <meta property="og:site_name" content="2yolks" />
    <meta property="og:title" content="${escapeHtml(og.title)}" />
    <meta property="og:url" content="${escapeHtml(og.url)}" />
    <meta property="og:locale" content="${escapeHtml(og.locale)}" />
    ${ogAlternates}
    ${og.description ? `<meta property="og:description" content="${escapeHtml(og.description)}" /><meta name="description" content="${escapeHtml(og.description)}" />` : ''}
    ${og.image ? `<meta property="og:image" content="${escapeHtml(og.image)}" />${og.imageAlt ? `<meta property="og:image:alt" content="${escapeHtml(og.imageAlt)}" />` : ''}` : ''}
    <meta name="twitter:card" content="${og.image ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${escapeHtml(og.title)}" />
    ${og.description ? `<meta name="twitter:description" content="${escapeHtml(og.description)}" />` : ''}
    ${og.image ? `<meta name="twitter:image" content="${escapeHtml(og.image)}" />` : ''}` : ''}
    ${ld}
    <style>${BASE_CSS}\n${AFTER_HOURS_CSS}</style>
    ${ANALYTICS_BEACON}
  </head>
  <body>${header}${body}${footer}</body>
</html>`;
}

// Cloudflare Web Analytics (free, cookieless). The site token is public by design.
const ANALYTICS_BEACON =
  `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "24832070d4c94429a9e409048f9a6b30"}'></script>`;

const HOME_SEO: Record<string, { title: string; description: string; locale: string }> = {
  en: {
    title: '2yolks — Small kitchen. Big appetite. | International Recipes',
    description: 'Find something worth cooking. Honest, ad-free recipes in English, Spanish, and French with instant unit conversion and step-by-step cook mode.',
    locale: 'en_US',
  },
  es: {
    title: '2yolks — Cocina pequeña. Gran apetito. | Recetas sin fronteras',
    description: 'Encuentra algo que quieras cocinar. Recetas honestas y sin anuncios en español, inglés y francés con conversión de unidades y modo cocina.',
    locale: 'es_MX',
  },
  fr: {
    title: '2yolks — Petite cuisine. Grand appétit. | Recettes sans frontières',
    description: 'Trouvez une recette à cuisiner. Des recettes honnêtes et sans publicité en français, anglais et espagnol avec conversion d’unités et mode cuisine.',
    locale: 'fr_FR',
  },
};

export function renderHome(props: HomeProps, nav?: SiteNavItem[], origin = 'https://2yolks.com'): string {
  const lang = props.lang ?? 'en';
  const seo = HOME_SEO[lang] ?? HOME_SEO.en!;
  const canonicalUrl = lang === 'en' ? `${origin}/` : `${origin}/?lang=${lang}`;
  const alternates = [
    { hreflang: 'en', href: `${origin}/` },
    { hreflang: 'es', href: `${origin}/?lang=es` },
    { hreflang: 'fr', href: `${origin}/?lang=fr` },
    { hreflang: 'x-default', href: `${origin}/` },
  ];
  const selected = discoveryRecipes(props.recipes, lang);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: '2yolks',
      url: `${origin}/`,
      inLanguage: ['en', 'es', 'fr'],
      description: seo.description,
      publisher: { '@type': 'Organization', name: '2yolks', url: `${origin}/` },
    },
    ...(selected.length > 0
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: seo.title,
            numberOfItems: selected.length,
            itemListElement: selected.map((r, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: r.title,
              url: `${origin}${recipePathFor(r.country, r.lang, r.slug)}`,
            })),
          },
        ]
      : []),
  ];
  const body = renderToString(<Home {...props} />) + `<script>${DISCOVERY_CLIENT_SCRIPT}</script>`;
  return shell(body, {
    title: seo.title,
    nav,
    lang,
    alternates,
    jsonLd,
    og: {
      type: 'website',
      title: seo.title,
      description: seo.description,
      url: canonicalUrl,
      locale: seo.locale,
      alternateLocales: ['en_US', 'es_MX', 'fr_FR'].filter((l) => l !== seo.locale),
      image: `${origin}/img/identity/after-hours.webp`,
      imageAlt: seo.title,
    },
  });
}

const RECIPES_INDEX_SEO: Record<string, { title: string; description: string }> = {
  en: { title: 'All recipes - 2yolks', description: 'Every published 2yolks recipe, grouped by course, with honest tested/untested labels.' },
  es: { title: 'Todas las recetas - 2yolks', description: 'Todas las recetas publicadas de 2yolks, agrupadas por tipo, con su estado real de prueba.' },
  fr: { title: 'Toutes les recettes - 2yolks', description: 'Toutes les recettes publiées de 2yolks, par catégorie, avec leur statut de test réel.' },
};

export function renderRecipeIndex(props: { recipes: RecipeRow[]; lang?: string }, nav?: SiteNavItem[], origin = 'https://2yolks.com'): string {
  const lang = props.lang ?? 'en';
  const seo = RECIPES_INDEX_SEO[lang] ?? RECIPES_INDEX_SEO.en!;
  const canonicalUrl = lang === 'en' ? `${origin}/recipes` : `${origin}/recipes?lang=${lang}`;
  const alternates = [
    { hreflang: 'en', href: `${origin}/recipes` },
    { hreflang: 'es', href: `${origin}/recipes?lang=es` },
    { hreflang: 'fr', href: `${origin}/recipes?lang=fr` },
    { hreflang: 'x-default', href: `${origin}/recipes` },
  ];
  const selected = discoveryRecipes(props.recipes, lang);
  const jsonLd = selected.length > 0
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: seo.title,
          numberOfItems: selected.length,
          itemListElement: selected.map((r, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: r.title,
            url: `${origin}${recipePathFor(r.country, r.lang, r.slug)}`,
          })),
        },
      ]
    : [];
  const body = renderToString(<RecipeIndex recipes={props.recipes} lang={lang} />);
  return shell(body, {
    title: seo.title,
    nav,
    lang,
    alternates,
    jsonLd,
    og: {
      type: 'website',
      title: seo.title,
      description: seo.description,
      url: canonicalUrl,
      locale: (HOME_SEO[lang] ?? HOME_SEO.en!).locale,
      alternateLocales: ['en_US', 'es_MX', 'fr_FR'].filter((l) => l !== (HOME_SEO[lang] ?? HOME_SEO.en!).locale),
      image: `${origin}/img/identity/after-hours.webp`,
      imageAlt: seo.title,
    },
  });
}

export function renderCountryHome(props: CountryHomeProps, nav?: SiteNavItem[], origin = 'https://2yolks.com'): string {
  const lang = COUNTRY_INTROS[props.country]?.lang ?? defaultLocale(props.country) ?? 'en';
  const desc = COUNTRY_INTROS[props.country]?.text ?? (HOME_SEO[lang] ?? HOME_SEO.en!).description;
  const title = `2yolks - ${props.countryName}`;
  const canonicalUrl = `${origin}/${props.country.toLowerCase()}/`;
  const body = renderToString(<CountryHome {...props} />) + `<script>${DISCOVERY_CLIENT_SCRIPT}</script>`;
  return shell(body, {
    title,
    nav,
    lang,
    og: {
      type: 'website',
      title,
      description: desc,
      url: canonicalUrl,
      locale: `${lang}_${props.country.toUpperCase()}`,
      image: `${origin}/img/identity/after-hours.webp`,
      imageAlt: title,
    },
  });
}

export function renderPrivacy(nav?: SiteNavItem[], origin = 'https://2yolks.com'): string {
  const title = 'Privacy - 2yolks';
  const description = 'How 2yolks handles privacy: cookieless reading, local unit preferences, and private recipe drafts.';
  return shell(renderToString(<PrivacyView />), {
    title,
    nav,
    og: { type: 'website', title, description, url: `${origin}/privacy`, locale: 'en_US' },
  });
}

export function renderAbout(nav?: SiteNavItem[], origin = 'https://2yolks.com'): string {
  const title = 'About 2yolks';
  const description = '2yolks is an international recipe platform in English, Spanish, and French with honest testing labels and cleared sources.';
  return shell(renderToString(<AboutView />), {
    title,
    nav,
    og: { type: 'website', title, description, url: `${origin}/about`, locale: 'en_US', image: `${origin}/img/identity/after-hours.webp` },
  });
}

export function renderHowWeTest(nav?: SiteNavItem[], origin = 'https://2yolks.com'): string {
  const title = 'How we test and label recipes - 2yolks';
  const description = 'Every recipe on 2yolks is clearly labeled as Not yet tested or Tested with real kitchen yield and timing.';
  return shell(renderToString(<HowWeTestView />), {
    title,
    nav,
    og: { type: 'website', title, description, url: `${origin}/how-we-test`, locale: 'en_US', image: `${origin}/img/identity/after-hours.webp` },
  });
}

export function renderNotFound(): string {
  return shell(renderToString(<NotFoundView />), { title: 'Page not found - 2yolks', noindex: true });
}

export function renderRecipe(
  page: RecipePage,
  alternates: { hreflang: string; href: string }[],
  opts: { nav?: SiteNavItem[]; countryName?: string; related?: RecipeRow[] } = {},
): string {
  const t = uiStrings(page.locale.lang);
  const self = alternates.find((a) => a.hreflang.toLowerCase() === `${page.locale.lang}-${page.locale.country}`.toLowerCase());
  const canonicalUrl = self?.href;
  const origin = canonicalUrl ? new URL(canonicalUrl).origin : 'https://2yolks.com';
  const cat = categoryLabel(page.recipe.category, page.locale.lang);
  const entries = JSON.parse(page.locale.ingredientsJson) as IngredientEntry[];
  const steps = JSON.parse(page.locale.stepsJson) as string[];
  const sys = defaultUnitSystem(page.locale.country);
  const prepIso = isoDuration(page.recipe.prepMinutes);
  const cookIso = isoDuration(page.recipe.cookMinutes);
  const totalIso = isoDuration(page.recipe.totalMinutes);

  const recipeLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: page.locale.title,
    inLanguage: page.locale.lang,
    ...(page.locale.intro ? { description: page.locale.intro } : {}),
    ...(canonicalUrl ? { url: canonicalUrl, mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl } } : {}),
    author: { '@type': 'Organization', name: '2yolks', url: `${origin}/` },
    publisher: { '@type': 'Organization', name: '2yolks', url: `${origin}/` },
    isAccessibleForFree: true,
    ...(page.recipe.createdAt ? { datePublished: page.recipe.createdAt } : {}),
    ...(prepIso ? { prepTime: prepIso } : {}),
    ...(cookIso ? { cookTime: cookIso } : {}),
    ...(totalIso ? { totalTime: totalIso } : {}),
    ...(page.recipe.baseServings != null ? { recipeYield: `${page.recipe.baseServings} ${t.servings.toLowerCase()}` } : {}),
    ...(cat ? { recipeCategory: cat } : {}),
    ...(opts.countryName ? { recipeCuisine: opts.countryName } : {}),
    ...(page.heroImage ? { image: [page.heroImage.url] } : {}),
    recipeIngredient: entries.map((e) => renderIngredient(e, page.locale.lang, sys, 1)),
    recipeInstructions: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text: renderStep(s, entries, page.locale.lang, sys, 1),
      ...(canonicalUrl ? { url: `${canonicalUrl}#step-${i + 1}` } : {}),
    })),
  };

  const crumbElements: Record<string, unknown>[] = [
    {
      '@type': 'ListItem',
      position: 1,
      name: t.home,
      item: `${origin}/?lang=${page.locale.lang}`,
    },
  ];
  if (cat && page.recipe.category) {
    crumbElements.push({
      '@type': 'ListItem',
      position: 2,
      name: cat,
      item: `${origin}/?lang=${page.locale.lang}&cat=${page.recipe.category}#recipes`,
    });
  }
  if (canonicalUrl) {
    crumbElements.push({
      '@type': 'ListItem',
      position: crumbElements.length + 1,
      name: page.locale.title,
      item: canonicalUrl,
    });
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbElements,
  };

  // Title-only graphic (no food photo), built by scripts/build-pin-graphics.py. Only recipes with a built file get one.
  const pinUrl = canonicalUrl && PIN_IMAGE_KEYS.has(`${page.locale.recipeId}:${page.locale.lang}`) ? `${origin}/img/pin/${page.locale.recipeId}.${page.locale.lang}.png` : null;
  // A rights-tracked hero image (migration 0004) wins over the title graphic.
  const imageUrl = page.heroImage?.url ?? pinUrl;
  const cookData = safeJsonLd({
    steps: steps.map((st) => renderStep(st, entries, page.locale.lang, sys, 1)),
    strings: { timerDone: t.timerDone },
  });
  const alternateLocales = alternates
    .filter((a) => a.hreflang !== 'x-default' && a.hreflang.toLowerCase() !== `${page.locale.lang}-${page.locale.country}`.toLowerCase())
    .map((a) => {
      const [l, c] = a.hreflang.split('-');
      return l && c ? `${l}_${c.toUpperCase()}` : a.hreflang;
    });
  const body =
    renderToString(
      <RecipeView
        page={page}
        alternates={alternates}
        canonicalUrl={canonicalUrl}
        imageUrl={imageUrl}
        countryName={opts.countryName}
        related={opts.related}
      />,
    ) +
    `<script type="application/json" id="cook-data">${cookData}</script>` +
    `<script>${RECIPE_CLIENT_SCRIPT}</script>`;
  return shell(body, {
    title: `${page.locale.title} - 2yolks`,
    alternates,
    jsonLd: canonicalUrl ? [recipeLd, breadcrumbLd] : recipeLd,
    nav: opts.nav,
    lang: page.locale.lang,
    og: canonicalUrl
      ? {
          type: 'article',
          title: page.locale.title,
          description: page.locale.intro ?? undefined,
          url: canonicalUrl,
          locale: `${page.locale.lang}_${page.locale.country.toUpperCase()}`,
          alternateLocales,
          image: imageUrl,
          imageAlt: page.locale.title,
        }
      : undefined,
    // Synthetic/dev-only sources must never be indexed as real recipes.
    noindex: page.source.license === 'internal-demo',
  });
}

const ACCOUNT_CSS = `
.acct { max-width: 44rem; margin: 2rem auto; padding: 1.75rem 1.5rem 2rem; border-radius: 1.1rem; }
.acct h1 { font-family: var(--font-display); margin: 0 0 0.5rem; }
.acct .lead { color: var(--muted); margin: 0 0 1.5rem; }
.acct form { display: grid; gap: 0.9rem; margin: 0 0 1.75rem; }
.acct label { display: grid; gap: 0.3rem; font-weight: 600; font-size: 0.95rem; }
.acct label small, .acct .hint { font-weight: 400; color: var(--muted); }
.acct input[type=text], .acct input[type=email], .acct input[type=url], .acct input[type=number], .acct select, .acct textarea { font: inherit; padding: 0.6rem 0.75rem; border: 1px solid var(--line); border-radius: 0.6rem; background: var(--card); color: var(--ink); width: 100%; box-sizing: border-box; }
.acct textarea { min-height: 9rem; }
.acct .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
.acct .check { display: flex; gap: 0.6rem; align-items: flex-start; font-weight: 400; }
.acct .check input { margin-top: 0.25rem; }
.acct button, .acct .btn { background: var(--brand); color: #fff; border: 0; border-radius: 999px; padding: 0.7rem 1.4rem; font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; justify-self: start; }
.acct button.quiet { background: var(--card); color: var(--ink); border: 1px solid var(--line); }
.acct .live-checks { list-style: none; padding: 0; margin: 0 0 1rem; font-size: 0.85rem; }
.acct .live-checks li { padding: 0.15rem 0; }
.acct .live-checks li.idle { color: #9b8fa3; }
.acct .live-checks li.ok { color: #3f7a3f; }
.acct .live-checks li.todo { color: #8a6d3b; }
.acct .panel { border: 1px solid var(--line); background: var(--card); border-radius: 0.9rem; padding: 1rem 1.1rem; margin: 0 0 1.25rem; }
.acct .panel h2 { margin: 0 0 0.5rem; font-size: 1.05rem; }
.acct .err { border-left: 4px solid #b3261e; background: #fdecea; padding: 0.7rem 1rem; border-radius: 0.4rem; margin: 0 0 1rem; }
.acct .ok { border-left: 4px solid #2e7d32; background: #edf7ee; padding: 0.7rem 1rem; border-radius: 0.4rem; margin: 0 0 1rem; }
.acct ul.mine { list-style: none; padding: 0; margin: 0; }
.acct ul.mine li { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: 0.7rem 0; border-bottom: 1px solid var(--line); }
.acct .badge { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
@media (max-width: 640px) { .acct .row { grid-template-columns: 1fr; } .acct { margin: 1rem 0.75rem; padding: 1.25rem 1rem 1.5rem; } }
`;

/** Private, never-indexed page in the After hours shell (account + submissions).
 * The account UI is localized en/es/fr: `lang` sets the document language and
 * the header/footer chrome, `path` is the current request path used to build
 * the language-switch links (query string replaced, lang preserved). */
export function renderAccountPage(title: string, bodyHtml: string, lang = 'en', path = '/account'): string {
  const nav = ['en', 'es', 'fr'].map((l) => ({ href: `${path}?lang=${l}`, label: l === 'en' ? 'English' : l === 'es' ? 'Español' : 'Français', current: l === lang }));
  return shell(`<style>${ACCOUNT_CSS}</style><main id="main" class="acct">${bodyHtml}</main>`, { title: `${title} - 2yolks`, noindex: true, lang, nav });
}

export { CAPTURE_CLIENT_SCRIPT, CAPTURE_CHECK_STRINGS };
