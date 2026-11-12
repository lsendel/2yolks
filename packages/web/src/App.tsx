import type { RecipePage } from '@2yolks/contracts';
import type { IngredientEntry } from '@2yolks/contracts';
import {
  SCALE_MULTIPLIERS,
  defaultUnitSystem,
  renderIngredient,
  renderStep,
  ingredientVariants,
  stepVariants,
  isConvertible,
  hasStepTokens,
  recipePathFor,
  uiStrings,
  parseIngredient,
  scalingIsSafe,
  isUntested,
  defaultLocale,
  categoryLabel,
  asImageStyle,
  localizedCountryName,
} from '@2yolks/contracts';
import {
  TwinYolkLogoMark,
  ArrowUpRightIcon,
  CategoryIcon,
  FactIcon,
  SocialIcon,
  EmptySkilletIllustration,
} from './icons';

export { FactIcon };

// ---------------------------------------------------------------------------
// Site chrome
// ---------------------------------------------------------------------------

export interface SiteNavItem {
  href: string;
  label: string;
  current?: boolean;
}

/** Official 2yolks social channels — update handles in one place. */
export const SOCIAL_LINKS = [
  { name: 'instagram', label: '2yolks Instagram', href: 'https://www.instagram.com/2yolks' },
  { name: 'tiktok', label: '2yolks TikTok', href: 'https://www.tiktok.com/@2yolks' },
  { name: 'youtube', label: '2yolks YouTube', href: 'https://www.youtube.com/@2yolks' },
] as const;

/** Two-yolk egg mark. Pure SVG, no image asset, scales from favicon to hero. */
export function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <svg
      className={large ? 'brand-mark hero-egg' : 'brand-mark'}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M24 2.5C15 2.5 5.5 14.5 5.5 26.5 5.5 37 13.5 45.5 24 45.5S42.5 37 42.5 26.5C42.5 14.5 33 2.5 24 2.5Z"
        fill="#ffffff"
        stroke="#e7e5e4"
        strokeWidth="1.5"
      />
      <circle cx="18.5" cy="28.5" r="7.5" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
      <circle cx="31" cy="25.5" r="6" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
      <circle cx="16" cy="26" r="2" fill="#fde68a" />
      <circle cx="29" cy="23.5" r="1.6" fill="#fef3c7" />
    </svg>
  );
}

const langQuery = (lang: string) => (lang === 'en' ? '' : `?lang=${lang}`);

export function SiteHeader({ nav = [], lang = 'en' }: { nav?: SiteNavItem[]; lang?: string }) {
  const t = uiStrings(lang);
  const lq = langQuery(lang);
  return (
    <header className="site-header">
      <a className="skip" href="#main">{t.skipToContent}</a>
      <div className="header-inner">
        <a className="brand" href={`/?lang=${lang}`}>
          <span className="brand-word">2yolks</span>
          <TwinYolkLogoMark />
        </a>
        <nav className="site-nav" aria-label={lang === 'es' ? 'Recetas' : lang === 'fr' ? 'Recettes' : 'Recipes'}>
          <a href={`/recipes${lq}`}>{t.allRecipes}</a>
          <a href={`/how-we-test${lq}`}>{t.testingShort}</a>
          <a href={`/account${lq}`}>{t.myKitchenNav}</a>
          <a className="nav-share-cta" href={`/account/recipes/new${lq}`}>
            <SocialIcon name="plus" />
            {t.shareRecipeNav}
          </a>
        </nav>
        <div className="header-tools">
          <nav className="language-nav" aria-label="Language">
            {nav.map((item) => (
              <a key={item.href} href={item.href} aria-current={item.current ? 'page' : undefined}>
                {item.label}
              </a>
            ))}
          </nav>
          <button
            type="button"
            className="theme-toggle"
            data-theme-toggle
            aria-label={t.themeToggle}
            title={t.themeToggle}
          >
            <SocialIcon name="moon" className="social-icon icon-moon" />
            <SocialIcon name="sun" className="social-icon icon-sun" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ nav = [], lang = 'en' }: { nav?: SiteNavItem[]; lang?: string }) {
  const t = uiStrings(lang);
  const lq = langQuery(lang);
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <a className="brand" href={`/?lang=${lang}`}>
            <span className="brand-word">2yolks</span>
            <TwinYolkLogoMark />
          </a>
          <p className="footer-note">
            {lang === 'es'
              ? 'Una cocina pequeña. Un gran apetito.'
              : lang === 'fr'
                ? 'Petite cuisine. Grand appétit.'
                : 'Small kitchen. Big appetite.'}
          </p>
          <p className="community-tag">{t.communityTag}</p>
          <div className="footer-social" aria-label="Social">
            {SOCIAL_LINKS.map((s) => (
              <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                <SocialIcon name={s.name} />
              </a>
            ))}
          </div>
        </div>
        <nav className="footer-col" aria-label="Language">
          {nav.map((item) => (
            <a key={item.href} href={item.href}>{item.label}</a>
          ))}
        </nav>
        <nav className="footer-col" aria-label="Kitchen">
          <a href={`/recipes${lq}`}>{t.allRecipes}</a>
          <a href={`/account/recipes/new${lq}`}>{t.shareRecipeNav}</a>
          <a href={`/account${lq}`}>{t.myKitchenNav}</a>
        </nav>
        <nav className="footer-col" aria-label="2yolks">
          <a href={`/about${lq}`}>{t.about}</a>
          <a href={`/how-we-test${lq}`}>{t.testingShort}</a>
          <a href={`/privacy${lq}`}>{lang === 'es' ? 'Privacidad' : lang === 'fr' ? 'Confidentialité' : 'Privacy'}</a>
        </nav>
      </div>
      <p className="footer-fine">
        {lang === 'es'
          ? 'Solo marcamos una receta como probada después de cocinarla.'
          : lang === 'fr'
            ? 'Une recette est testée seulement après avoir été cuisinée.'
            : 'A recipe is marked tested only after it has been cooked.'}
      </p>
    </footer>
  );
}

export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs-nav">
      <ol className="crumbs">
        {items.map((it, i) => (
          <li key={i}>
            {it.href ? <a href={it.href}>{it.label}</a> : <span aria-current="page">{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Recipe cards and grouping
// ---------------------------------------------------------------------------

export interface RecipeRow {
  id: string;
  slug: string;
  title: string;
  country: string;
  lang: string;
  untested?: boolean;
  /** CATEGORIES slug; undefined until the additive column ships. */
  category?: string | null;
  totalMinutes?: number | null;
  /** Latest rights-cleared hero image row id (migration 0004); NULL = text-only row. */
  imageId?: string | null;
  /** Honest-imagery style of that image: real dish photo vs labeled AI illustration vs graphic. */
  imageStyle?: 'photo' | 'illustration' | 'graphic' | null;
  intro?: string | null;
  ingredients?: string | null;
}

interface RecipeGroup {
  primary: RecipeRow;
  others: RecipeRow[];
}

/** One card per recipe: the country's default-locale row is the card, other
 * published locales become language chips. Ends the per-locale duplicate list. */
export function groupRecipes(rows: RecipeRow[], country: string): RecipeGroup[] {
  const def = defaultLocale(country);
  const byId = new Map<string, RecipeRow[]>();
  for (const r of rows) {
    if (r.country !== country) continue;
    const list = byId.get(r.id) ?? [];
    list.push(r);
    byId.set(r.id, list);
  }
  const groups: RecipeGroup[] = [];
  for (const list of byId.values()) {
    const primary = list.find((r) => r.lang === def) ?? list[0]!;
    const others = list.filter((r) => r !== primary).sort((a, b) => a.lang.localeCompare(b.lang));
    groups.push({ primary, others });
  }
  return groups.sort((a, b) => a.primary.title.localeCompare(b.primary.title));
}

const LANG_NAMES: Record<string, string> = { en: 'English', es: 'Español', fr: 'Français' };

export function RecipeCard({
  group,
  country,
  countryName,
  pageLang,
  showCountry,
}: {
  group: RecipeGroup;
  country: string;
  countryName?: string;
  pageLang: string;
  showCountry?: boolean;
}) {
  const t = uiStrings(pageLang);
  const { primary, others } = group;
  const cat = categoryLabel(primary.category, pageLang);
  return (
    <li className="recipe-card">
      <h3>
        <a className="stretched" href={recipePathFor(country, primary.lang, primary.slug)}>
          {primary.title}
        </a>
      </h3>
      <p className="meta">
        {showCountry && countryName ? (
          <span className="meta-country">
            <span className="yolk-dot" aria-hidden="true" />
            {countryName}
          </span>
        ) : null}
        {cat ? <span className="meta-cat">{cat}</span> : null}
        {primary.untested ? <span className="badge">{t.untestedBadge}</span> : <span className="tested-badge"><FactIcon kind="check" />{t.testedBadge}</span>}
      </p>
      {others.length > 0 ? (
        <p className="chips">
          {others.map((o) => (
            <a key={o.lang} className="chip" hrefLang={o.lang} href={recipePathFor(country, o.lang, o.slug)}>
              {LANG_NAMES[o.lang] ?? o.lang}
            </a>
          ))}
        </p>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export interface HomeProps {
  locales: { country: string; countryName: string; lang: string }[];
  recipes: RecipeRow[];
  lang?: string;
  activeCategory?: string | null;
  currentCountry?: string | null;
}

const DISCOVERY: Record<string, { eyebrow: string; title: string; intro: string; cta: string; index: string; all: string; note: string; illustration: string; total: string; empty: string; noExact: string; nothingMatches: string; didYouMean: string; clearSearch: string }> = {
  en: { eyebrow: 'RECIPES WITHOUT BORDERS', title: 'Small kitchen. Big appetite.', intro: 'Find something worth cooking. Recipes to read, make and share.', cta: "What's cooking?", index: 'Find your flavor', all: 'All recipes', note: 'Every recipe, honestly labeled.', illustration: 'AI-generated ingredient illustration, not a dish photograph', total: 'Total', empty: 'No recipes in this filter yet.', noExact: 'No exact match — closest matches:', nothingMatches: "Nothing matches '{q}' yet", didYouMean: 'Did you mean:', clearSearch: 'Clear search' },
  es: { eyebrow: 'RECETAS SIN FRONTERAS', title: 'Cocina pequeña. Gran apetito.', intro: 'Encuentra algo que quieras cocinar. Recetas para leer, preparar y compartir.', cta: '¿Qué cocinamos?', index: 'Encuentra tu sabor', all: 'Todas las recetas', note: 'Cada receta, con su estado real.', illustration: 'Ilustración de ingredientes generada por IA, no es una foto del plato', total: 'Total', empty: 'Aún no hay recetas en este filtro.', noExact: 'Sin coincidencias exactas — resultados más cercanos:', nothingMatches: "Aún no hay coincidencias para '{q}'", didYouMean: 'Quizás quisiste decir:', clearSearch: 'Borrar búsqueda' },
  fr: { eyebrow: 'RECETTES SANS FRONTIÈRES', title: 'Petite cuisine. Grand appétit.', intro: 'Trouvez une recette à cuisiner. Des recettes à lire, préparer et partager.', cta: 'On cuisine quoi ?', index: 'Trouvez votre saveur', all: 'Toutes les recettes', note: 'Chaque recette, avec son statut réel.', illustration: 'Illustration d’ingrédients générée par IA, pas une photo du plat', total: 'Total', empty: 'Aucune recette dans ce filtre.', noExact: 'Aucune correspondance exacte — résultats les plus proches :', nothingMatches: "Aucune correspondance pour « {q} » pour l'instant", didYouMean: 'Vouliez-vous dire :', clearSearch: 'Effacer la recherche' },
};

export function discoveryRecipes(rows: RecipeRow[], lang: string): RecipeRow[] {
  const groups = new Map<string, RecipeRow[]>();
  for (const row of rows) groups.set(row.id, [...(groups.get(row.id) ?? []), row]);
  return [...groups.values()]
    .map((list) => list.find((r) => r.lang === lang) ?? list.find((r) => r.lang === 'en') ?? list[0]!)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function RecipeIndex({ recipes, lang = 'en' }: { recipes: RecipeRow[]; lang?: string }) {
  const d = DISCOVERY[lang] ?? DISCOVERY.en!;
  const t = uiStrings(lang);
  const selected = discoveryRecipes(recipes, lang);
  const groups = new Map<string, RecipeRow[]>();
  for (const r of selected) groups.set(r.category ?? '', [...(groups.get(r.category ?? '') ?? []), r]);
  const categories = [...groups.keys()].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return (categoryLabel(a, lang) ?? a).localeCompare(categoryLabel(b, lang) ?? b);
  });
  const time = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ' ' + (n % 60) + ' min' : ''}` : `${n} min`);
  return (
    <main className="wide discovery" id="main">
      <section className="discovery-index">
        <div className="index-heading">
          <h1>{d.all}</h1>
          <p>{d.note}</p>
        </div>
        {categories.map((cat) => (
          <section key={cat || 'uncategorized'} className="index-category">
            <h2>{cat ? (categoryLabel(cat, lang) ?? cat) : d.all}</h2>
            <ul className="discovery-list">
              {(groups.get(cat) ?? []).map((r) => (
                <li key={r.id} data-recipe-item>
                  <div>
                    <h3>
                      <a className="stretched-row" href={recipePathFor(r.country, r.lang, r.slug)}>{r.title}</a>
                    </h3>
                    <div className="row-badges">
                      {r.untested ? (
                        <span className="status-label">{t.untestedBadge}</span>
                      ) : (
                        <span className="tested-badge"><FactIcon kind="check" />{t.testedBadge}</span>
                      )}
                      {r.lang !== lang ? <span className="fallback-language">{LANG_NAMES[r.lang]}</span> : null}
                    </div>
                  </div>
                  <div className="row-end">
                    {r.totalMinutes != null ? <span className="icon-stat"><FactIcon />{time(r.totalMinutes)}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
    </main>
  );
}

export function Home({ recipes, lang = 'en', activeCategory = null, currentCountry = null }: HomeProps) {
  const d = DISCOVERY[lang] ?? DISCOVERY.en!;
  const selected = discoveryRecipes(recipes, lang);
  const t = uiStrings(lang);
  const lq = langQuery(lang);
  const counts = new Map<string, number>();
  for (const r of selected) {
    if (r.category && categoryLabel(r.category, lang)) {
      counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    }
  }
  const categories = [...counts.keys()].sort((a, b) => {
    const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
  const filtered = activeCategory ? selected.filter((r) => r.category === activeCategory) : selected;
  const featured = selected.find((r) => r.id === 'w1pozole') ?? selected[0];
  const href = (r: RecipeRow) => recipePathFor(r.country, r.lang, r.slug);
  const time = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ' ' + (n % 60) + ' min' : ''}` : `${n} min`);
  return (
    <main className="wide discovery" id="main">
      <section className="after-hero">
        <div className="after-copy">
          <span className="eyebrow">{d.eyebrow}</span>
          <h1>{d.title}</h1>
          <p>{d.intro}</p>
          <div className="hero-cta-row">
            <a className="discovery-cta" href="#recipes">
              {d.cta}
              <ArrowUpRightIcon />
            </a>
            <a className="discovery-cta-secondary" href={`/account/recipes/new${lq}`}>
              <SocialIcon name="plus" />
              {t.shareRecipeNav}
            </a>
          </div>
        </div>
        <figure className="identity-art">
          <img src="/img/identity/after-hours.webp" alt="" width="900" height="900" fetchPriority="high" />
          <figcaption>{d.illustration}</figcaption>
        </figure>
      </section>
      {featured ? (
        <section className="featured-recipe">
          <div>
            <span className="eyebrow">{categoryLabel(featured.category, lang) ?? d.all}</span>
            <h2>
              <a href={href(featured)}>
                {featured.title}
                <ArrowUpRightIcon />
              </a>
            </h2>
          </div>
          <div className="featured-facts">
            {featured.totalMinutes != null ? (
              <span className="icon-stat">
                <FactIcon />
                {d.total} · {time(featured.totalMinutes)}
              </span>
            ) : null}
            {featured.untested ? (
              <span className="status-label">{t.untestedBadge}</span>
            ) : (
              <span className="tested-badge">
                <FactIcon kind="check" />
                {t.testedBadge}
              </span>
            )}
          </div>
        </section>
      ) : null}
      <section id="recipes" className="discovery-index">
        <div className="index-heading">
          <h2>{d.index}</h2>
          <p>{d.note}</p>
        </div>
        <div className="discovery-toolbar">
          <nav className="cat-nav" aria-label={t.categories}>
            <a href={`/?lang=${lang}#recipes`} className="chip" aria-current={!activeCategory ? 'page' : undefined}>
              {d.all}
            </a>
            {categories.map((cat) => (
              <a
                key={cat}
                className="chip"
                aria-current={cat === activeCategory ? 'page' : undefined}
                href={`/?lang=${lang}&cat=${cat}#recipes`}
              >
                <CategoryIcon slug={cat} />
                {categoryLabel(cat, lang)}
              </a>
            ))}
          </nav>
          <div className="toolbar-controls">
            <div className="discovery-search-wrap">
              <input
                type="search"
                className="discovery-search"
                data-recipe-search
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                autoComplete="off"
              />
            </div>
            <div className="view-toggle" role="group" aria-label={d.index} data-view-toggle>
              <button type="button" data-view-btn="list" aria-pressed="true" title={t.viewList}>
                <SocialIcon name="index" />
                {t.viewList}
              </button>
              <button type="button" data-view-btn="grid" aria-pressed="false" title={t.viewGrid}>
                <SocialIcon name="grid" />
                {t.viewGrid}
              </button>
            </div>
          </div>
        </div>
        <p className="closest-match-note" data-closest-note hidden>{d.noExact}</p>
        <ul className="discovery-list" data-recipe-list>
          {filtered.map((r, i) => {
            const catText = categoryLabel(r.category, lang);
            const searchBody = `${r.ingredients ?? ''} ${r.intro ?? ''}`.trim();
            const isCrossLocale = Boolean(currentCountry && r.country && r.country !== currentCountry);
            return (
              <li
                key={r.id}
                data-recipe-item
                data-title={r.title}
                data-category={catText ?? ''}
                data-body={searchBody}
                data-search={`${r.title} ${catText ?? ''} ${searchBody}`.toLowerCase()}
                className={r.imageId && asImageStyle(r.imageStyle) ? 'has-thumb' : undefined}
              >
                <span className="recipe-number">{String(i + 1).padStart(2, '0')}</span>
                {r.imageId && asImageStyle(r.imageStyle) ? (
                  <span className="recipe-thumb">
                    <img src={`/img/recipe/${r.imageId}`} alt="" loading="lazy" width="96" height="96" />
                    <span className="thumb-label">
                      {r.imageStyle === 'illustration'
                        ? t.imageLabelIllustration
                        : r.imageStyle === 'graphic'
                          ? t.imageLabelGraphic
                          : r.imageStyle === 'photo'
                            ? t.imageLabelPhoto
                            : null}
                    </span>
                  </span>
                ) : null}
                <div>
                  {catText ? (
                    <span className="eyebrow">
                      <CategoryIcon slug={r.category} />
                      {catText}
                    </span>
                  ) : null}
                  <h3>
                    <a className="stretched-row" href={href(r)}>{r.title}</a>
                  </h3>
                  {r.intro ? <p className="card-intro">{r.intro}</p> : null}
                  <div className="row-badges">
                    {r.untested ? (
                      <span className="status-label">{t.untestedBadge}</span>
                    ) : (
                      <span className="tested-badge">
                        <FactIcon kind="check" />
                        {t.testedBadge}
                      </span>
                    )}
                    {r.lang !== lang ? <span className="fallback-language">{LANG_NAMES[r.lang]}</span> : null}
                    {isCrossLocale ? <span className="provenance-badge">{localizedCountryName(r.country, lang)}</span> : null}
                  </div>
                </div>
                <div className="row-end">
                  {r.totalMinutes != null ? (
                    <span className="icon-stat">
                      <FactIcon />
                      {time(r.totalMinutes)}
                    </span>
                  ) : null}
                  <a href={href(r)} aria-label={r.title} tabIndex={-1}>
                    <ArrowUpRightIcon />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="empty-note empty-search-card" data-search-empty data-nothing-matches={d.nothingMatches} hidden>
          <EmptySkilletIllustration />
          <p data-empty-msg>{d.empty}</p>
          <div data-empty-suggestions hidden>
            <p className="suggestions-heading">{d.didYouMean}</p>
            <ul data-suggestions-list className="suggestions-list"></ul>
          </div>
          <div className="empty-actions">
            <button type="button" className="btn-clear" data-clear-search>{d.clearSearch}</button>
            <a className="empty-share-link" href={`/account/recipes/new${lq}`}>
              <SocialIcon name="plus" />
              {t.emptyShareCta}
            </a>
          </div>
        </div>
        {filtered.length === 0 ? <p className="empty-note">{d.empty}</p> : null}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Country home
// ---------------------------------------------------------------------------

export interface CountryHomeProps {
  countryName: string;
  country: string;
  recipes: RecipeRow[];
  /** All CATEGORIES slugs present in the unfiltered listing (for filter chips). */
  categories?: string[];
  /** Active ?cat= filter, validated against CATEGORIES by the router. */
  activeCategory?: string | null;
}

export function CountryHome({ country, recipes, activeCategory = null }: CountryHomeProps) {
  const lang = defaultLocale(country) ?? 'en';
  return <Home locales={[]} recipes={recipes} lang={lang} activeCategory={activeCategory} currentCountry={country} />;
}

// ---------------------------------------------------------------------------
// Recipe page
// ---------------------------------------------------------------------------

/** Plain share links: no SDKs, no tracking scripts. Pinterest needs a real
 * image URL (media), so it only appears when one exists. */
export function shareLinks(url: string, title: string, imageUrl?: string | null) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { key: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: 'x', label: 'X', href: `https://x.com/intent/tweet?url=${u}&text=${t}` },
    { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${t}%20${u}` },
    { key: 'reddit', label: 'Reddit', href: `https://www.reddit.com/submit?url=${u}&title=${t}` },
    { key: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}` },
    { key: 'email', label: '', href: `mailto:?subject=${t}&body=${t}%0A%0A${u}` },
  ];
  if (imageUrl) {
    links.splice(1, 0, {
      key: 'pinterest',
      label: 'Pinterest',
      href: `https://www.pinterest.com/pin/create/button/?url=${u}&media=${encodeURIComponent(imageUrl)}&description=${t}`,
    });
  }
  return links;
}

export function RecipeView({
  page,
  alternates = [],
  canonicalUrl,
  imageUrl,
  related = [],
}: {
  page: RecipePage;
  alternates?: { hreflang: string; href: string }[];
  canonicalUrl?: string;
  imageUrl?: string | null;
  countryName?: string;
  related?: RecipeRow[];
}) {
  const t = uiStrings(page.locale.lang);
  const entries = JSON.parse(page.locale.ingredientsJson) as IngredientEntry[];
  const steps = JSON.parse(page.locale.stepsJson) as string[];
  const lang = page.locale.lang;
  const sys = defaultUnitSystem(page.locale.country);
  const plainIngredients = entries.map((e) => (typeof e === 'string' ? e : e.name));
  const others = alternates.filter((a) => a.hreflang !== 'x-default' && !a.hreflang.startsWith(page.locale.lang + '-'));
  const hasQty =
    entries.some((e) => (typeof e === 'string' ? parseIngredient(e).qty !== null : e.qty !== null)) &&
    scalingIsSafe(plainIngredients, steps.filter((s) => !/\{[ti]:/.test(s)));
  const mults = hasQty ? SCALE_MULTIPLIERS : ([1] as const);
  const unitsMatter =
    entries.some((e) => isConvertible(e, 'metric') || isConvertible(e, 'us')) || hasStepTokens(steps);
  const cat = categoryLabel(page.recipe.category, lang);
  const r = page.recipe;
  const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 > 0 ? `${m % 60} min` : ''}`.trim() : `${m} min`);
  const timeItems: { kind: string; label: string; value: string }[] = [];
  if (r.baseServings != null) timeItems.push({ kind: 'servings', label: t.servings, value: String(r.baseServings) });
  if (r.prepMinutes != null) timeItems.push({ kind: 'prep', label: t.timePrep, value: fmtMin(r.prepMinutes) });
  if (r.cookMinutes != null) timeItems.push({ kind: 'cook', label: t.timeCook, value: fmtMin(r.cookMinutes) });
  if (r.restMinutes != null) timeItems.push({ kind: 'rest', label: t.timeRest, value: fmtMin(r.restMinutes) });
  if (r.totalMinutes != null) timeItems.push({ kind: 'clock', label: t.timeTotal, value: fmtMin(r.totalMinutes) });
  const crumbItems: { href?: string; label: string }[] = [
    { href: `/?lang=${lang}`, label: t.home },
  ];
  if (cat && page.recipe.category) {
    crumbItems.push({ href: `/?lang=${lang}&cat=${page.recipe.category}#recipes`, label: cat });
  }
  crumbItems.push({ label: page.locale.title });
  const recipeBasePath = recipePathFor(page.locale.country, page.locale.lang, page.locale.slug);
  const cardSvgPath = `${recipeBasePath}/card.svg`;
  const ogSvgPath = `${recipeBasePath}/og.svg`;
  return (
    <main id="main" className="recipe-page">
      <Crumbs items={crumbItems} />
      <header className="recipe-header">
        {cat && page.recipe.category ? (
          <a className="recipe-eyebrow" href={`/?lang=${lang}&cat=${page.recipe.category}#recipes`}>
            <CategoryIcon slug={page.recipe.category} />
            {cat}
          </a>
        ) : null}
        <h1>{page.locale.title}</h1>
        {page.locale.intro ? <p className="recipe-intro">{page.locale.intro}</p> : null}
      </header>
      {page.heroImage ? (
        <figure className="hero-image">
          <img src={page.heroImage.url.replace(/^https?:\/\/[^/]+/, '')} alt={page.locale.title} loading="lazy" />
          {page.heroImage.style === 'illustration' ? <figcaption>{t.imageIllustrationNote}</figcaption> : null}
        </figure>
      ) : null}
      {timeItems.length > 0 ? (
        <p className="time-meta">
          {timeItems.map((it, i) => (
            <span key={i} className="time-item">
              <FactIcon kind={it.kind} />
              <span className="time-label">{it.label}</span> {it.value}
            </span>
          ))}
        </p>
      ) : null}
      <p className="recipe-actions">
        <a href="#recipe" className="jump">
          {t.jumpToRecipe} &darr;
        </a>
        {canonicalUrl ? (
          <a href="#share-bar" className="share-jump">
            <SocialIcon name="share" />
            {t.share}
          </a>
        ) : null}
        <button type="button" className="print-open" data-print-open>
          {t.print}
        </button>
        <button type="button" className="cook-open" data-cook-open>
          {t.cookMode}
        </button>
      </p>
      {others.length > 0 || cat ? (
        <p className="langs">
          {cat ? (
            <a className="chip" href={`/?lang=${lang}&cat=${page.recipe.category}#recipes`}>
              {cat}
            </a>
          ) : null}
          {others.map((a) => (
            <a key={a.hreflang} href={a.href} hrefLang={a.hreflang}>
              {LANG_NAMES[a.hreflang.split('-')[0] ?? ''] ?? a.hreflang}
            </a>
          ))}
        </p>
      ) : null}
      {isUntested(page.recipe) ? (
        <p className="untested" role="note">
          <span className="badge">{t.untestedBadge}</span> {t.untestedNote}{' '}
          <a href={`/how-we-test${langQuery(lang)}`}>{t.howWeTest}</a>{' '}
          <a href={`/account/recipes/${page.recipe.id}/test-report${langQuery(lang)}`}>{t.testReportCta}</a>
        </p>
      ) : (
        <p className="tested-banner" role="note">
          <span className="badge">{t.testedBadge}</span>{' '}
          <a href={`/how-we-test${langQuery(lang)}`}>{t.howWeTest}</a>
        </p>
      )}
      {page.locale.translationOf && page.locale.translationMethod === 'machine' && page.locale.translationReviewerKind !== 'human' ? (
        <p className="machine-note" role="note">
          <span className="badge">{page.locale.lang === 'es' ? 'Traducci\u00f3n autom\u00e1tica' : page.locale.lang === 'fr' ? 'Traduction automatique' : 'Machine-translated'}</span> {t.machineNote}
        </p>
      ) : null}
      <section id="recipe" className="recipe-body-grid">
        <div className="recipe-col ingredients-col">
          <div className="section-head">
            <h2>{t.ingredients}</h2>
            <div className="ing-tools">
              <span className="ing-progress" data-ing-progress hidden />
              <button type="button" className="copy-ing-btn" data-copy-ingredients data-copied={t.ingredientsCopied}>
                <SocialIcon name="copy" />
                {t.copyIngredients}
              </button>
              <button type="button" className="copy-ing-btn" data-share-grocery data-copied={t.groceryListReady}>
                <SocialIcon name="list" />
                {t.shareGroceryList}
              </button>
            </div>
          </div>
          {hasQty ? (
            <div className="scaler" role="group" aria-label={t.servings}>
              <span className="scaler-label">{t.servings}:</span>
              {SCALE_MULTIPLIERS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={m === 1 ? 'scaler-btn active' : 'scaler-btn'}
                  data-mult={m}
                >
                  {m === 0.5 ? '\u00bd' : String(m)}{'\u00d7'}
                </button>
              ))}
            </div>
          ) : null}
          {unitsMatter ? (
            <div className="unit-toggle" role="group" aria-label={t.units} data-default-units={sys}>
              <span className="scaler-label">{t.units}:</span>
              <button type="button" data-units="metric">{t.unitsMetric}</button>
              <button type="button" data-units="us">{t.unitsUs}</button>
            </div>
          ) : null}
          <ul className="ingredients">
            {entries.map((e, i) => (
              <li key={i}>
                <label>
                  <input type="checkbox" />
                  <span className="line" data-v={JSON.stringify(ingredientVariants(e, lang, mults))}>
                    {renderIngredient(e, lang, sys, 1)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="recipe-col steps-col">
          <h2>{t.steps}</h2>
          <ol className="steps">
            {steps.map((st, i) => (
              <li key={i} id={`step-${i + 1}`} data-v={hasStepTokens([st]) ? JSON.stringify(stepVariants(st, entries, lang, mults)) : undefined}>
                {renderStep(st, entries, lang, sys, 1)}
              </li>
            ))}
          </ol>
        </div>
      </section>
      {canonicalUrl ? (
        <nav id="share-bar" className="share" aria-label={t.share} data-share-url={canonicalUrl} data-share-title={page.locale.title}>
          <div className="share-head">
            <span className="share-label">{t.share} · <strong>{t.shareHeading}</strong></span>
            <span className="share-sub">{t.shareSubhead}</span>
          </div>
          <div className="share-buttons">
            <button type="button" className="share-native" data-share-native hidden>
              <SocialIcon name="share" />
              {t.share}
            </button>
            <button type="button" className="share-copy" data-share-copy data-copied={t.linkCopied}>
              <SocialIcon name="copy" />
              {t.copyLink}
            </button>
            <button
              type="button"
              className="share-story-btn"
              data-story-card
              data-card-svg={cardSvgPath}
              data-recipe-slug={page.locale.slug}
              data-copied={t.storyCardReady}
            >
              <SocialIcon name="story" />
              {t.saveStoryCard}
            </button>
            <button
              type="button"
              className="share-story-btn"
              data-og-card
              data-card-svg={ogSvgPath}
              data-recipe-slug={page.locale.slug}
              data-copied={t.ogCardReady}
            >
              <SocialIcon name="og" />
              {t.saveOgCard}
            </button>
            <button type="button" className="share-card-btn" data-share-card data-copied={t.recipeCardCopied}>
              <SocialIcon name="card" />
              {t.copyRecipeCard}
            </button>
            {shareLinks(canonicalUrl, page.locale.title, imageUrl).map((l) => (
              <a key={l.key} className={`share-link share-${l.key}`} href={l.href} target="_blank" rel="noopener noreferrer">
                <SocialIcon name={l.key} />
                {l.label || t.shareEmail}
              </a>
            ))}
          </div>
        </nav>
      ) : null}
      <p className="recipe-source">
        {t.source}:{' '}
        {page.source.url.startsWith('http') ? (
          <a href={page.source.url}>{page.source.name}</a>
        ) : (
          <span>{page.source.name}</span>
        )}
      </p>
      {related.length > 0 ? (
        <section className="related-recipes" aria-label={t.moreToCook}>
          <h2>{t.moreToCook}</h2>
          <ul className="related-grid">
            {related.map((rel) => {
              const relCat = categoryLabel(rel.category, lang);
              return (
                <li key={rel.id} className="related-card">
                  {relCat ? <span className="eyebrow">{relCat}</span> : null}
                  <h3>
                    <a className="stretched" href={recipePathFor(rel.country, rel.lang, rel.slug)}>
                      {rel.title}
                    </a>
                  </h3>
                  <div className="related-meta">
                    {rel.totalMinutes != null ? (
                      <span className="icon-stat">
                        <FactIcon />
                        {fmtMin(rel.totalMinutes)}
                      </span>
                    ) : null}
                    <span className="related-arrow" aria-hidden="true">
                      <ArrowUpRightIcon />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <div className="cook-mode" data-cook-mode hidden>
        <div className="cook-inner">
          <div className="cook-top">
            <span className="cook-progress" data-cook-progress />
            <button type="button" className="cook-close" data-cook-close>
              {t.exitCookMode}
            </button>
          </div>
          <div className="cook-bar" aria-hidden="true">
            <div className="cook-bar-fill" data-cook-bar />
          </div>
          <p className="cook-step" data-cook-step />
          <div className="cook-timer" data-cook-timer hidden>
            <button type="button" className="timer-btn" data-timer-btn>
              {t.startTimer}: <span data-timer-label />
            </button>
            <span className="timer-display" data-timer-display hidden />
          </div>
          <div className="cook-nav">
            <button type="button" data-cook-prev>{t.previousStep}</button>
            <button type="button" data-cook-next>{t.nextStep}</button>
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Static pages (localized by active lang instead of stacking 3 languages)
// ---------------------------------------------------------------------------

export function PrivacyView({ lang = 'en' }: { lang?: string }) {
  if (lang === 'es') {
    return (
      <main id="main">
        <h1>Privacidad</h1>
        <p>No necesitas iniciar sesi&oacute;n para leer recetas y leer no usa cookies. Si cambias entre unidades de EE. UU. y m&eacute;tricas o eliges tema claro/oscuro, tu preferencia se guarda en tu propio navegador (almacenamiento local, claves &quot;2y-units&quot; y &quot;2y-theme&quot;) para recordarla. Se queda en tu dispositivo y no se nos env&iacute;a.</p>
        <p>Si creas una cuenta para enviar una receta, guardamos tu correo electr&oacute;nico, el nombre de autor que elijas y los borradores que guardes. Para iniciar sesi&oacute;n enviamos un c&oacute;digo de 6 d&iacute;gitos a tu correo mediante el servicio Resend; el c&oacute;digo se guarda solo como hash. Al iniciar sesi&oacute;n se usa una cookie de sesi&oacute;n (&quot;__Host-2y_sid&quot;, HttpOnly, hasta 30 d&iacute;as) que te mantiene conectado en ese navegador, y solo guardamos un hash de su valor. Los borradores son privados hasta que los env&iacute;es para revisi&oacute;n. Nada de lo que env&iacute;es se publica autom&aacute;ticamente.</p>
        <p>Medimos visitas y velocidad de p&aacute;gina con Cloudflare Web Analytics. Seg&uacute;n Cloudflare, este servicio de anal&iacute;tica no usa cookies ni almacenamiento local, no identifica a los visitantes y no recopila datos personales para estad&iacute;sticas.</p>
      </main>
    );
  }
  if (lang === 'fr') {
    return (
      <main id="main">
        <h1>Confidentialit&eacute;</h1>
        <p>Vous n&apos;avez pas besoin de vous connecter pour lire les recettes, et la lecture ne d&eacute;pose aucun cookie. Si vous changez d&apos;unit&eacute;s ou de th&egrave;me clair/sombre, votre choix reste uniquement dans le stockage local de votre navigateur (&laquo; 2y-units &raquo;, &laquo; 2y-theme &raquo;).</p>
        <p>Si vous cr&eacute;ez un compte pour proposer une recette, nous conservons votre adresse e-mail, le nom d&apos;auteur choisi et vos brouillons priv&eacute;s. La connexion utilise un code &agrave; 6 chiffres envoy&eacute; via Resend (stock&eacute; uniquement sous forme de hachage) et un cookie de session (&laquo; __Host-2y_sid &raquo;, HttpOnly, 30 jours maximum). Rien de ce que vous envoyez n&apos;est publi&eacute; automatiquement.</p>
        <p>Nous mesurons les pages vues et la vitesse avec Cloudflare Web Analytics, un service sans cookies ni suivi individuel.</p>
      </main>
    );
  }
  return (
    <main id="main">
      <h1>Privacy</h1>
      <p>You do not need to sign in to read recipes, and reading sets no cookies. If you switch between US and metric units or choose a light/dark theme, your choice is saved in your own browser (local storage, keys &quot;2y-units&quot; and &quot;2y-theme&quot;) so the page remembers it. It stays on your device and is not sent to us.</p>
      <p>If you create an account to send in a recipe, we store your email address, the author name you choose, and the recipe drafts you save. Signing in uses a 6-digit code sent to your email through the email service Resend; the code is stored only as a hash. Signing in sets one session cookie (&quot;__Host-2y_sid&quot;, HttpOnly, up to 30 days) that keeps you signed in on that browser, and we store only a hash of its value. Signing out ends that session. Drafts are private to you until you send one in for review. Nothing you send in is published automatically.</p>
      <p>We measure page views and page speed with Cloudflare Web Analytics. Per Cloudflare, this analytics service does not use cookies or local storage, does not fingerprint visitors, and does not collect personal data for analytics. We use the counts only to see which pages people read.</p>
    </main>
  );
}

export function AboutView({ lang = 'en' }: { lang?: string }) {
  if (lang === 'es') {
    return (
      <main id="main">
        <h1>Acerca de 2yolks</h1>
        <p>2yolks es un sitio de recetas internacionales. Lee las mismas recetas en ingl&eacute;s, espa&ntilde;ol o franc&eacute;s: el idioma cambia la experiencia de lectura, no la cocina.</p>
        <p>Escribimos las recetas con nuestras propias palabras a partir de t&eacute;cnicas culinarias documentadas, o las recibimos de cocineros que confirman sus derechos. Solo publicamos recetas cuya fuente ha sido verificada.</p>
        <p>Cada receta indica con total honestidad si ya fue cocinada o si est&aacute; marcada como a&uacute;n no probada. <a href="/how-we-test?lang=es">C&oacute;mo probamos y etiquetamos las recetas</a>.</p>
      </main>
    );
  }
  if (lang === 'fr') {
    return (
      <main id="main">
        <h1>&Agrave; propos de 2yolks</h1>
        <p>2yolks est un site de recettes internationales. Lisez les m&ecirc;mes recettes en anglais, espagnol ou fran&ccedil;ais : la langue change l&apos;exp&eacute;rience de lecture, pas la cuisine.</p>
        <p>Les recettes sont r&eacute;dig&eacute;es avec nos propres mots &agrave; partir de techniques document&eacute;es ou partag&eacute;es par des cuisiniers ayant confirm&eacute; leurs droits. Aucune recette n&apos;est publi&eacute;e sans v&eacute;rification.</p>
        <p>Chaque recette indique honn&ecirc;tement son statut de test en cuisine. <a href="/how-we-test?lang=fr">Comment nous testons et &eacute;tiquetons les recettes</a>.</p>
      </main>
    );
  }
  return (
    <main id="main">
      <h1>About 2yolks</h1>
      <p>2yolks is an international recipe site. Read the same recipes in English, Spanish or French. Language changes the reading experience, not the cuisine.</p>
      <p>Recipes are written for 2yolks in our own words, from standard, widely documented techniques, or contributed by home cooks with verified rights. We do not copy text or photos from other sites. A recipe is only shown when its source has been cleared for use.</p>
      <p>Every recipe carries an honest kitchen status label until a person cooks it and signs it off. <a href="/how-we-test">How we test and label recipes</a>.</p>
    </main>
  );
}

export function HowWeTestView({ lang = 'en' }: { lang?: string }) {
  if (lang === 'es') {
    return (
      <main id="main">
        <h1>C&oacute;mo probamos y etiquetamos las recetas</h1>
        <p>Cada receta en 2yolks lleva una de estas dos etiquetas:</p>
        <ul>
          <li><strong>A&uacute;n no probada.</strong> Escrita con t&eacute;cnicas est&aacute;ndar y revisada contra gu&iacute;as de seguridad alimentaria; tiempos y porciones son estimados hasta que alguien la cocine.</li>
          <li><strong>Probada.</strong> Una persona la cocin&oacute; en su cocina, registr&oacute; el rendimiento y tiempo reales y anot&oacute; cualquier ajuste, con fecha visible.</li>
        </ul>
        <p>Nunca inventamos calificaciones, rese&ntilde;as ni pruebas.</p>
        <h2>Probada por la comunidad</h2>
        <p>Las personas con cuenta pueden reportar que cocinaron una receta (un reporte por persona y receta, nunca sobre sus propias recetas). Un moderador lee cada reporte y la receta solo se marca como probada tras una aprobaci&oacute;n.</p>
      </main>
    );
  }
  if (lang === 'fr') {
    return (
      <main id="main">
        <h1>Comment nous testons et &eacute;tiquetons les recettes</h1>
        <p>Chaque recette sur 2yolks porte l&apos;une de ces deux &eacute;tiquettes :</p>
        <ul>
          <li><strong>Pas encore test&eacute;e.</strong> &Eacute;crite &agrave; partir de techniques courantes et v&eacute;rifi&eacute;e selon les rep&egrave;res de s&eacute;curit&eacute; alimentaire ; les temps et portions restent indicatifs tant qu&apos;elle n&apos;a pas &eacute;t&eacute; cuisin&eacute;e.</li>
          <li><strong>Test&eacute;e.</strong> Une personne l&apos;a cuisin&eacute;e, a not&eacute; le rendement et le temps r&eacute;els ainsi que la date.</li>
        </ul>
        <p>Nous n&apos;inventons jamais de notes, d&apos;avis ou de tests.</p>
        <h2>Test communautaire</h2>
        <p>Les cuisiniers connect&eacute;s peuvent signaler avoir cuisin&eacute; une recette (un signalement par cuisinier et par recette, jamais sur leurs propres recettes). Un mod&eacute;rateur lit chaque signalement et la recette n&apos;est marqu&eacute;e test&eacute;e qu&apos;apr&egrave;s approbation.</p>
      </main>
    );
  }
  return (
    <main id="main">
      <h1>How we test and label recipes</h1>
      <p>Every recipe on 2yolks carries one of two labels.</p>
      <ul>
        <li><strong>Not yet tested.</strong> Written from standard techniques and checked against food-safety guidance (for example USDA safe minimum temperatures). Nobody has cooked it for 2yolks yet, so times and yields are estimates.</li>
        <li><strong>Tested.</strong> A person cooked it, recorded the real yield and time, and noted changes. We show the date.</li>
      </ul>
      <p>We never invent ratings, reviews or testing. If a recipe has not been cooked, we say so.</p>
      <h2>Community-tested</h2>
      <p>Signed-in cooks can report that they cooked a recipe: one report per cook per recipe, never on their own submissions. A moderator reads every report, and a recipe is marked tested only after a report is approved. Reports we cannot stand behind are hidden, never published.</p>
    </main>
  );
}

export function NotFoundView() {
  return (
    <main id="main">
      <h1>Page not found / P&aacute;gina no encontrada</h1>
      <p>We could not find that page. <a href="/">Go to the 2yolks home page</a>.</p>
      <p>No encontramos esa p&aacute;gina. <a href="/">Ir al inicio</a>.</p>
    </main>
  );
}
