import { renderToString } from 'react-dom/server';

/** Escape text interpolated into raw HTML/SVG elements. */
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
import {
  THEME_CLIENT_SCRIPT,
  RECIPE_CLIENT_SCRIPT,
  DISCOVERY_CLIENT_SCRIPT,
  CAPTURE_CLIENT_SCRIPT,
  CAPTURE_CHECK_STRINGS,
} from './clientScript';
import type { RecipePage, IngredientEntry } from '@2yolks/contracts';
import {
  uiStrings,
  renderIngredient,
  renderStep,
  defaultUnitSystem,
  COUNTRY_INTROS,
  defaultLocale,
  categoryLabel,
  recipePathFor,
  isUntested,
} from '@2yolks/contracts';

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
:root { color-scheme: light; --brand: #493253; --brand-strong: #302038; --yolk: #ffd166; --ink: #261b2c; --muted: #64586a; --bg: #faf8f3; --card: #fffdf8; --line: #d7d0cc; --line-strong: #827384; --amber-bg: #fffbeb; --amber-line: #fcd34d; --amber-ink: #78350f; --blue-bg: #eff6ff; --blue-line: #93c5fd; --radius: 0; --shadow: 0 1px 2px rgb(28 25 23 / 0.05), 0 12px 32px -16px rgb(28 25 23 / 0.28); --font-body: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; --font-display: 'Fraunces', Georgia, 'Times New Roman', serif; }
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font-body); background: var(--bg); color: var(--ink); line-height: 1.6; }
a { color: var(--brand); }
a:focus-visible, button:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
h1, h2 { font-family: var(--font-display); font-weight: 650; letter-spacing: -0.02em; line-height: 1.12; }
h1 { font-size: clamp(2rem, 4.5vw, 2.9rem); margin: 0.25rem 0 1rem; overflow-wrap: break-word; }
h2 { font-size: 1.65rem; margin: 2.25rem 0 0.75rem; }
main { max-width: 44rem; margin: 0 auto; padding: 1.75rem 1.25rem 3.5rem; }
main.wide { max-width: 72rem; }
main img { max-width: 100%; height: auto; }
/* Header */
.site-header { background: var(--card); border-bottom: 1px solid var(--line); }
.header-inner { max-width: 72rem; margin: 0 auto; padding: 0.7rem 1rem; display: flex; align-items: center; gap: 0.75rem 1rem; flex-wrap: wrap; }
.brand { display: inline-flex; align-items: center; gap: 0.55rem; text-decoration: none; color: var(--ink); }
.brand-mark { width: 1.75rem; height: 1.75rem; flex-shrink: 0; }
.brand-word { font-family: var(--font-display); font-weight: 700; font-size: 1.4rem; letter-spacing: -0.03em; }
.site-nav { margin-left: auto; display: flex; flex-wrap: wrap; gap: 0.15rem; }
.site-nav a { padding: 0.45rem 0.85rem; color: var(--muted); text-decoration: none; font-weight: 600; font-size: 0.95rem; }
.skip { position: absolute; left: -9999px; top: 0; background: var(--card); color: var(--ink); padding: 0.5rem 1rem; border: 1px solid var(--line-strong); z-index: 100; }
.skip:focus { left: 0; }
/* Recipe cards */
.recipe-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.recipe-card { position: relative; display: flex; flex-direction: column; gap: 0.4rem; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.1rem 1.25rem; transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; }
.recipe-card:hover { border-color: var(--line-strong); box-shadow: var(--shadow); transform: translateY(-2px); }
.recipe-card h3 { font-family: var(--font-display); font-size: 1.2rem; font-weight: 650; line-height: 1.3; margin: 0; }
.recipe-card h3 a { color: var(--ink); text-decoration: none; }
.recipe-card h3 a:hover { color: var(--brand); }
.recipe-card h3 a.stretched::after { content: ''; position: absolute; inset: 0; border-radius: var(--radius); }
.recipe-card .meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem 0.6rem; margin: 0; color: var(--muted); font-size: 0.9rem; }
.meta-country { display: inline-flex; align-items: center; gap: 0.35rem; }
.yolk-dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--yolk); display: inline-block; }
.chips { display: flex; flex-wrap: wrap; gap: 0.375rem; margin: 0.25rem 0 0; position: relative; z-index: 1; }
.chip { display: inline-flex; align-items: center; font-size: 0.8rem; font-weight: 600; color: var(--muted); background: var(--bg); border: 1px solid var(--line); padding: 0.18rem 0.65rem; text-decoration: none; }
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
.badge { display: inline-block; padding: 0.05rem 0.55rem; background: var(--amber-bg); color: var(--amber-ink); border: 1px solid var(--amber-line); font-size: 0.75rem; font-weight: 700; }
.machine-note { background: var(--blue-bg); border: 1px solid var(--blue-line); padding: 0.6rem 0.9rem; font-size: 0.95rem; }
.untested { background: var(--amber-bg); border: 1px solid var(--amber-line); padding: 0.6rem 0.9rem; font-size: 0.95rem; }
.langs { font-size: 0.9rem; color: var(--muted); display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; }
.langs a { display: inline-flex; align-items: center; min-height: 44px; }
.langs .chip { min-height: 0; }
.recipe-actions { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: center; margin: 0.5rem 0 1rem; }
.recipe-actions .jump { font-weight: 700; text-decoration: none; }
.recipe-actions .jump:hover { text-decoration: underline; }
.recipe-actions .cook-open { margin-left: auto; background: var(--brand); color: #fff; border: 0; padding: 0.55rem 1.2rem; font-weight: 700; cursor: pointer; font-size: 0.95rem; }
.recipe-actions .cook-open:hover { background: var(--brand-strong); }
.recipe-actions .print-open { background: var(--card); color: var(--ink); border: 1px solid var(--line); padding: 0.55rem 1.1rem; font-weight: 600; cursor: pointer; font-size: 0.95rem; }
.recipe-actions .print-open:hover { border-color: var(--line-strong); }
.scaler, .unit-toggle { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; margin: 0 0 0.75rem; }
.scaler-label { color: var(--muted); font-size: 0.9rem; margin-right: 0.25rem; }
.scaler button, .unit-toggle button { border: 1px solid var(--line); background: var(--card); padding: 0.3rem 0.8rem; cursor: pointer; font-weight: 600; font-size: 0.9rem; color: var(--ink); }
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
ol.steps li::before { content: counter(step, decimal-leading-zero); position: absolute; left: 0; top: 0.05rem; font-family: var(--font-display); font-weight: 650; font-size: 1.05rem; color: var(--brand); }
/* Cook mode */
.cook-mode { position: fixed; inset: 0; background: var(--bg); z-index: 50; display: flex; }
.cook-mode[hidden] { display: none; }
.cook-inner { max-width: 44rem; margin: auto; padding: 1.5rem; width: 100%; display: flex; flex-direction: column; gap: 1.5rem; min-height: 60vh; justify-content: center; }
.cook-top { display: flex; justify-content: space-between; align-items: center; color: var(--muted); }
.cook-close { background: var(--card); color: var(--ink); border: 1px solid var(--line); padding: 0.4rem 1rem; cursor: pointer; font-weight: 600; }
.cook-step { font-family: var(--font-display); font-size: clamp(1.45rem, 4vw, 1.9rem); line-height: 1.35; font-weight: 500; margin: 0; }
.cook-nav { display: flex; justify-content: space-between; gap: 1rem; }
.cook-nav button { flex: 1; background: var(--brand); color: #fff; border: 0; padding: 0.8rem; font-size: 1.05rem; font-weight: 700; cursor: pointer; }
.cook-nav button:first-child { background: var(--card); color: var(--ink); border: 1px solid var(--line); }
.cook-timer { display: flex; gap: 0.75rem; align-items: center; }
.cook-timer[hidden] { display: none; }
.timer-btn { border: 1px solid var(--brand); color: var(--brand); background: none; padding: 0.45rem 1rem; font-weight: 600; cursor: pointer; }
.timer-display { font-size: 1.4rem; font-weight: 700; font-variant-numeric: tabular-nums; }
/* Share + source */
.share { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: center; margin: 1.75rem 0 0; font-size: 0.95rem; }
.share-label { color: var(--muted); }
.share button { border: 1px solid var(--line); background: var(--card); padding: 0.3rem 0.85rem; cursor: pointer; font-weight: 600; font-size: 0.9rem; }
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
@media (max-width: 640px) { .footer-inner { grid-template-columns: 1fr; gap: 1.25rem; } }
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

const THEME_INIT_SCRIPT = `<script>(function(){try{var t=localStorage.getItem('2y-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>`;

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
    ${THEME_INIT_SCRIPT}
    <style>${BASE_CSS}\n${AFTER_HOURS_CSS}</style>
    ${ANALYTICS_BEACON}
  </head>
  <body>${header}${body}${footer}<script>${THEME_CLIENT_SCRIPT}</script></body>
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

function staticAlternates(origin: string, path: string) {
  return [
    { hreflang: 'en', href: `${origin}${path}` },
    { hreflang: 'es', href: `${origin}${path}?lang=es` },
    { hreflang: 'fr', href: `${origin}${path}?lang=fr` },
    { hreflang: 'x-default', href: `${origin}${path}` },
  ];
}

export function renderPrivacy(nav?: SiteNavItem[], origin = 'https://2yolks.com', lang = 'en'): string {
  const l = ['en', 'es', 'fr'].includes(lang) ? lang : 'en';
  const title = l === 'es' ? 'Privacidad - 2yolks' : l === 'fr' ? 'Confidentialité - 2yolks' : 'Privacy - 2yolks';
  const description = l === 'es'
    ? 'Cómo gestiona 2yolks la privacidad: lectura sin cookies y borradores privados.'
    : l === 'fr'
      ? 'Comment 2yolks gère la confidentialité : lecture sans cookies et brouillons privés.'
      : 'How 2yolks handles privacy: cookieless reading, local unit preferences, and private recipe drafts.';
  const url = l === 'en' ? `${origin}/privacy` : `${origin}/privacy?lang=${l}`;
  return shell(renderToString(<PrivacyView lang={l} />), {
    title,
    nav,
    lang: l,
    alternates: staticAlternates(origin, '/privacy'),
    og: { type: 'website', title, description, url, locale: (HOME_SEO[l] ?? HOME_SEO.en!).locale },
  });
}

export function renderAbout(nav?: SiteNavItem[], origin = 'https://2yolks.com', lang = 'en'): string {
  const l = ['en', 'es', 'fr'].includes(lang) ? lang : 'en';
  const title = l === 'es' ? 'Acerca de 2yolks' : l === 'fr' ? 'À propos de 2yolks' : 'About 2yolks';
  const description = l === 'es'
    ? '2yolks es una plataforma internacional de recetas en español, inglés y francés con etiquetas honestas.'
    : l === 'fr'
      ? '2yolks est une plateforme internationale de recettes en français, anglais et espagnol avec un statut de test honnête.'
      : '2yolks is an international recipe platform in English, Spanish, and French with honest testing labels and cleared sources.';
  const url = l === 'en' ? `${origin}/about` : `${origin}/about?lang=${l}`;
  return shell(renderToString(<AboutView lang={l} />), {
    title,
    nav,
    lang: l,
    alternates: staticAlternates(origin, '/about'),
    og: { type: 'website', title, description, url, locale: (HOME_SEO[l] ?? HOME_SEO.en!).locale, image: `${origin}/img/identity/after-hours.webp` },
  });
}

export function renderHowWeTest(nav?: SiteNavItem[], origin = 'https://2yolks.com', lang = 'en'): string {
  const l = ['en', 'es', 'fr'].includes(lang) ? lang : 'en';
  const title = l === 'es'
    ? 'Cómo probamos y etiquetamos las recetas - 2yolks'
    : l === 'fr'
      ? 'Comment nous testons et étiquetons les recettes - 2yolks'
      : 'How we test and label recipes - 2yolks';
  const description = l === 'es'
    ? 'Cada receta en 2yolks indica claramente si aún no ha sido probada o si ya fue cocinada.'
    : l === 'fr'
      ? 'Chaque recette sur 2yolks indique clairement si elle est pas encore testée ou testée en cuisine.'
      : 'Every recipe on 2yolks is clearly labeled as Not yet tested or Tested with real kitchen yield and timing.';
  const url = l === 'en' ? `${origin}/how-we-test` : `${origin}/how-we-test?lang=${l}`;
  return shell(renderToString(<HowWeTestView lang={l} />), {
    title,
    nav,
    lang: l,
    alternates: staticAlternates(origin, '/how-we-test'),
    og: { type: 'website', title, description, url, locale: (HOME_SEO[l] ?? HOME_SEO.en!).locale, image: `${origin}/img/identity/after-hours.webp` },
  });
}

export function renderNotFound(): string {
  return shell(renderToString(<NotFoundView />), { title: 'Page not found - 2yolks', noindex: true });
}

function wrapTextLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars || !cur) {
      cur = next;
    } else {
      out.push(cur);
      cur = w;
      if (out.length === maxLines - 1) break;
    }
  }
  if (cur && out.length < maxLines) {
    const usedWords = out.join(' ').split(/\s+/).filter(Boolean).length;
    const remaining = words.slice(usedWords).join(' ');
    out.push(remaining.length > maxChars + 4 ? `${remaining.slice(0, maxChars - 1).trimEnd()}…` : remaining);
  }
  return out;
}

/**
 * Generates a crisp 1080x1920 (9:16) editorial SVG Story / Pinterest / WhatsApp
 * recipe card on the fly from any published RecipePage. Zero server image libraries.
 */
export function renderRecipeCardSvg(page: RecipePage, origin = 'https://2yolks.com'): string {
  const lang = page.locale.lang;
  const t = uiStrings(lang);
  const sys = defaultUnitSystem(page.locale.country);
  const entries = JSON.parse(page.locale.ingredientsJson) as IngredientEntry[];
  const steps = JSON.parse(page.locale.stepsJson) as string[];
  const cat = (categoryLabel(page.recipe.category, lang) ?? t.allRecipes).toUpperCase();
  const titleLines = wrapTextLines(page.locale.title, 20, 3);
  const introLines = page.locale.intro ? wrapTextLines(page.locale.intro, 44, 2) : [];
  const topIngredients = entries
    .slice(0, 6)
    .map((e) => renderIngredient(e, lang, sys, 1))
    .map((line) => (line.length > 46 ? `${line.slice(0, 44).trimEnd()}…` : line));
  const moreCount = Math.max(0, entries.length - topIngredients.length);
  const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`);
  const badges: string[] = [];
  if (page.recipe.totalMinutes != null) badges.push(`${t.timeTotal}: ${fmtMin(page.recipe.totalMinutes)}`);
  else if (page.recipe.cookMinutes != null) badges.push(`${t.timeCook}: ${fmtMin(page.recipe.cookMinutes)}`);
  if (page.recipe.baseServings != null) badges.push(`${t.servings}: ${page.recipe.baseServings}`);
  badges.push(`${steps.length} ${t.steps.toLowerCase()}`);
  const statusText = isUntested(page.recipe) ? t.untestedBadge : `✓ ${t.testedBadge}`;
  const canonicalHost = (() => {
    try { return new URL(origin).host; } catch { return '2yolks.com'; }
  })();
  const canonicalPath = recipePathFor(page.locale.country, page.locale.lang, page.locale.slug);

  const titleStartY = 330;
  const titleStepY = 92;
  const afterTitleY = titleStartY + titleLines.length * titleStepY + 22;
  const introStepY = 44;
  const afterIntroY = afterTitleY + (introLines.length ? introLines.length * introStepY + 34 : 16);
  const metaBoxY = afterIntroY;
  const ingBoxY = metaBoxY + 130;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" role="img" aria-label="${escapeHtml(page.locale.title)} — 2yolks">
  <rect width="1080" height="1920" fill="#211729" />
  <rect x="44" y="44" width="992" height="1832" fill="none" stroke="#65566e" stroke-width="2" />
  <rect x="44" y="44" width="992" height="14" fill="#e0fa80" />

  <!-- Brand Header -->
  <g transform="translate(96, 128)">
    <text x="0" y="38" fill="#faf7f4" font-family="Fraunces, Georgia, 'Times New Roman', serif" font-size="52" font-weight="700" letter-spacing="-1.5">2yolks</text>
    <ellipse cx="195" cy="22" rx="20" ry="18" fill="#e0fa80" />
    <ellipse cx="232" cy="19" rx="18" ry="16.5" fill="#ffd166" />
    <rect x="610" y="-4" width="278" height="52" fill="#2e2038" stroke="#756580" stroke-width="1.5" />
    <text x="749" y="30" text-anchor="middle" fill="#e0fa80" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="22" font-weight="700">${escapeHtml(statusText)}</text>
  </g>

  <!-- Category Eyebrow -->
  <g transform="translate(96, 224)">
    <rect x="0" y="0" width="${Math.min(888, Math.max(180, cat.length * 17 + 44))}" height="48" fill="#e0fa80" />
    <text x="22" y="32" fill="#211729" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="22" font-weight="800" letter-spacing="2.2">${escapeHtml(cat)}</text>
  </g>

  <!-- Recipe Title -->
  ${titleLines
    .map(
      (line, idx) =>
        `<text x="96" y="${titleStartY + idx * titleStepY}" fill="#faf7f4" font-family="Fraunces, Georgia, 'Times New Roman', serif" font-size="78" font-weight="700" letter-spacing="-1.6">${escapeHtml(line)}</text>`,
    )
    .join('\n  ')}

  <!-- Intro -->
  ${introLines
    .map(
      (line, idx) =>
        `<text x="96" y="${afterTitleY + idx * introStepY}" fill="#ded5e4" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="30" font-weight="400">${escapeHtml(line)}</text>`,
    )
    .join('\n  ')}

  <!-- Facts Strip -->
  <g transform="translate(96, ${metaBoxY})">
    <rect x="0" y="0" width="888" height="84" fill="#2b1e35" stroke="#65566e" stroke-width="1.5" />
    <rect x="0" y="0" width="8" height="84" fill="#e0fa80" />
    <text x="34" y="52" fill="#e0fa80" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="28" font-weight="700">${escapeHtml(badges.join('   ·   '))}</text>
  </g>

  <!-- Ingredients Card -->
  <g transform="translate(96, ${ingBoxY})">
    <rect x="0" y="0" width="888" height="${Math.min(1680 - ingBoxY, 130 + topIngredients.length * 76 + (moreCount > 0 ? 64 : 24))}" fill="#faf8f3" />
    <rect x="0" y="0" width="888" height="10" fill="#e0fa80" />
    <text x="44" y="72" fill="#211729" font-family="Fraunces, Georgia, 'Times New Roman', serif" font-size="40" font-weight="700">${escapeHtml(t.ingredients)}</text>
    ${topIngredients
      .map(
        (ing, idx) => `<g transform="translate(44, ${128 + idx * 74})">
      <rect x="0" y="-26" width="28" height="28" fill="none" stroke="#493253" stroke-width="2.5" />
      <text x="48" y="-2" fill="#261b2c" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="30" font-weight="500">${escapeHtml(ing)}</text>
    </g>`,
      )
      .join('\n    ')}
    ${moreCount > 0
      ? `<text x="44" y="${132 + topIngredients.length * 74}" fill="#64586a" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="26" font-style="italic">+ ${moreCount} ${escapeHtml(lang === 'es' ? 'ingredientes más' : lang === 'fr' ? 'autres ingrédients' : 'more ingredients')}</text>`
      : ''}
  </g>

  <!-- Footer Stamp -->
  <g transform="translate(96, 1765)">
    <line x1="0" y1="0" x2="888" y2="0" stroke="#65566e" stroke-width="1.5" />
    <text x="0" y="54" fill="#e0fa80" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="28" font-weight="700">${escapeHtml(canonicalHost + canonicalPath)}</text>
    <text x="888" y="54" text-anchor="end" fill="#cbb8d2" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="24" font-weight="600">#CookedWith2Yolks</text>
  </g>
</svg>`;
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
.acct { max-width: 46rem; margin: 2rem auto; padding: 1.75rem 1.5rem 2.5rem; }
.acct h1 { font-family: var(--font-display); margin: 0 0 0.5rem; }
.acct .lead { color: var(--muted); margin: 0 0 1.5rem; }
.acct form { display: grid; gap: 0.9rem; margin: 0 0 1.75rem; }
.acct label { display: grid; gap: 0.3rem; font-weight: 600; font-size: 0.95rem; }
.acct label small, .acct .hint { font-weight: 400; color: var(--muted); }
.acct input[type=text], .acct input[type=email], .acct input[type=url], .acct input[type=number], .acct select, .acct textarea { font: inherit; padding: 0.6rem 0.75rem; border: 1px solid var(--line-strong); background: var(--card); color: var(--ink); width: 100%; box-sizing: border-box; }
.acct textarea { min-height: 9rem; }
.acct .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
.acct .check { display: flex; gap: 0.6rem; align-items: flex-start; font-weight: 400; }
.acct .check input { margin-top: 0.25rem; }
.acct button, .acct .btn { background: var(--plum); color: var(--lime); border: 1px solid var(--plum); padding: 0.68rem 1.35rem; font: inherit; font-weight: 750; cursor: pointer; text-decoration: none; justify-self: start; display: inline-flex; align-items: center; gap: 0.4rem; }
.acct button:hover, .acct .btn:hover { background: var(--brand-strong); }
.acct button:disabled { opacity: 0.55; cursor: not-allowed; }
.acct button.quiet { background: var(--card); color: var(--ink); border: 1px solid var(--line-strong); font-weight: 650; }
.acct button.quiet:hover { border-color: var(--plum); }
.acct .live-checks { list-style: none; padding: 0; margin: 0 0 1rem; font-size: 0.85rem; }
.acct .live-checks li { padding: 0.15rem 0; }
.acct .live-checks li.idle { color: var(--muted); }
.acct .live-checks li.ok { color: #2e7d32; }
.acct .live-checks li.todo { color: #9a6700; }
html[data-theme="dark"] .acct .live-checks li.ok { color: var(--lime); }
html[data-theme="dark"] .acct .live-checks li.todo { color: #ffd166; }
html[data-theme="dark"] .acct button, html[data-theme="dark"] .acct .btn { background: var(--lime); color: var(--plum); border-color: var(--lime); }
html[data-theme="dark"] .acct button.quiet { background: var(--card); color: var(--ink); border-color: var(--line-strong); }
.acct .panel { border: 1px solid var(--line); background: var(--card); padding: 1.15rem 1.25rem; margin: 0 0 1.25rem; }
.acct .panel h2 { margin: 0 0 0.45rem; font-size: 1.15rem; }
.acct .ai-panel { border: 1px solid var(--plum); border-left: 5px solid var(--lime); background: var(--card); }
html[data-theme="dark"] .acct .ai-panel { border-color: var(--line-strong); border-left-color: var(--lime); }
.acct .ai-grid { display: grid; gap: 0.85rem; margin-top: 0.75rem; }
.acct .ai-media-row { display: flex; flex-wrap: wrap; gap: 0.85rem; align-items: center; }
.acct .ai-preview { width: 84px; height: 84px; object-fit: cover; border: 1px solid var(--line-strong); }
.acct .ai-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
.acct .ai-feedback { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed var(--line); font-size: 0.9rem; }
.acct .ai-feedback h3 { font-size: 0.95rem; margin: 0 0 0.45rem; }
.acct .ai-feedback ul { margin: 0; padding-left: 1.2rem; }
.acct .ai-question { margin-bottom: 0.65rem; }
.acct .ai-question p { margin: 0 0 0.35rem; font-weight: 600; }
.acct .ai-choices { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.acct .ai-chip { padding: 0.3rem 0.7rem; font-size: 0.82rem; }
.acct .err { border-left: 4px solid #b3261e; background: #fdecea; color: #410e0b; padding: 0.7rem 1rem; margin: 0 0 1rem; }
.acct .ok { border-left: 4px solid #2e7d32; background: #edf7ee; color: #1b431e; padding: 0.7rem 1rem; margin: 0 0 1rem; }
.acct ul.mine { list-style: none; padding: 0; margin: 0; }
.acct ul.mine li { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: 0.7rem 0; border-bottom: 1px solid var(--line); }
.acct .badge { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); background: transparent; border: 0; padding: 0; }
@media (max-width: 640px) { .acct .row { grid-template-columns: 1fr; } .acct { margin: 1rem 0.5rem; padding: 1.25rem 0.85rem 1.75rem; } }
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
