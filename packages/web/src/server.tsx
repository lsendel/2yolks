import { renderToString } from 'react-dom/server';

// Re-exported for the worker's JSON feed route (same per-recipe language
// selection as the SSR discovery lists).
export { discoveryRecipes } from './App';


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
  SearchPage,
  HubPage,
  HubDirectoryPage,
  SavedPage,
  AboutView,
  PrivacyView,
  HowWeTestView,
  NotFoundView,
  SiteHeader,
  SearchSheet,
  MobileTabBar,
  SiteFooter,
  discoveryRecipes,
  buildSearchHref,
  type HomeProps,
  type CountryHomeProps,
  type SearchPageProps,
  type HubPageProps,
  type HubDirectoryItem,
  type SiteNavItem,
  type RecipeRow,
} from './App';
import {
  THEME_CLIENT_SCRIPT,
  GLOBAL_CHROME_SCRIPT,
  RECIPE_CLIENT_SCRIPT,
  DISCOVERY_CLIENT_SCRIPT,
  CAPTURE_CLIENT_SCRIPT,
  CAPTURE_HELPERS_JS,
  CAPTURE_CHECK_STRINGS,
  ACCOUNT_LIVE_SHARE_SCRIPT,
  PASSKEY_CLIENT_SCRIPT,
} from './clientScript';
import { DRAFT_PHOTO_CLIENT_SCRIPT } from './photoClientScript';
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
  asImageStyle,
  MAX_HOME_ITEMS,
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
    imageWidth?: number;
    imageHeight?: number;
    type?: 'article' | 'website';
  };
  /** Countries-with-content nav for the header/footer. */
  nav?: SiteNavItem[];
  /** Locale for chrome strings (header/footer/skip link). */
  lang?: string;
  currentPath?: string;
  initialQuery?: string;
  cuisines?: { slug: string; label: string }[];
}

import { DESIGN_SYSTEM_CSS } from './identity';

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

const THEME_INIT_SCRIPT = `<script>(function(){try{var t=localStorage.getItem('2y-theme');if(t!=='dark'&&t!=='light'&&window.matchMedia){if(window.matchMedia('(prefers-color-scheme: dark)').matches)t='dark';else if(window.matchMedia('(prefers-color-scheme: light)').matches)t='light';}if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>`;

function shell(body: string, { title, alternates = [], jsonLd, noindex = false, og, nav = [], lang = 'en', currentPath = '/', initialQuery = '', cuisines = [] }: ShellOptions): string {
  const links = alternates
    .map((a) => `<link rel="alternate" hreflang="${escapeHtml(a.hreflang)}" href="${escapeHtml(a.href)}" />`)
    .join('\n    ');
  const ldList = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  const ld = ldList.map((item) => `<script type="application/ld+json">${safeJsonLd(item)}</script>`).join('\n    ');
  const header = renderToString(<SiteHeader nav={nav} lang={lang} initialQuery={initialQuery} cuisines={cuisines} />);
  const searchSheet = renderToString(<SearchSheet lang={lang} initialQuery={initialQuery} />);
  const mobileTabs = renderToString(<MobileTabBar lang={lang} currentPath={currentPath} />);
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
    ${og.image ? `<meta property="og:image" content="${escapeHtml(og.image)}" />${og.imageWidth ? `<meta property="og:image:width" content="${og.imageWidth}" />` : ''}${og.imageHeight ? `<meta property="og:image:height" content="${og.imageHeight}" />` : ''}${og.imageAlt ? `<meta property="og:image:alt" content="${escapeHtml(og.imageAlt)}" />` : ''}` : ''}
    <meta name="twitter:card" content="${og.image ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${escapeHtml(og.title)}" />
    ${og.description ? `<meta name="twitter:description" content="${escapeHtml(og.description)}" />` : ''}
    ${og.image ? `<meta name="twitter:image" content="${escapeHtml(og.image)}" />` : ''}` : ''}
    ${ld}
    ${THEME_INIT_SCRIPT}
    <style>${DESIGN_SYSTEM_CSS}</style>
    ${ANALYTICS_BEACON}
  </head>
  <body>${header}${body}${footer}${searchSheet}${mobileTabs}<script>${THEME_CLIENT_SCRIPT}</script><script>${GLOBAL_CHROME_SCRIPT}</script></body>
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

/** Picks the catalogue language from an Accept-Language header: first
 * supported language (en/es/fr) in q-value order, 'en' when nothing
 * matches or the header is absent. Prefix-matched, so es-MX lands on es.
 * Luis's pick 2A (2026-11-19): the browser language only DEFAULTS the
 * catalogue language; the visible switcher confirmation stays on screen. */
export function browserLang(header: string | null | undefined): string {
  const supported = ['en', 'es', 'fr'];
  if (!header) return 'en';
  const parsed = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
      return { code: (tag ?? '').slice(0, 2).toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((e) => e.code && supported.includes(e.code))
    .sort((a, b) => b.q - a.q);
  return parsed[0]?.code ?? 'en';
}

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
  const ldItems = selected.slice(0, MAX_HOME_ITEMS);
  const firstPhoto = selected.find((r) => r.imageId && asImageStyle(r.imageStyle) === 'photo');
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
    ...(ldItems.length > 0
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: seo.title,
            numberOfItems: ldItems.length,
            itemListElement: ldItems.map((r, i) => ({
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
    currentPath: '/',
    alternates,
    jsonLd,
    og: {
      type: 'website',
      title: seo.title,
      description: seo.description,
      url: canonicalUrl,
      locale: seo.locale,
      alternateLocales: ['en_US', 'es_MX', 'fr_FR'].filter((l) => l !== seo.locale),
      image: firstPhoto ? `${origin}/img/recipe/${firstPhoto.imageId}` : `${origin}/img/identity/after-hours.webp`,
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
    currentPath: '/recipes',
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
    currentPath: `/${props.country.toLowerCase()}/`,
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
    currentPath: '/privacy',
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
    currentPath: '/about',
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
    currentPath: '/how-we-test',
    alternates: staticAlternates(origin, '/how-we-test'),
    og: { type: 'website', title, description, url, locale: (HOME_SEO[l] ?? HOME_SEO.en!).locale, image: `${origin}/img/identity/after-hours.webp` },
  });
}

export function renderSearchPage(props: SearchPageProps, nav?: SiteNavItem[], origin = 'https://2yolks.com'): string {
  const lang = ['en', 'es', 'fr'].includes(props.lang) ? props.lang : 'en';
  const q = props.query.q?.trim();
  const baseTitle = lang === 'es' ? 'Buscar recetas - 2yolks' : lang === 'fr' ? 'Rechercher une recette - 2yolks' : 'Search recipes - 2yolks';
  const title = q ? `${q} — ${baseTitle}` : baseTitle;
  const description = lang === 'es'
    ? 'Busca y filtra recetas por tiempo, categoría, dieta, cocina y preparación sin horno.'
    : lang === 'fr'
      ? 'Recherchez et filtrez les recettes par durée, catégorie, régime, cuisine et cuisson sans four.'
      : 'Search and filter recipes by time, category, diet, cuisine, difficulty, or stovetop method.';
  const canonicalUrl = `${origin}${buildSearchHref(lang, { ...props.query, page: props.query.page && props.query.page > 1 ? props.query.page : undefined })}`;
  const alternates = [
    { hreflang: 'en', href: `${origin}${buildSearchHref('en', props.query)}` },
    { hreflang: 'es', href: `${origin}${buildSearchHref('es', props.query)}` },
    { hreflang: 'fr', href: `${origin}${buildSearchHref('fr', props.query)}` },
    { hreflang: 'x-default', href: `${origin}${buildSearchHref('en', props.query)}` },
  ];
  const jsonLd = props.result.items.length > 0
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: title,
          numberOfItems: props.result.total,
          itemListElement: props.result.items.map((r, i) => ({
            '@type': 'ListItem',
            position: (props.result.page - 1) * props.result.pageSize + i + 1,
            name: r.title,
            url: `${origin}${recipePathFor(r.country, r.lang, r.slug)}`,
          })),
        },
      ]
    : [];
  const body = renderToString(<SearchPage {...props} />);
  return shell(body, {
    title,
    nav,
    lang,
    currentPath: '/search',
    initialQuery: q ?? '',
    cuisines: props.cuisines,
    alternates,
    jsonLd,
    noindex: props.result.total === 0 || props.result.page > props.result.totalPages,
    og: {
      type: 'website',
      title,
      description,
      url: canonicalUrl,
      locale: (HOME_SEO[lang] ?? HOME_SEO.en!).locale,
      alternateLocales: ['en_US', 'es_MX', 'fr_FR'].filter((l) => l !== (HOME_SEO[lang] ?? HOME_SEO.en!).locale),
      image: `${origin}/img/identity/after-hours.webp`,
      imageAlt: title,
    },
  });
}

export function renderHubPage(
  props: HubPageProps,
  opts: { canonicalPath: string; nav?: SiteNavItem[]; origin?: string; parentLabel?: string; parentPath?: string },
): string {
  const origin = opts.origin ?? 'https://2yolks.com';
  const lang = ['en', 'es', 'fr'].includes(props.lang) ? props.lang : 'en';
  const lq = lang === 'en' ? '' : `?lang=${lang}`;
  const title = `${props.title} - 2yolks`;
  const canonicalUrl = `${origin}${opts.canonicalPath}${lq}`;
  const ogImg = props.heroImage?.style === 'photo'
    ? `${origin}/img/recipe/${props.heroImage.id}`
    : `${origin}/img/identity/after-hours.webp`;
  const listLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: props.title,
    description: props.intro,
    url: canonicalUrl,
    ...(props.recipes.length > 0
      ? {
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: props.recipes.length,
            itemListElement: props.recipes.slice(0, 50).map((r, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: r.title,
              url: `${origin}${recipePathFor(r.country, r.lang, r.slug)}`,
            })),
          },
        }
      : {}),
  };
  const crumbs = [
    { '@type': 'ListItem', position: 1, name: uiStrings(lang).home, item: `${origin}/?lang=${lang}` },
    ...(opts.parentLabel && opts.parentPath
      ? [{ '@type': 'ListItem', position: 2, name: opts.parentLabel, item: `${origin}${opts.parentPath}${lq}` }]
      : []),
    { '@type': 'ListItem', position: opts.parentLabel && opts.parentPath ? 3 : 2, name: props.title, item: canonicalUrl },
  ];
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs };
  return shell(renderToString(<HubPage {...props} />), {
    title,
    nav: opts.nav,
    lang,
    currentPath: opts.canonicalPath,
    alternates: staticAlternates(origin, opts.canonicalPath),
    jsonLd: [listLd, breadcrumbLd],
    noindex: props.recipes.length === 0,
    og: {
      type: 'website',
      title,
      description: props.intro,
      url: canonicalUrl,
      locale: (HOME_SEO[lang] ?? HOME_SEO.en!).locale,
      alternateLocales: ['en_US', 'es_MX', 'fr_FR'].filter((l) => l !== (HOME_SEO[lang] ?? HOME_SEO.en!).locale),
      image: ogImg,
      imageAlt: props.title,
    },
  });
}

export function renderHubDirectoryPage(
  props: { kind: 'collections' | 'cuisine' | 'cooks'; lang: string; title: string; intro: string; items: HubDirectoryItem[] },
  opts: { canonicalPath: string; nav?: SiteNavItem[]; origin?: string },
): string {
  const origin = opts.origin ?? 'https://2yolks.com';
  const lang = ['en', 'es', 'fr'].includes(props.lang) ? props.lang : 'en';
  const lq = lang === 'en' ? '' : `?lang=${lang}`;
  const title = `${props.title} - 2yolks`;
  const canonicalUrl = `${origin}${opts.canonicalPath}${lq}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: props.title,
    description: props.intro,
    url: canonicalUrl,
  };
  return shell(renderToString(<HubDirectoryPage {...props} />), {
    title,
    nav: opts.nav,
    lang,
    currentPath: opts.canonicalPath,
    alternates: staticAlternates(origin, opts.canonicalPath),
    jsonLd,
    noindex: props.items.every((i) => i.count === 0),
    og: {
      type: 'website',
      title,
      description: props.intro,
      url: canonicalUrl,
      locale: (HOME_SEO[lang] ?? HOME_SEO.en!).locale,
      image: `${origin}/img/identity/after-hours.webp`,
      imageAlt: props.title,
    },
  });
}

export function renderSavedPage(
  props: { lang: string; signedIn: boolean; userEmail?: string | null; recipes: RecipeRow[]; savedIds: string[] },
  nav?: SiteNavItem[],
  _origin = 'https://2yolks.com',
): string {
  const lang = ['en', 'es', 'fr'].includes(props.lang) ? props.lang : 'en';
  const title = `${uiStrings(lang).savedNav} - 2yolks`;
  return shell(renderToString(<SavedPage {...props} />), {
    title,
    nav,
    lang,
    currentPath: '/saved',
    noindex: true,
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

/**
 * Generates a 1200x630 (1.91:1) landscape Open Graph / link-preview SVG card
 * for sharing across desktop, group chats, and social feeds.
 */
export function renderRecipeOgSvg(page: RecipePage, origin = 'https://2yolks.com'): string {
  const lang = page.locale.lang;
  const t = uiStrings(lang);
  const sys = defaultUnitSystem(page.locale.country);
  const entries = JSON.parse(page.locale.ingredientsJson) as IngredientEntry[];
  const steps = JSON.parse(page.locale.stepsJson) as string[];
  const cat = (categoryLabel(page.recipe.category, lang) ?? t.allRecipes).toUpperCase();
  const titleLines = wrapTextLines(page.locale.title, 22, 3);
  const introLines = page.locale.intro ? wrapTextLines(page.locale.intro, 44, 2) : [];
  const topIngredients = entries
    .slice(0, 5)
    .map((e) => renderIngredient(e, lang, sys, 1))
    .map((line) => (line.length > 30 ? `${line.slice(0, 28).trimEnd()}…` : line));
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
  const fullPath = `${canonicalHost}${canonicalPath}`;
  const shortUrl = fullPath.length > 48 ? `${fullPath.slice(0, 46)}…` : fullPath;

  const titleStartY = 238;
  const titleStepY = 58;
  const afterTitleY = titleStartY + titleLines.length * titleStepY + 14;
  const introStepY = 30;
  const catWidth = Math.min(600, Math.max(150, cat.length * 12 + 32));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeHtml(page.locale.title)} — 2yolks">
  <rect width="1200" height="630" fill="#211729" />
  <rect x="24" y="24" width="1152" height="582" fill="none" stroke="#65566e" stroke-width="2" />
  <rect x="24" y="24" width="1152" height="10" fill="#e0fa80" />

  <!-- Left Column: Brand + Title + Intro + Facts -->
  <g transform="translate(64, 72)">
    <text x="0" y="28" fill="#faf7f4" font-family="Fraunces, Georgia, 'Times New Roman', serif" font-size="38" font-weight="700" letter-spacing="-1">2yolks</text>
    <ellipse cx="144" cy="17" rx="14" ry="12.5" fill="#e0fa80" />
    <ellipse cx="171" cy="15" rx="12.5" ry="11.5" fill="#ffd166" />
    <rect x="378" y="-4" width="232" height="36" fill="#2e2038" stroke="#756580" stroke-width="1.5" />
    <text x="494" y="21" text-anchor="middle" fill="#e0fa80" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="16" font-weight="700">${escapeHtml(statusText)}</text>
  </g>

  <!-- Category Pill -->
  <g transform="translate(64, 134)">
    <rect x="0" y="0" width="${catWidth}" height="34" fill="#e0fa80" />
    <text x="16" y="23" fill="#211729" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="16" font-weight="800" letter-spacing="1.6">${escapeHtml(cat)}</text>
  </g>

  <!-- Recipe Title -->
  ${titleLines
    .map(
      (line, idx) =>
        `<text x="64" y="${titleStartY + idx * titleStepY}" fill="#faf7f4" font-family="Fraunces, Georgia, 'Times New Roman', serif" font-size="48" font-weight="700" letter-spacing="-1">${escapeHtml(line)}</text>`,
    )
    .join('\n  ')}

  <!-- Intro -->
  ${introLines
    .map(
      (line, idx) =>
        `<text x="64" y="${afterTitleY + idx * introStepY}" fill="#ded5e4" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="21" font-weight="400">${escapeHtml(line)}</text>`,
    )
    .join('\n  ')}

  <!-- Bottom Facts + URL -->
  <g transform="translate(64, 514)">
    <line x1="0" y1="0" x2="610" y2="0" stroke="#65566e" stroke-width="1.5" />
    <text x="0" y="34" fill="#e0fa80" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="19" font-weight="700">${escapeHtml(badges.join('  ·  '))}</text>
    <text x="0" y="64" fill="#cbb8d2" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="17" font-weight="500">${escapeHtml(shortUrl)}</text>
  </g>

  <!-- Right Column: Cream Ingredients Card -->
  <g transform="translate(720, 68)">
    <rect x="0" y="0" width="416" height="494" fill="#faf8f3" />
    <rect x="0" y="0" width="416" height="8" fill="#e0fa80" />
    <text x="28" y="54" fill="#211729" font-family="Fraunces, Georgia, 'Times New Roman', serif" font-size="30" font-weight="700">${escapeHtml(t.ingredients)}</text>
    ${topIngredients
      .map(
        (ing, idx) => `<g transform="translate(28, ${102 + idx * 62})">
      <rect x="0" y="-18" width="20" height="20" fill="none" stroke="#493253" stroke-width="2" />
      <text x="34" y="-1" fill="#261b2c" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="21" font-weight="500">${escapeHtml(ing)}</text>
    </g>`,
      )
      .join('\n    ')}
    ${moreCount > 0
      ? `<text x="28" y="${104 + topIngredients.length * 62}" fill="#64586a" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="19" font-style="italic">+ ${moreCount} ${escapeHtml(lang === 'es' ? 'ingredientes más' : lang === 'fr' ? 'autres ingrédients' : 'more ingredients')}</text>`
      : ''}
    <text x="388" y="472" text-anchor="end" fill="#493253" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="15" font-weight="700">#CookedWith2Yolks</text>
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
    const lq = page.locale.lang === 'en' ? '' : `?lang=${page.locale.lang}`;
    crumbElements.push({
      '@type': 'ListItem',
      position: 2,
      name: cat,
      item: `${origin}/recipes/${page.recipe.category}${lq}`,
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
  // Universal raster fallback for Open Graph / iMessage / WhatsApp / Slack when no photo or pin exists.
  // Kept separate from <RecipeView imageUrl> so Pinterest sharing continues to require an explicit recipe image.
  const ogImageUrl = imageUrl ?? (canonicalUrl ? `${origin}/img/identity/og-default.png` : null);
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
  const recipePath = recipePathFor(page.locale.country, page.locale.lang, page.locale.slug);
  const recipeMeta = safeJsonLd({
    id: page.recipe.id,
    title: page.locale.title,
    href: recipePath,
    cat: cat ?? null,
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
    `<script type="application/json" id="recipe-meta-data">${recipeMeta}</script>` +
    `<script>${RECIPE_CLIENT_SCRIPT}</script>`;
  return shell(body, {
    title: `${page.locale.title} - 2yolks`,
    alternates,
    jsonLd: canonicalUrl ? [recipeLd, breadcrumbLd] : recipeLd,
    nav: opts.nav,
    lang: page.locale.lang,
    currentPath: recipePath,
    og: canonicalUrl
      ? {
          type: 'article',
          title: page.locale.title,
          description: page.locale.intro ?? undefined,
          url: canonicalUrl,
          locale: `${page.locale.lang}_${page.locale.country.toUpperCase()}`,
          alternateLocales,
          image: ogImageUrl,
          imageWidth: imageUrl ? undefined : 1200,
          imageHeight: imageUrl ? undefined : 630,
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
.acct ul.mine > li { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.85rem 1rem; align-items: flex-start; padding: 0.85rem 0; border-bottom: 1px solid var(--line); }
.acct .mine-main { flex: 1 1 18rem; min-width: 0; display: grid; gap: 0.45rem; }
.acct .mine-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.acct .mine-actions .actions { margin: 0; }
.acct .badge { display: inline-block; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: var(--muted); border: 1px solid var(--line-strong); padding: 0.14rem 0.48rem; vertical-align: middle; margin-left: 0.35rem; }
.acct .badge--review { border-color: var(--plum); color: var(--plum); }
.acct .badge--changes { border-color: #9a6700; color: #7a4f00; background: #fff8e1; }
.acct .badge--declined { border-color: #b3261e; color: #8c1d18; background: #fdecea; }
.acct .badge--live { border-color: #2e7d32; color: #1b431e; background: #edf7ee; }
.acct .status-timeline { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.35rem 0.65rem; font-size: 0.8rem; }
.acct .status-step { display: inline-flex; align-items: center; gap: 0.3rem; color: var(--muted); }
.acct .status-step::before { content: '○'; font-size: 0.72rem; }
.acct .status-step.is-done { color: #2e7d32; font-weight: 600; }
.acct .status-step.is-done::before { content: '●'; }
.acct .status-step.is-current { color: var(--ink); font-weight: 700; }
.acct .status-step.is-current::before { content: '◉'; }
.acct .status-step.is-attention { color: #9a6700; font-weight: 700; }
.acct .status-step.is-attention::before { content: '▲'; }
.acct .status-step.is-declined { color: #b3261e; font-weight: 700; }
.acct .status-step.is-declined::before { content: '×'; }
.acct .review-note { margin: 0; padding: 0.5rem 0.75rem; border-left: 3px solid #9a6700; background: #fff8e1; color: #4a3000; font-size: 0.88rem; }
.acct .review-note--declined { border-left-color: #b3261e; background: #fdecea; color: #410e0b; }
.acct .review-callout { border-left: 4px solid #9a6700; background: #fff8e1; color: #4a3000; padding: 0.75rem 1rem; margin: 0 0 1rem; display: grid; gap: 0.25rem; }
.acct .review-callout p { margin: 0; font-size: 0.92rem; }
html[data-theme="dark"] .acct .badge--review { border-color: var(--lime); color: var(--lime); }
html[data-theme="dark"] .acct .badge--changes, html[data-theme="dark"] .acct .review-note, html[data-theme="dark"] .acct .review-callout { border-color: #ffd166; background: #332710; color: #ffe7a3; }
html[data-theme="dark"] .acct .badge--declined, html[data-theme="dark"] .acct .review-note--declined { border-color: #ffb4ab; background: #3d1816; color: #ffd9d4; }
html[data-theme="dark"] .acct .badge--live { border-color: var(--lime); background: #1e2d1b; color: var(--lime); }
html[data-theme="dark"] .acct .status-step.is-done { color: var(--lime); }
html[data-theme="dark"] .acct .status-step.is-attention { color: #ffd166; }
html[data-theme="dark"] .acct .status-step.is-declined { color: #ffb4ab; }
.acct .field-err { margin: -0.55rem 0 0; color: #b3261e; font-size: 0.88rem; font-weight: 600; }
.acct [aria-invalid="true"] { border-color: #b3261e; outline: 1px solid #b3261e; }
.acct .err a { color: inherit; }
html[data-theme="dark"] .acct .field-err { color: #ffb4ab; }
html[data-theme="dark"] .acct [aria-invalid="true"] { border-color: #ffb4ab; outline-color: #ffb4ab; }
.acct .finish { display: grid; gap: 0.8rem; border-left: 5px solid var(--plum); }
.acct .finish h2, .acct .finish p { margin: 0; }
.acct .finish-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
.acct .draft-notice { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
.acct .draft-notice button { padding: 0.3rem 0.8rem; }
.acct.acct-capture { max-width: 72rem; }
.acct .capture-shell { display: grid; gap: 1.75rem; align-items: start; }
.acct .capture-main { min-width: 0; }
.acct .start-section { margin: 0 0 1.25rem; }
.acct .start-heading { font-weight: 700; margin: 0 0 0.6rem; font-size: 0.95rem; }
.acct .start-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem; }
.acct .start-tile { display: grid; gap: 0.25rem; text-align: left; align-content: start; padding: 0.85rem 0.95rem; background: var(--card); color: var(--ink); border: 1px solid var(--line-strong); font-weight: 400; width: 100%; }
.acct .start-tile strong { font-weight: 750; font-size: 0.95rem; }
.acct .start-tile span { font-size: 0.82rem; color: var(--muted); line-height: 1.35; }
.acct .start-tile[aria-pressed="true"] { border-color: var(--plum); border-width: 2px; background: #f4f7e4; }
html[data-theme="dark"] .acct .start-tile { background: var(--card); color: var(--ink); border-color: var(--line-strong); }
html[data-theme="dark"] .acct .start-tile[aria-pressed="true"] { border-color: var(--lime); background: #2c2435; }
.acct .step-index { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 1rem; padding: 0.55rem 0; border-bottom: 1px solid var(--line); }
.acct .step-index a { font-size: 0.82rem; font-weight: 650; text-decoration: none; color: var(--ink); border: 1px solid var(--line); padding: 0.28rem 0.6rem; background: var(--card); }
.acct .step-index a:hover, .acct .step-index a[aria-current="step"] { border-color: var(--plum); background: var(--plum); color: var(--lime); }
html[data-theme="dark"] .acct .step-index a:hover, html[data-theme="dark"] .acct .step-index a[aria-current="step"] { border-color: var(--lime); background: var(--lime); color: var(--plum); }
.acct .stepper-bar { display: flex; align-items: center; gap: 0.75rem; margin: 0 0 1rem; padding: 0.65rem 0.85rem; border: 1px solid var(--line); background: var(--card); }
.acct .stepper-bar[hidden] { display: none; }
.acct .stepper-progress-text { font-size: 0.84rem; font-weight: 700; white-space: nowrap; }
.acct .stepper-track { flex: 1; height: 6px; background: var(--line); overflow: hidden; }
.acct .stepper-fill { height: 100%; background: var(--plum); width: 20%; transition: width 0.18s ease; }
html[data-theme="dark"] .acct .stepper-fill { background: var(--lime); }
.acct .stepper-preview-btn { padding: 0.35rem 0.75rem; font-size: 0.84rem; }
.acct fieldset.form-step { border: 0; margin: 0; padding: 0; display: grid; gap: 0.9rem; min-width: 0; }
.acct legend.step-heading { font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; padding: 0.4rem 0 0.2rem; margin: 0 0 0.25rem; border-bottom: 1px solid var(--line); width: 100%; }
.acct legend.step-heading:focus { outline: none; }
.acct .step-nav { display: none; gap: 0.6rem; flex-wrap: wrap; align-items: center; margin-top: 0.35rem; }
.acct .step-msg { flex-basis: 100%; font-size: 0.88rem; font-weight: 600; color: #9a6700; }
html[data-theme="dark"] .acct .step-msg { color: #ffd166; }
.acct .capture-stepper-on .step-index { display: none; }
.acct .capture-stepper-on fieldset.form-step { display: none; }
.acct .capture-stepper-on fieldset.form-step.is-active { display: grid; }
.acct .capture-stepper-on .step-nav { display: flex; }
.acct .inline-auth { border-left: 5px solid var(--lime); display: grid; gap: 0.75rem; margin-top: 0.5rem; }
.acct .inline-auth[hidden] { display: none; }
.acct .inline-auth-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
.acct .capture-preview-col { border: 1px solid var(--line); background: var(--card); padding: 1.15rem 1.25rem; }
.acct .capture-preview-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.75rem; }
.acct .capture-preview-head h2 { margin: 0; font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.acct .preview-card { display: grid; gap: 0.65rem; }
.acct .preview-badge { justify-self: start; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; padding: 0.16rem 0.5rem; background: var(--plum); color: var(--lime); }
html[data-theme="dark"] .acct .preview-badge { background: var(--lime); color: var(--plum); }
.acct .preview-photo { width: 100%; aspect-ratio: 4/3; object-fit: cover; border: 1px solid var(--line); display: block; }
.acct .preview-photo[hidden] { display: none; }
.acct .preview-eyebrow { margin: 0; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: var(--muted); }
.acct .preview-title { margin: 0; font-family: var(--font-display); font-size: 1.45rem; line-height: 1.15; }
.acct .preview-facts { display: flex; flex-wrap: wrap; gap: 0.4rem; font-size: 0.8rem; }
.acct .preview-facts span { border: 1px solid var(--line); padding: 0.16rem 0.45rem; color: var(--muted); font-weight: 600; }
.acct .preview-intro { margin: 0; font-size: 0.92rem; line-height: 1.5; color: var(--muted); }
.acct .preview-card h4 { margin: 0.35rem 0 0.25rem; font-size: 0.88rem; text-transform: uppercase; letter-spacing: 0.05em; }
.acct .preview-ing, .acct .preview-steps { margin: 0; padding-left: 1.15rem; font-size: 0.88rem; line-height: 1.45; display: grid; gap: 0.2rem; }
.acct .paste-actions { display: flex; flex-wrap: wrap; gap: 0.55rem; align-items: center; }
.acct .preview-back-btn { padding: 0.3rem 0.75rem; font-size: 0.82rem; }
.acct .draft-photo-field { display: grid; gap: 0.5rem; }
.acct .draft-photo-preview { width: 160px; max-width: 100%; aspect-ratio: 4/3; object-fit: cover; border: 1px solid var(--line-strong); display: block; }
.acct .draft-photo-actions { display: flex; flex-wrap: wrap; gap: 0.55rem; align-items: center; }
.acct [hidden] { display: none !important; }
@media (min-width: 721px) {
  .acct .capture-shell { grid-template-columns: minmax(0, 1fr) 300px; }
  .acct .capture-preview-col { position: sticky; top: 4.75rem; max-height: calc(100vh - 6rem); overflow-y: auto; }
}
@media (min-width: 980px) {
  .acct .capture-shell { grid-template-columns: minmax(0, 1fr) 340px; }
}
@media (max-width: 720px) {
  .acct .capture-preview-col { display: none; }
  .acct .capture-preview-mobile .capture-preview-col { display: block; }
  .acct .capture-preview-mobile form[data-capture-form],
  .acct .capture-preview-mobile .start-section,
  .acct .capture-preview-mobile [data-mode-panel] { display: none; }
}
@media (max-width: 640px) {
  .acct .row { grid-template-columns: minmax(0, 1fr); }
  .acct .start-tiles { grid-template-columns: minmax(0, 1fr); }
  .acct { margin: 1rem 0.5rem; padding: 1.25rem 0.85rem 1.75rem; }
}
.acct .field-head-row { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.4rem 0.75rem; margin-bottom: 0.2rem; }
.acct .line-counter { font-size: 0.78rem; font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; padding: 0.1rem 0.45rem; border: 1px solid var(--line); background: var(--card); }
.acct .line-counter.is-over { color: #b3261e; border-color: #b3261e; background: #fdecea; }
html[data-theme="dark"] .acct .line-counter.is-over { color: #ffb4ab; border-color: #ffb4ab; background: #3d1816; }
.acct .builder-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.4rem 0.65rem; margin: 0.35rem 0 0.55rem; }
.acct .builder-mode-tabs { display: inline-flex; border: 1px solid var(--line-strong); }
.acct .builder-mode-tabs button { padding: 0.25rem 0.65rem; font-size: 0.8rem; border: 0; background: var(--card); color: var(--ink); font-weight: 600; }
.acct .builder-mode-tabs button + button { border-left: 1px solid var(--line-strong); }
.acct .builder-mode-tabs button[aria-pressed="true"] { background: var(--plum); color: var(--lime); }
html[data-theme="dark"] .acct .builder-mode-tabs button[aria-pressed="true"] { background: var(--lime); color: var(--plum); }
.acct .builder-rows-wrap { display: none; gap: 0.45rem; margin-bottom: 0.5rem; }
.acct .ing-builder.is-enhanced:not(.is-raw) .builder-rows-wrap { display: grid; }
.acct .step-builder.is-enhanced:not(.is-raw) .builder-rows-wrap { display: grid; }
.acct .ing-builder:not(.is-enhanced) .builder-toolbar,
.acct .step-builder:not(.is-enhanced) .builder-toolbar { display: none; }
.acct .ing-builder.is-enhanced:not(.is-raw) #f-ingredients,
.acct .step-builder.is-enhanced:not(.is-raw) #f-steps {
  position: absolute; width: 1px; height: 1px; min-height: 0; padding: 0; margin: -1px; overflow: hidden; opacity: 0; pointer-events: none;
}
.acct .ing-row-item { display: grid; grid-template-columns: 4.5rem 5.5rem minmax(0, 1fr) auto; gap: 0.35rem; align-items: center; }
.acct .ing-section-row { grid-template-columns: minmax(0, 1fr) auto; }
.acct .ing-chip-section { font-weight: 700; border-left: 3px solid var(--plum); }
.acct .builder-row-actions { display: inline-flex; gap: 0.22rem; align-items: center; }
.acct .builder-icon-btn { padding: 0.28rem 0.5rem; min-width: 2rem; min-height: 36px; justify-content: center; font-size: 0.85rem; }
.acct .builder-add-actions { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.acct .builder-add-actions button { padding: 0.38rem 0.85rem; font-size: 0.84rem; }
.acct .step-card-item { border: 1px solid var(--line); background: var(--card); padding: 0.7rem 0.8rem; display: grid; gap: 0.45rem; }
.acct .step-card-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.acct .step-card-num { font-family: var(--font-display); font-weight: 750; font-size: 0.85rem; background: var(--plum); color: var(--lime); padding: 0.12rem 0.48rem; }
html[data-theme="dark"] .acct .step-card-num { background: var(--lime); color: var(--plum); }
.acct .step-card-text { min-height: 3.4rem; }
.acct .step-card-timer { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; font-weight: 600; color: var(--muted); }
.acct .step-card-timer input { width: 5.5rem; padding: 0.35rem 0.5rem; }
.acct .live-celebration { border: 1px solid #2e7d32; border-left: 4px solid #2e7d32; background: #edf7ee; color: #1b431e; padding: 0.65rem 0.85rem; display: grid; gap: 0.4rem; }
.acct .live-celebration span { font-size: 0.88rem; }
.acct .live-celebration-actions { display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center; }
.acct .live-celebration-actions button, .acct .live-celebration-actions a.btn-quiet { padding: 0.32rem 0.7rem; font-size: 0.82rem; border: 1px solid var(--line-strong); background: var(--card); color: var(--ink); font-weight: 650; text-decoration: none; display: inline-flex; align-items: center; }
.acct .live-celebration-actions a.btn-quiet:hover { border-color: var(--plum); }
html[data-theme="dark"] .acct .live-celebration { border-color: var(--lime); background: #1e2d1b; color: #f7f3fa; }
.acct .gap-prompts { border-left: 5px solid var(--yolk-gold); display: grid; gap: 0.55rem; }
.acct .gap-prompts h2 { margin: 0; font-size: 1.05rem; }
.acct .gap-chip-row { display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center; }
.acct .gap-chip-row button.gap-chip { padding: 0.38rem 0.8rem; font-size: 0.86rem; background: var(--plum); color: var(--lime); border: 1px solid var(--plum); }
.acct .gap-chip-row button.gap-chip.quiet { background: var(--card); color: var(--ink); border-color: var(--line-strong); }
.acct .remix-banner { border-left-color: var(--plum); }
.acct .alt-auth { display: grid; gap: 0.6rem; margin-bottom: 1.15rem; }
.acct .alt-auth[hidden] { display: none; }
.acct .alt-auth-actions { display: flex; flex-wrap: wrap; gap: 0.55rem; align-items: center; }
.acct .btn-google, .acct .btn-passkey { display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; font-weight: 650; }
.acct a.btn-google { padding: 0.55rem 1.05rem; border: 1px solid var(--line-strong); background: var(--card); color: var(--ink); text-decoration: none; min-height: 44px; }
.acct a.btn-google:hover { border-color: var(--plum); }
.acct .auth-divider { display: flex; align-items: center; gap: 0.75rem; margin: 0.9rem 0; color: var(--muted); font-size: 0.84rem; text-transform: uppercase; letter-spacing: 0.06em; }
.acct .auth-divider::before, .acct .auth-divider::after { content: ""; flex: 1 1 0; height: 1px; background: var(--line); }
.acct ul.passkey-list li { align-items: center; }
.acct button.danger { border-color: #a42325; color: #8b1a1c; }
.acct button.danger:hover { background: #a42325; color: #fff; border-color: #a42325; }
html[data-theme="dark"] .acct button.danger { border-color: #f87171; color: #fca5a5; }
html[data-theme="dark"] .acct button.danger:hover { background: #dc2626; color: #fff; border-color: #dc2626; }
@media (max-width: 640px) {
  .acct .ing-row-item { grid-template-columns: 4rem 4.8rem minmax(0, 1fr); }
  .acct .ing-row-item .builder-row-actions { grid-column: 1 / -1; justify-self: end; }
  .acct .ing-section-row { grid-template-columns: minmax(0, 1fr); }
}
`;

/** Private, never-indexed page in the After hours shell (account + submissions).
 * The account UI is localized en/es/fr: `lang` sets the document language and
 * the header/footer chrome, `path` is the current request path used to build
 * the language-switch links (query string replaced, lang preserved). */
export function renderAccountPage(
  title: string,
  bodyHtml: string,
  lang = 'en',
  path = '/account',
  next: string | null = null,
  opts?: { wide?: boolean },
): string {
  const nextAmp = next ? `&next=${encodeURIComponent(next)}` : '';
  const nav = ['en', 'es', 'fr'].map((l) => ({ href: `${path}?lang=${l}${nextAmp}`, label: l === 'en' ? 'English' : l === 'es' ? 'Español' : 'Français', current: l === lang }));
  return shell(`<style>${ACCOUNT_CSS}</style><main id="main" class="acct${opts?.wide ? ' acct-capture' : ''}">${bodyHtml}</main>`, { title: `${title} - 2yolks`, noindex: true, lang, nav, currentPath: path });
}

export { CAPTURE_CLIENT_SCRIPT, CAPTURE_HELPERS_JS, CAPTURE_CHECK_STRINGS, DRAFT_PHOTO_CLIENT_SCRIPT, GLOBAL_CHROME_SCRIPT, DESIGN_SYSTEM_CSS, THEME_CLIENT_SCRIPT, RECIPE_CLIENT_SCRIPT, DISCOVERY_CLIENT_SCRIPT, ACCOUNT_LIVE_SHARE_SCRIPT, PASSKEY_CLIENT_SCRIPT };
