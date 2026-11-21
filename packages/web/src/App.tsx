import type { RecipePage, IngredientEntry, DietTag, DifficultyLevel, TimeBucket, SearchQuery, SearchResult } from '@2yolks/contracts';
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
  MAX_HOME_ITEMS,
  RECIPE_CATEGORY_SLUGS,
  DIET_TAGS,
  TIME_BUCKETS,
  DIFFICULTY_LEVELS,
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

export function SiteHeader({
  nav = [],
  lang = 'en',
  initialQuery = '',
  cuisines = [],
}: {
  nav?: SiteNavItem[];
  lang?: string;
  initialQuery?: string;
  cuisines?: { slug: string; label: string }[];
}) {
  const t = uiStrings(lang);
  const lq = langQuery(lang);
  const searchHref = `/search${lq}`;
  return (
    <header className="site-header">
      <a className="skip" href="#main">{t.skipToContent}</a>
      <div className="header-inner">
        <a className="brand" href={`/?lang=${lang}`}>
          <span className="brand-word">2yolks</span>
          <TwinYolkLogoMark />
        </a>
        <form className="header-search-form" action="/search" method="get" role="search" data-header-search>
          {lang !== 'en' ? <input type="hidden" name="lang" value={lang} /> : null}
          <label className="visually-hidden" htmlFor="header-search-q">{t.searchNav}</label>
          <SocialIcon name="search" className="social-icon header-search-icon" />
          <input
            id="header-search-q"
            type="search"
            name="q"
            defaultValue={initialQuery}
            placeholder={t.searchPlaceholder}
            autoComplete="off"
            enterKeyHint="search"
            data-header-search-input
            data-suggest-lang={lang}
          />
          <button type="submit">{t.searchNav}</button>
          <div className="search-popover" data-search-popover hidden />
        </form>
        <nav className="site-nav" aria-label={lang === 'es' ? 'Recetas' : lang === 'fr' ? 'Recettes' : 'Recipes'}>
          <a className="nav-search nav-search-mobile" href={searchHref} data-open-search-sheet aria-label={t.searchNav}>
            <SocialIcon name="search" />
            <span className="nav-search-label">{t.searchNav}</span>
          </a>
          <a className="nav-secondary" href={`/recipes${lq}`}>{t.allRecipes}</a>
          <a className="nav-secondary" href={`/collections${lq}`}>{t.collectionsNav}</a>
          <a className="nav-secondary" href={`/cuisine${lq}`}>{t.cuisinesNav}</a>
          <a className="nav-secondary nav-saved-link" href={`/saved${lq}`}>
            {t.savedNav}
            <span className="saved-count" data-saved-count hidden />
          </a>
          <a className="nav-secondary" href={`/account${lq}`}>{t.myKitchenNav}</a>
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
        {/* Compact mobile menu: a native disclosure, so it works without JS. */}
        <details className="mobile-menu">
          <summary aria-label={t.menuNav}>
            <SocialIcon name="menu" />
          </summary>
          <div className="mobile-menu-panel">
            <nav aria-label={t.menuNav}>
              <a href={`/recipes${lq}`}>{t.allRecipes}</a>
              <a href={`/collections${lq}`}>{t.collectionsNav}</a>
              <a href={`/cuisine${lq}`}>{t.cuisinesNav}</a>
              {cuisines.slice(0, 4).map((cu) => (
                <a key={cu.slug} className="mobile-sub-link" href={`/cuisine/${cu.slug}${lq}`}>{cu.label}</a>
              ))}
              <a href={`/saved${lq}`}>{t.savedNav}</a>
              <a href={`/account${lq}`}>{t.myKitchenNav}</a>
              <a href={`/how-we-test${lq}`}>{t.testingShort}</a>
            </nav>
            <nav className="mobile-menu-langs" aria-label="Language">
              {nav.map((item) => (
                <a key={item.href} href={item.href} aria-current={item.current ? 'page' : undefined}>
                  {item.label}
                </a>
              ))}
            </nav>
            <button type="button" className="theme-toggle theme-toggle-menu" data-theme-toggle>
              <SocialIcon name="moon" className="social-icon icon-moon" />
              <SocialIcon name="sun" className="social-icon icon-sun" />
              {t.themeToggle}
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}

export function SearchSheet({ lang = 'en', initialQuery = '' }: { lang?: string; initialQuery?: string }) {
  const t = uiStrings(lang);
  const lq = langQuery(lang);
  const langAmp = lang === 'en' ? '' : `lang=${lang}&`;
  const labels = lang === 'es'
    ? { close: 'Cerrar buscador', recent: 'Búsquedas recientes', clearRecent: 'Borrar', explore: 'Accesos rápidos', quick: '≤ 30 min', noOven: 'Sin horno', veg: 'Vegetariana', weeknight: 'Entre semana', harvest: 'Otoño y fiesta', cuisines: 'Cocinas', suggestions: 'Sugerencias' }
    : lang === 'fr'
      ? { close: 'Fermer la recherche', recent: 'Recherches récentes', clearRecent: 'Effacer', explore: 'Accès rapides', quick: '≤ 30 min', noOven: 'Sans four', veg: 'Végétarien', weeknight: 'Semaine', harvest: 'Fêtes d’automne', cuisines: 'Cuisines', suggestions: 'Suggestions' }
      : { close: 'Close search', recent: 'Recent searches', clearRecent: 'Clear', explore: 'Quick shortcuts', quick: '30 min or less', noOven: 'No oven', veg: 'Vegetarian', weeknight: 'Weeknight dinners', harvest: 'Thanksgiving', cuisines: 'Cuisines', suggestions: 'Suggestions' };
  return (
    <div
      className="search-sheet"
      data-search-sheet
      role="dialog"
      aria-modal="true"
      aria-label={t.searchNav}
      hidden
    >
      <div className="search-sheet-head">
        <span className="search-sheet-title">{t.searchNav}</span>
        <button type="button" className="search-sheet-close" data-close-search-sheet aria-label={labels.close}>
          <SocialIcon name="close" />
        </button>
      </div>
      <form className="search-sheet-form" action="/search" method="get" role="search" data-sheet-form>
        {lang !== 'en' ? <input type="hidden" name="lang" value={lang} /> : null}
        <label className="visually-hidden" htmlFor="sheet-search-q">{t.searchNav}</label>
        <input
          id="sheet-search-q"
          type="search"
          name="q"
          defaultValue={initialQuery}
          placeholder={t.searchPlaceholder}
          autoComplete="off"
          enterKeyHint="search"
          data-sheet-search-input
          data-suggest-lang={lang}
        />
        <button type="submit">{t.searchNav}</button>
      </form>
      <div className="search-sheet-section" data-recent-searches-wrap hidden>
        <div className="search-sheet-row">
          <h3>{labels.recent}</h3>
          <button type="button" className="quiet-link" data-clear-recent-q>{labels.clearRecent}</button>
        </div>
        <div className="search-sheet-chips" data-recent-searches />
      </div>
      <div className="search-sheet-section" data-sheet-suggestions-wrap hidden>
        <h3>{labels.suggestions}</h3>
        <div data-sheet-suggestions />
      </div>
      <div className="search-sheet-section">
        <h3>{labels.explore}</h3>
        <div className="search-sheet-chips">
          <a className="chip" href={`/search?${langAmp}time=30`}>{labels.quick}</a>
          <a className="chip" href={`/search?${langAmp}method=no-oven`}>{labels.noOven}</a>
          <a className="chip" href={`/search?${langAmp}diet=vegetarian`}>{labels.veg}</a>
          <a className="chip" href={`/collections/weeknight${lq}`}>{labels.weeknight}</a>
          <a className="chip" href={`/collections/thanksgiving${lq}`}>{labels.harvest}</a>
          <a className="chip" href={`/cuisine${lq}`}>{labels.cuisines}</a>
        </div>
      </div>
    </div>
  );
}

export function MobileTabBar({ lang = 'en', currentPath = '/' }: { lang?: string; currentPath?: string }) {
  const t = uiStrings(lang);
  const lq = langQuery(lang);
  const isHome = currentPath === '/';
  const isSearch = currentPath.startsWith('/search') || currentPath.startsWith('/recipes/') || currentPath.startsWith('/collections') || currentPath.startsWith('/cuisine');
  const isShare = currentPath === '/account/recipes/new';
  const isSaved = currentPath === '/saved';
  const isMe = currentPath.startsWith('/account') && !isShare;
  return (
    <nav className="mobile-tab-bar" aria-label={t.mobileTabsLabel} data-mobile-tabs>
      <a href={`/${lq}`} className="mobile-tab" aria-current={isHome ? 'page' : undefined}>
        <SocialIcon name="home" />
        <span>{t.home}</span>
      </a>
      <a
        href={`/search${lq}`}
        className="mobile-tab"
        aria-current={isSearch ? 'page' : undefined}
        data-open-search-sheet={currentPath.startsWith('/search') ? undefined : ''}
      >
        <SocialIcon name="search" />
        <span>{t.searchNav}</span>
      </a>
      <a href={`/account/recipes/new${lq}`} className="mobile-tab mobile-tab--share" aria-current={isShare ? 'page' : undefined}>
        <SocialIcon name="plus" />
        <span>{t.share}</span>
      </a>
      <a href={`/saved${lq}`} className="mobile-tab" aria-current={isSaved ? 'page' : undefined}>
        <span className="tab-icon-wrap">
          <SocialIcon name="heart" />
          <span className="tab-badge" data-saved-count hidden />
        </span>
        <span>{t.savedNav}</span>
      </a>
      <a href={`/account${lq}`} className="mobile-tab" aria-current={isMe ? 'page' : undefined}>
        <SocialIcon name="user" />
        <span>{t.meNav}</span>
      </a>
    </nav>
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
          <a href={`/collections${lq}`}>{t.collectionsNav}</a>
          <a href={`/cuisine${lq}`}>{t.cuisinesNav}</a>
          <a href={`/saved${lq}`}>{t.savedNav}</a>
          <a href={`/account/recipes/new${lq}`}>{t.shareRecipeNav}</a>
          <a href={`/account${lq}`}>{t.myKitchenNav}</a>
        </nav>
        <nav className="footer-col" aria-label="2yolks">
          <a href={`/search${lq}`}>{t.searchNav}</a>
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
  originCountry?: string | null;
  untested?: boolean;
  /** CATEGORIES slug; undefined until the additive column ships. */
  category?: string | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  totalMinutes?: number | null;
  /** Latest rights-cleared hero image row id (migration 0004); NULL = text-only row. */
  imageId?: string | null;
  /** Honest-imagery style of that image: real dish photo vs labeled AI illustration vs graphic. */
  imageStyle?: 'photo' | 'illustration' | 'graphic' | null;
  intro?: string | null;
  ingredients?: string | null;
  diets?: DietTag[];
  difficulty?: DifficultyLevel | null;
  noOven?: boolean;
}

export function SaveButton({
  recipe,
  lang,
  initialSaved = false,
  withLabel = false,
}: {
  recipe: Pick<RecipeRow, 'id' | 'title' | 'slug' | 'country' | 'lang' | 'category' | 'totalMinutes' | 'imageId' | 'imageStyle'>;
  lang: string;
  initialSaved?: boolean;
  withLabel?: boolean;
}) {
  const t = uiStrings(lang);
  const href = recipePathFor(recipe.country, recipe.lang, recipe.slug);
  const style = asImageStyle(recipe.imageStyle);
  const meta = JSON.stringify({
    id: recipe.id,
    title: recipe.title,
    href,
    cat: categoryLabel(recipe.category, lang),
    min: recipe.totalMinutes ?? null,
    img: recipe.imageId && style ? `/img/recipe/${recipe.imageId}` : null,
    style,
  });
  return (
    <button
      type="button"
      className={withLabel ? 'save-btn save-btn--labeled' : 'save-btn'}
      data-save-recipe={recipe.id}
      data-recipe-meta={meta}
      data-label-save={t.saveRecipe}
      data-label-saved={t.savedRecipe}
      aria-pressed={initialSaved ? 'true' : 'false'}
      aria-label={initialSaved ? t.savedRecipe : t.saveRecipe}
      title={initialSaved ? t.savedRecipe : t.saveRecipe}
    >
      <SocialIcon name="heart" className="social-icon icon-heart-outline" />
      <SocialIcon name="heart-filled" className="social-icon icon-heart-filled" />
      {withLabel ? <span data-save-label>{initialSaved ? t.savedRecipe : t.saveRecipe}</span> : null}
    </button>
  );
}

const fmtDuration = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ' ' + (n % 60) + ' min' : ''}` : `${n} min`);

export function DiscoveryRowCard({
  recipe: r,
  index,
  lang,
  numbered = false,
  currentCountry = null,
  savedIds,
}: {
  recipe: RecipeRow;
  index: number;
  lang: string;
  numbered?: boolean;
  currentCountry?: string | null;
  savedIds?: ReadonlySet<string>;
}) {
  const t = uiStrings(lang);
  const catText = categoryLabel(r.category, lang);
  const searchBody = `${r.ingredients ?? ''} ${r.intro ?? ''}`.trim();
  const isCrossLocale = Boolean(currentCountry && r.country && r.country !== currentCountry);
  const style = asImageStyle(r.imageStyle);
  const href = recipePathFor(r.country, r.lang, r.slug);
  return (
    <li
      data-recipe-item
      data-title={r.title}
      data-category={catText ?? ''}
      data-body={searchBody}
      data-search={`${r.title} ${catText ?? ''} ${searchBody}`.toLowerCase()}
      className={r.imageId && style ? 'has-thumb' : undefined}
    >
      {/* Always render .recipe-number so the grid title column stays aligned. */}
      <span className="recipe-number">{numbered ? String(index + 1).padStart(2, '0') : ''}</span>
      {r.imageId && style ? (
        <span className="recipe-thumb">
          <img src={`/img/recipe/${r.imageId}`} alt="" loading="lazy" width="96" height="96" />
          <span className="thumb-label">
            {style === 'illustration'
              ? t.imageLabelIllustration
              : style === 'graphic'
                ? t.imageLabelGraphic
                : t.imageLabelPhoto}
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
          <a className="stretched-row" href={href}>{r.title}</a>
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
            {fmtDuration(r.totalMinutes)}
          </span>
        ) : null}
        <div className="row-end-actions">
          <SaveButton recipe={r} lang={lang} initialSaved={Boolean(savedIds?.has(r.id))} />
          <a href={href} aria-label={r.title} tabIndex={-1}>
            <ArrowUpRightIcon />
          </a>
        </div>
      </div>
    </li>
  );
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
  /** True when lang came from the browser's Accept-Language rather than an
   * explicit choice: show the visible switcher confirmation (pick 2A). */
  langNotice?: boolean;
}

const DISCOVERY: Record<string, { eyebrow: string; title: string; intro: string; cta: string; index: string; all: string; note: string; illustration: string; total: string; empty: string; noExact: string; nothingMatches: string; didYouMean: string; clearSearch: string; seeAll: string; langNotice: string; heroSearchLabel: string; heroSearchPlaceholder: string; heroSearchButton: string; quickChips: { label: string; kind: 'time30' | 'q' | 'noOven' | 'veg' | 'thanksgiving'; value: string }[]; resultsOne: string; resultsMany: string; searchAll: string; browseAllCount: string }> = {
  en: { eyebrow: 'RECIPES WITHOUT BORDERS', title: 'Small kitchen. Big appetite.', intro: 'Find something worth cooking. Recipes to read, make and share.', cta: "What's cooking?", index: 'Find your flavor', all: 'All recipes', note: 'Every recipe, honestly labeled.', illustration: 'AI-generated ingredient illustration, not a dish photograph', total: 'Total', empty: 'No recipes in this filter yet.', noExact: 'No exact match — closest matches:', nothingMatches: "Nothing matches '{q}' yet", didYouMean: 'Did you mean:', clearSearch: 'Clear search', seeAll: 'See all', langNotice: 'Showing recipes in your browser language. Switch:', heroSearchLabel: 'What do you want to cook?', heroSearchPlaceholder: 'Chicken, pasta, soup…', heroSearchButton: 'Search', quickChips: [{ label: '30-min dinners', kind: 'time30', value: '30' }, { label: 'chicken', kind: 'q', value: 'chicken' }, { label: 'no oven', kind: 'noOven', value: 'no-oven' }, { label: 'vegetarian', kind: 'veg', value: 'vegetarian' }, { label: 'Thanksgiving', kind: 'thanksgiving', value: 'thanksgiving' }], resultsOne: '1 recipe found', resultsMany: '{n} recipes found', searchAll: 'Search all categories', browseAllCount: 'Search & filter all {n} recipes' },
  es: { eyebrow: 'RECETAS SIN FRONTERAS', title: 'Cocina pequeña. Gran apetito.', intro: 'Encuentra algo que quieras cocinar. Recetas para leer, preparar y compartir.', cta: '¿Qué cocinamos?', index: 'Encuentra tu sabor', all: 'Todas las recetas', note: 'Cada receta, con su estado real.', illustration: 'Ilustración de ingredientes generada por IA, no es una foto del plato', total: 'Total', empty: 'Aún no hay recetas en este filtro.', noExact: 'Sin coincidencias exactas — resultados más cercanos:', nothingMatches: "Aún no hay coincidencias para '{q}'", didYouMean: 'Quizás quisiste decir:', clearSearch: 'Borrar búsqueda', seeAll: 'Ver todas', langNotice: 'Mostrando recetas en el idioma de tu navegador. Cambiar:', heroSearchLabel: '¿Qué quieres cocinar hoy?', heroSearchPlaceholder: 'Pollo, pasta, sopa…', heroSearchButton: 'Buscar', quickChips: [{ label: 'Cenas en 30 min', kind: 'time30', value: '30' }, { label: 'pollo', kind: 'q', value: 'pollo' }, { label: 'sin horno', kind: 'noOven', value: 'no-oven' }, { label: 'vegetariana', kind: 'veg', value: 'vegetarian' }, { label: 'Otoño y fiesta', kind: 'thanksgiving', value: 'thanksgiving' }], resultsOne: '1 receta encontrada', resultsMany: '{n} recetas encontradas', searchAll: 'Buscar en todas las categorías', browseAllCount: 'Buscar y filtrar las {n} recetas' },
  fr: { eyebrow: 'RECETTES SANS FRONTIÈRES', title: 'Petite cuisine. Grand appétit.', intro: 'Trouvez une recette à cuisiner. Des recettes à lire, préparer et partager.', cta: 'On cuisine quoi ?', index: 'Trouvez votre saveur', all: 'Toutes les recettes', note: 'Chaque recette, avec son statut réel.', illustration: 'Illustration d’ingrédients générée par IA, pas une photo du plat', total: 'Total', empty: 'Aucune recette dans ce filtre.', noExact: 'Aucune correspondance exacte — résultats les plus proches :', nothingMatches: "Aucune correspondance pour « {q} » pour l'instant", didYouMean: 'Vouliez-vous dire :', clearSearch: 'Effacer la recherche', seeAll: 'Tout voir', langNotice: 'Recettes affichées dans la langue de votre navigateur. Changer :', heroSearchLabel: 'Qu’avez-vous envie de cuisiner ?', heroSearchPlaceholder: 'Poulet, pâtes, soupe…', heroSearchButton: 'Chercher', quickChips: [{ label: 'Dîners en 30 min', kind: 'time30', value: '30' }, { label: 'poulet', kind: 'q', value: 'poulet' }, { label: 'sans four', kind: 'noOven', value: 'no-oven' }, { label: 'végétarien', kind: 'veg', value: 'vegetarian' }, { label: 'Fêtes d’automne', kind: 'thanksgiving', value: 'thanksgiving' }], resultsOne: '1 recette trouvée', resultsMany: '{n} recettes trouvées', searchAll: 'Chercher dans toutes les catégories', browseAllCount: 'Rechercher et filtrer les {n} recettes' },
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
  const selected = discoveryRecipes(recipes, lang);
  const groups = new Map<string, RecipeRow[]>();
  for (const r of selected) groups.set(r.category ?? '', [...(groups.get(r.category ?? '') ?? []), r]);
  const categories = [...groups.keys()].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return (categoryLabel(a, lang) ?? a).localeCompare(categoryLabel(b, lang) ?? b);
  });
  return (
    <main className="wide discovery" id="main">
      <section className="discovery-index">
        <div className="index-heading">
          <h1>{d.all}</h1>
          <p>{d.note}</p>
        </div>
        {categories.map((cat) => (
          <section key={cat || 'uncategorized'} className="index-category">
            <div className="index-group-head">
              <h2>{cat ? (categoryLabel(cat, lang) ?? cat) : d.all}</h2>
              {cat ? (
                <a className="see-all" href={`/recipes/${cat}${langQuery(lang)}`}>
                  {d.seeAll}
                  <ArrowUpRightIcon />
                </a>
              ) : null}
            </div>
            <ul className="discovery-list" data-recipe-list>
              {(groups.get(cat) ?? []).map((r, i) => (
                <DiscoveryRowCard key={r.id} recipe={r} index={i} lang={lang} numbered />
              ))}
            </ul>
          </section>
        ))}
      </section>
    </main>
  );
}

export function Home({ recipes, lang = 'en', activeCategory = null, currentCountry = null, langNotice = false }: HomeProps) {
  const d = DISCOVERY[lang] ?? DISCOVERY.en!;
  const selected = discoveryRecipes(recipes, lang);
  const t = uiStrings(lang);
  const lq = langQuery(lang);
  const langAmp = lang === 'en' ? '' : `lang=${lang}&`;
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
  const chipHref = (chip: { kind: string; value: string }) => {
    if (chip.kind === 'time30') return `/search?${langAmp}time=30`;
    if (chip.kind === 'noOven') return `/search?${langAmp}method=no-oven`;
    if (chip.kind === 'veg') return `/search?${langAmp}diet=vegetarian`;
    if (chip.kind === 'thanksgiving') return `/collections/thanksgiving${lq}`;
    return `/search?${langAmp}q=${encodeURIComponent(chip.value)}`;
  };
  return (
    <main className="wide discovery" id="main">
      {langNotice ? (
        <p className="lang-notice" role="status">
          {d.langNotice}
          {(['en', 'es', 'fr'] as const).filter((l) => l !== lang).map((l) => (
            <a key={l} className="chip" hrefLang={l} href={`/?lang=${l}`}>
              {LANG_NAMES[l]}
            </a>
          ))}
        </p>
      ) : null}
      <section className="after-hero">
        <div className="after-copy">
          <span className="eyebrow">{d.eyebrow}</span>
          <h1>{d.title}</h1>
          <p>{d.intro}</p>
          {/* Plain GET form submitting straight to server-rendered /search. */}
          <form className="hero-search" action="/search" method="get" role="search">
            {lang !== 'en' ? <input type="hidden" name="lang" value={lang} /> : null}
            <label className="hero-prompt" htmlFor="hero-q">{d.heroSearchLabel}</label>
            <div className="hero-search-row">
              <SocialIcon name="search" className="social-icon hero-search-icon" />
              <input id="hero-q" type="search" name="q" placeholder={d.heroSearchPlaceholder} autoComplete="off" enterKeyHint="search" />
              <button type="submit">{d.heroSearchButton}</button>
            </div>
          </form>
          <p className="hero-quick">
            {d.quickChips.map((chip) => (
              <a key={chip.label} href={chipHref(chip)}>{chip.label}</a>
            ))}
          </p>
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
                {d.total} · {fmtDuration(featured.totalMinutes)}
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
            <div className="discovery-search-wrap" id="search">
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
        <p className="visually-hidden" role="status" aria-live="polite" data-search-status data-one={d.resultsOne} data-many={d.resultsMany}></p>
        {(() => {
          if (activeCategory) {
            return (
              <ul className="discovery-list" data-recipe-list>
                {filtered.map((r, i) => (
                  <DiscoveryRowCard key={r.id} recipe={r} index={i} lang={lang} numbered currentCountry={currentCountry} />
                ))}
              </ul>
            );
          }
          const SECTION_CAP = 4;
          const allGroups: { key: string; cat: string | null; label: string; rows: RecipeRow[]; href: string }[] = [];
          for (const cat of categories) {
            allGroups.push({
              key: cat,
              cat,
              label: categoryLabel(cat, lang) ?? cat,
              rows: filtered.filter((r) => r.category === cat),
              href: `/recipes/${cat}${lq}`,
            });
          }
          const rest = filtered.filter((r) => !r.category || !categoryLabel(r.category, lang));
          if (rest.length) allGroups.push({ key: 'more', cat: null, label: d.all, rows: rest, href: `/recipes${lq}` });
          let remaining = MAX_HOME_ITEMS;
          const renderedGroups: { key: string; cat: string | null; label: string; rows: RecipeRow[]; shown: RecipeRow[]; href: string }[] = [];
          for (const g of allGroups) {
            if (remaining <= 0) break;
            const take = Math.min(SECTION_CAP, remaining, g.rows.length);
            if (take <= 0) continue;
            renderedGroups.push({ ...g, shown: g.rows.slice(0, take) });
            remaining -= take;
          }
          const shownTotal = MAX_HOME_ITEMS - remaining;
          return (
            <>
              {renderedGroups.map((g) => (
                <section key={g.key} className="index-group" data-recipe-group>
                  <div className="index-group-head">
                    <h3 className="index-group-title">
                      {g.cat ? <CategoryIcon slug={g.cat} /> : null}
                      {g.cat ? <a className="cat-heading-link" href={g.href}>{g.label}</a> : g.label}
                    </h3>
                    {g.rows.length > SECTION_CAP ? (
                      <a className="see-all" href={g.href}>
                        {d.seeAll}
                        <ArrowUpRightIcon />
                      </a>
                    ) : null}
                  </div>
                  <ul className="discovery-list" data-recipe-list>
                    {g.shown.map((r, i) => (
                      <DiscoveryRowCard key={r.id} recipe={r} index={i} lang={lang} currentCountry={currentCountry} />
                    ))}
                  </ul>
                </section>
              ))}
              {selected.length > shownTotal ? (
                <p className="home-browse-all">
                  <a className="discovery-cta-secondary" href={`/search${lq}`}>
                    <SocialIcon name="search" />
                    {d.browseAllCount.replace('{n}', String(selected.length))}
                  </a>
                </p>
              ) : null}
            </>
          );
        })()}
        <div className="empty-note empty-search-card" data-search-empty data-nothing-matches={d.nothingMatches} hidden>
          <EmptySkilletIllustration />
          <p data-empty-msg>{d.empty}</p>
          <div data-empty-suggestions hidden>
            <p className="suggestions-heading">{d.didYouMean}</p>
            <ul data-suggestions-list className="suggestions-list"></ul>
          </div>
          <div className="empty-actions">
            <button type="button" className="btn-clear" data-clear-search>{d.clearSearch}</button>
            {activeCategory ? (
              <a className="btn-clear" data-search-all data-base={`/${lq}`} href={`/${lq}#recipes`}>
                <SocialIcon name="search" />
                {d.searchAll}
              </a>
            ) : null}
            <a className="empty-share-link" href={`/account/recipes/new${lq}`}>
              <SocialIcon name="plus" />
              {t.emptyShareCta}
            </a>
          </div>
        </div>
        {filtered.length === 0 ? <p className="empty-note" data-filter-empty>{d.empty}</p> : null}
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
  const lq = langQuery(lang);
  const catHref = page.recipe.category ? `/recipes/${page.recipe.category}${lq}` : null;
  const crumbItems: { href?: string; label: string }[] = [
    { href: `/?lang=${lang}`, label: t.home },
  ];
  if (cat && catHref) {
    crumbItems.push({ href: catHref, label: cat });
  }
  crumbItems.push({ label: page.locale.title });
  const recipeBasePath = recipePathFor(page.locale.country, page.locale.lang, page.locale.slug);
  const cardSvgPath = `${recipeBasePath}/card.svg`;
  const ogSvgPath = `${recipeBasePath}/og.svg`;
  const saveMetaRecipe = {
    id: r.id,
    title: page.locale.title,
    slug: page.locale.slug,
    country: page.locale.country,
    lang: page.locale.lang,
    category: r.category,
    totalMinutes: r.totalMinutes,
    imageId: page.heroImage ? page.heroImage.url.split('/').pop() ?? null : null,
    imageStyle: page.heroImage?.style ?? null,
  };
  return (
    <main id="main" className="recipe-page">
      <Crumbs items={crumbItems} />
      <header className="recipe-header">
        {cat && catHref ? (
          <a className="recipe-eyebrow" href={catHref}>
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
        <SaveButton recipe={saveMetaRecipe} lang={lang} withLabel />
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
      {others.length > 0 || (cat && catHref) ? (
        <p className="langs">
          {cat && catHref ? (
            <a className="chip" href={catHref}>
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
          </div>
          {/* Secondary channels stay one tap away instead of a 13-button wall. */}
          <details className="share-more">
            <summary>{t.moreShareOptions}</summary>
            <div className="share-buttons">
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
          </details>
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
                    <div className="row-end-actions">
                      <SaveButton recipe={rel} lang={lang} />
                      <span className="related-arrow" aria-hidden="true">
                        <ArrowUpRightIcon />
                      </span>
                    </div>
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
// Phase 3: Server-rendered /search, category/collection/cuisine hubs, /saved
// ---------------------------------------------------------------------------

const SEARCH_LABELS: Record<string, {
  title: string; lead: string; placeholder: string; submit: string; apply: string;
  catLabel: string; anyOption: string; timeLabel: string; times: Record<TimeBucket, string>;
  dietLabel: string; diets: Record<DietTag, string>; cuisineLabel: string;
  diffLabel: string; diffs: Record<DifficultyLevel, string>;
  testedOnly: string; noOvenOnly: string;
  dietNote: string; closestNote: string;
  countOne: string; countMany: string; countZero: string;
  didYouMean: string; showUnfiltered: string;
  prev: string; next: string; pageOf: string;
}> = {
  en: {
    title: 'Search recipes',
    lead: 'Filter by category, cook time, diet, cuisine, difficulty, or stovetop method.',
    placeholder: 'Search by recipe name, ingredient, or cuisine…',
    submit: 'Search',
    apply: 'Apply filters',
    catLabel: 'Category',
    anyOption: 'Any',
    timeLabel: 'Total time',
    times: { '15': '≤ 15 min', '30': '≤ 30 min', '60': '≤ 1 hour', '60plus': 'Over 1 hour' },
    dietLabel: 'Diet (inferred)',
    diets: { vegetarian: 'Vegetarian', vegan: 'Vegan', 'gluten-free': 'Gluten-free', 'dairy-free': 'Dairy-free' },
    cuisineLabel: 'Cuisine',
    diffLabel: 'Effort',
    diffs: { easy: 'Easy', medium: 'Medium', project: 'Weekend project' },
    testedOnly: 'Kitchen-tested only',
    noOvenOnly: 'No oven needed',
    dietNote: 'Diet and no-oven labels are inferred from listed ingredients and steps. Always check ingredient lines for allergies.',
    closestNote: 'No exact match — closest title or category matches:',
    countOne: '1 recipe found',
    countMany: '{n} recipes found',
    countZero: "Nothing matches '{q}' with those filters.",
    didYouMean: 'Did you mean:',
    showUnfiltered: 'Show {n} matches across all filters',
    prev: 'Previous',
    next: 'Next',
    pageOf: 'Page {page} of {total}',
  },
  es: {
    title: 'Buscar recetas',
    lead: 'Filtra por categoría, tiempo, dieta, cocina, dificultad o preparación sin horno.',
    placeholder: 'Busca por nombre, ingrediente o cocina…',
    submit: 'Buscar',
    apply: 'Aplicar filtros',
    catLabel: 'Categoría',
    anyOption: 'Todas',
    timeLabel: 'Tiempo total',
    times: { '15': '≤ 15 min', '30': '≤ 30 min', '60': '≤ 1 hora', '60plus': 'Más de 1 hora' },
    dietLabel: 'Dieta (inferida)',
    diets: { vegetarian: 'Vegetariana', vegan: 'Vegana', 'gluten-free': 'Sin gluten', 'dairy-free': 'Sin lácteos' },
    cuisineLabel: 'Cocina',
    diffLabel: 'Dificultad',
    diffs: { easy: 'Fácil', medium: 'Media', project: 'De fin de semana' },
    testedOnly: 'Solo probadas en cocina',
    noOvenOnly: 'Sin horno',
    dietNote: 'Las etiquetas de dieta y sin horno se infieren de los ingredientes y pasos. Revisa cada ingrediente en caso de alergias.',
    closestNote: 'Sin coincidencias exactas — resultados más cercanos:',
    countOne: '1 receta encontrada',
    countMany: '{n} recetas encontradas',
    countZero: "Nada coincide con '{q}' y estos filtros.",
    didYouMean: 'Quizás quisiste decir:',
    showUnfiltered: 'Ver {n} resultados sin filtros',
    prev: 'Anterior',
    next: 'Siguiente',
    pageOf: 'Página {page} de {total}',
  },
  fr: {
    title: 'Rechercher une recette',
    lead: 'Filtrez par catégorie, durée, régime, cuisine, difficulté ou cuisson sans four.',
    placeholder: 'Chercher un plat, un ingrédient ou une cuisine…',
    submit: 'Chercher',
    apply: 'Appliquer',
    catLabel: 'Catégorie',
    anyOption: 'Toutes',
    timeLabel: 'Durée totale',
    times: { '15': '≤ 15 min', '30': '≤ 30 min', '60': '≤ 1 heure', '60plus': 'Plus d’1 heure' },
    dietLabel: 'Régime (déduit)',
    diets: { vegetarian: 'Végétarien', vegan: 'Végan', 'gluten-free': 'Sans gluten', 'dairy-free': 'Sans lactose' },
    cuisineLabel: 'Cuisine',
    diffLabel: 'Niveau',
    diffs: { easy: 'Facile', medium: 'Intermédiaire', project: 'Projet week-end' },
    testedOnly: 'Testées en cuisine uniquement',
    noOvenOnly: 'Sans four',
    dietNote: 'Les filtres de régime et sans four sont déduits des ingrédients et étapes. Vérifiez toujours chaque ligne en cas d’allergie.',
    closestNote: 'Aucune correspondance exacte — résultats les plus proches :',
    countOne: '1 recette trouvée',
    countMany: '{n} recettes trouvées',
    countZero: 'Aucune recette pour « {q} » avec ces filtres.',
    didYouMean: 'Vouliez-vous dire :',
    showUnfiltered: 'Voir {n} résultats sans filtres',
    prev: 'Précédent',
    next: 'Suivant',
    pageOf: 'Page {page} sur {total}',
  },
};

export function buildSearchHref(lang: string, query: SearchQuery): string {
  const params = new URLSearchParams();
  if (lang && lang !== 'en') params.set('lang', lang);
  if (query.q && query.q.trim()) params.set('q', query.q.trim());
  if (query.cat) params.set('cat', query.cat);
  if (query.time) params.set('time', query.time);
  if (query.diet) params.set('diet', query.diet);
  if (query.cuisine) params.set('cuisine', query.cuisine);
  if (query.difficulty) params.set('difficulty', query.difficulty);
  if (query.tested) params.set('tested', '1');
  if (query.method) params.set('method', query.method);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  const qsStr = params.toString();
  return qsStr ? `/search?${qsStr}` : '/search';
}

export interface SearchPageProps {
  lang: string;
  query: SearchQuery;
  result: SearchResult<RecipeRow>;
  cuisines: { slug: string; label: string; count: number }[];
  categories: string[];
  savedIds?: ReadonlySet<string>;
}

export function SearchPage({ lang, query, result, cuisines, categories, savedIds }: SearchPageProps) {
  const s = SEARCH_LABELS[lang] ?? SEARCH_LABELS.en!;
  const t = uiStrings(lang);
  const d = DISCOVERY[lang] ?? DISCOVERY.en!;
  const lq = langQuery(lang);
  const pills: { label: string; removeHref: string }[] = [];
  if (query.cat) {
    pills.push({ label: `${s.catLabel}: ${categoryLabel(query.cat, lang) ?? query.cat}`, removeHref: buildSearchHref(lang, { ...query, cat: null, page: 1 }) });
  }
  if (query.time) {
    pills.push({ label: `${s.timeLabel}: ${s.times[query.time]}`, removeHref: buildSearchHref(lang, { ...query, time: null, page: 1 }) });
  }
  if (query.diet) {
    pills.push({ label: s.diets[query.diet], removeHref: buildSearchHref(lang, { ...query, diet: null, page: 1 }) });
  }
  if (query.cuisine) {
    const cLabel = cuisines.find((c) => c.slug === query.cuisine)?.label ?? query.cuisine;
    pills.push({ label: `${s.cuisineLabel}: ${cLabel}`, removeHref: buildSearchHref(lang, { ...query, cuisine: null, page: 1 }) });
  }
  if (query.difficulty) {
    pills.push({ label: `${s.diffLabel}: ${s.diffs[query.difficulty]}`, removeHref: buildSearchHref(lang, { ...query, difficulty: null, page: 1 }) });
  }
  if (query.method === 'no-oven') {
    pills.push({ label: s.noOvenOnly, removeHref: buildSearchHref(lang, { ...query, method: null, page: 1 }) });
  }
  if (query.tested) {
    pills.push({ label: s.testedOnly, removeHref: buildSearchHref(lang, { ...query, tested: false, page: 1 }) });
  }
  const hasFiltersOrQ = pills.length > 0 || Boolean(query.q?.trim());
  const countText = result.total === 1 ? s.countOne : s.countMany.replace('{n}', String(result.total));
  const emptyText = query.q?.trim() ? s.countZero.replace('{q}', query.q.trim()) : d.empty;

  return (
    <main className="wide discovery" id="main">
      <section className="discovery-index search-page">
        <Crumbs items={[{ href: `/${lq}`, label: t.home }, { label: s.title }]} />
        <div className="index-heading">
          <h1>{s.title}</h1>
          <p>{s.lead}</p>
        </div>
        <form className="search-page-form" action="/search" method="get" role="search" data-search-page-form>
          {lang !== 'en' ? <input type="hidden" name="lang" value={lang} /> : null}
          <div className="search-main-row">
            <label className="visually-hidden" htmlFor="sp-q">{s.title}</label>
            <SocialIcon name="search" className="social-icon search-bar-icon" />
            <input
              id="sp-q"
              type="search"
              name="q"
              defaultValue={query.q ?? ''}
              placeholder={s.placeholder}
              autoComplete="off"
              enterKeyHint="search"
            />
            <button type="submit">{s.submit}</button>
          </div>
          <div className="search-filters" role="group" aria-label={t.filtersHeading}>
            <label>
              <span>{s.catLabel}</span>
              <select name="cat" defaultValue={query.cat ?? ''}>
                <option value="">{s.anyOption}</option>
                {(categories.length ? categories : [...RECIPE_CATEGORY_SLUGS]).map((slug) => (
                  <option key={slug} value={slug}>{categoryLabel(slug, lang) ?? slug}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{s.timeLabel}</span>
              <select name="time" defaultValue={query.time ?? ''}>
                <option value="">{s.anyOption}</option>
                {TIME_BUCKETS.map((b) => (
                  <option key={b} value={b}>{s.times[b]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{s.dietLabel}</span>
              <select name="diet" defaultValue={query.diet ?? ''}>
                <option value="">{s.anyOption}</option>
                {DIET_TAGS.map((tag) => (
                  <option key={tag} value={tag}>{s.diets[tag]}</option>
                ))}
              </select>
            </label>
            {cuisines.length > 0 ? (
              <label>
                <span>{s.cuisineLabel}</span>
                <select name="cuisine" defaultValue={query.cuisine ?? ''}>
                  <option value="">{s.anyOption}</option>
                  {cuisines.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.label} ({c.count})</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              <span>{s.diffLabel}</span>
              <select name="difficulty" defaultValue={query.difficulty ?? ''}>
                <option value="">{s.anyOption}</option>
                {DIFFICULTY_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{s.diffs[lvl]}</option>
                ))}
              </select>
            </label>
            <label className="filter-check">
              <input type="checkbox" name="method" value="no-oven" defaultChecked={query.method === 'no-oven'} />
              <span>{s.noOvenOnly}</span>
            </label>
            <label className="filter-check">
              <input type="checkbox" name="tested" value="1" defaultChecked={Boolean(query.tested)} />
              <span>{s.testedOnly}</span>
            </label>
            <button type="submit" className="apply-filters-btn">{s.apply}</button>
          </div>
        </form>
        {pills.length > 0 || hasFiltersOrQ ? (
          <div className="filter-pills">
            {pills.map((p) => (
              <a key={p.label} className="chip active-filter-chip" href={p.removeHref}>
                {p.label} <span aria-hidden="true">×</span>
              </a>
            ))}
            {hasFiltersOrQ ? (
              <a className="chip clear-filters-link" href={`/search${lq}`}>{t.clearFilters}</a>
            ) : null}
          </div>
        ) : null}
        {(query.diet || query.method === 'no-oven') ? (
          <p className="inferred-note" role="note">{s.dietNote}</p>
        ) : null}
        <div className="search-results-bar">
          <p className="search-count" role="status" aria-live="polite">{countText}</p>
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
        {result.usedFuzzy && result.total > 0 ? (
          <p className="closest-match-note">{s.closestNote}</p>
        ) : null}
        {result.items.length > 0 ? (
          <ul className="discovery-list" data-recipe-list>
            {result.items.map((r, i) => (
              <DiscoveryRowCard
                key={r.id}
                recipe={r}
                index={(result.page - 1) * result.pageSize + i}
                lang={lang}
                numbered
                savedIds={savedIds}
              />
            ))}
          </ul>
        ) : (
          <div className="empty-note empty-search-card">
            <EmptySkilletIllustration />
            <p>{emptyText}</p>
            {result.unfilteredCount > 0 && query.q ? (
              <p>
                <a className="btn-clear" href={buildSearchHref(lang, { q: query.q })}>
                  {s.showUnfiltered.replace('{n}', String(result.unfilteredCount))}
                </a>
              </p>
            ) : null}
            {result.suggestions.length > 0 ? (
              <div>
                <p className="suggestions-heading">{s.didYouMean}</p>
                <ul className="suggestions-list">
                  {result.suggestions.map((sug) => (
                    <li key={sug.id}>
                      <a href={recipePathFor(sug.country, sug.lang, sug.slug)}>{sug.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="empty-actions">
              <a className="btn-clear" href={`/search${lq}`}>{t.clearFilters}</a>
              <a className="empty-share-link" href={`/account/recipes/new${lq}`}>
                <SocialIcon name="plus" />
                {t.emptyShareCta}
              </a>
            </div>
          </div>
        )}
        {result.totalPages > 1 ? (
          <nav className="pagination" aria-label={s.title}>
            {result.page > 1 ? (
              <a className="chip" href={buildSearchHref(lang, { ...query, page: result.page - 1 })}>&larr; {s.prev}</a>
            ) : <span />}
            <span className="pagination-info">{s.pageOf.replace('{page}', String(result.page)).replace('{total}', String(result.totalPages))}</span>
            {result.page < result.totalPages ? (
              <a className="chip" href={buildSearchHref(lang, { ...query, page: result.page + 1 })}>{s.next} &rarr;</a>
            ) : <span />}
          </nav>
        ) : null}
      </section>
    </main>
  );
}

export interface HubPageProps {
  kind: 'category' | 'collection' | 'cuisine';
  slug: string;
  lang: string;
  title: string;
  intro: string;
  iconSlug?: string | null;
  heroImage?: { id: string; style: 'photo' | 'illustration' | 'graphic'; alt: string } | null;
  marketHref?: string | null;
  marketLabel?: string | null;
  recipes: RecipeRow[];
  searchHref: string;
  relatedHubs: { href: string; label: string; count?: number }[];
  savedIds?: ReadonlySet<string>;
}

export function HubPage({
  kind,
  lang,
  title,
  intro,
  iconSlug,
  heroImage,
  marketHref,
  marketLabel,
  recipes,
  searchHref,
  relatedHubs,
  savedIds,
}: HubPageProps) {
  const t = uiStrings(lang);
  const d = DISCOVERY[lang] ?? DISCOVERY.en!;
  const lq = langQuery(lang);
  const parentCrumb =
    kind === 'collection'
      ? { href: `/collections${lq}`, label: t.collectionsNav }
      : kind === 'cuisine'
        ? { href: `/cuisine${lq}`, label: t.cuisinesNav }
        : { href: `/recipes${lq}`, label: t.allRecipes };
  return (
    <main className="wide discovery" id="main">
      <section className="discovery-index">
        <Crumbs items={[{ href: `/${lq}`, label: t.home }, parentCrumb, { label: title }]} />
        <header className="hub-hero">
          <div className="hub-hero-copy">
            <span className="eyebrow">
              {iconSlug ? <CategoryIcon slug={iconSlug} /> : null}
              {parentCrumb.label}
            </span>
            <h1>{title}</h1>
            <p className="hub-intro">{intro}</p>
            <div className="hub-actions">
              <a className="chip" href={searchHref}>
                <SocialIcon name="filter" />
                {t.filtersHeading}
              </a>
              {marketHref && marketLabel ? (
                <a className="chip" href={marketHref}>
                  {marketLabel}
                  <ArrowUpRightIcon />
                </a>
              ) : null}
            </div>
          </div>
          {heroImage && asImageStyle(heroImage.style) ? (
            <figure className="hub-hero-media">
              <img src={`/img/recipe/${heroImage.id}`} alt={heroImage.alt} width="480" height="320" />
              <figcaption>
                {heroImage.style === 'illustration'
                  ? t.imageLabelIllustration
                  : heroImage.style === 'graphic'
                    ? t.imageLabelGraphic
                    : t.imageLabelPhoto}
              </figcaption>
            </figure>
          ) : null}
        </header>
        {relatedHubs.length > 0 ? (
          <nav className="cat-nav hub-related-nav" aria-label={parentCrumb.label}>
            {relatedHubs.map((h) => (
              <a key={h.href} className="chip" href={h.href}>
                {h.label}{h.count != null ? ` (${h.count})` : ''}
              </a>
            ))}
          </nav>
        ) : null}
        <div className="search-results-bar">
          <p className="search-count">{recipes.length} {recipes.length === 1 ? t.recipeWord : t.recipesWord}</p>
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
        {recipes.length > 0 ? (
          <ul className="discovery-list" data-recipe-list>
            {recipes.map((r, i) => (
              <DiscoveryRowCard key={r.id} recipe={r} index={i} lang={lang} numbered savedIds={savedIds} />
            ))}
          </ul>
        ) : (
          <div className="empty-note empty-search-card">
            <EmptySkilletIllustration />
            <p>{t.emptyCategory}</p>
            <div className="empty-actions">
              <a className="empty-share-link" href={`/account/recipes/new${lq}`}>
                <SocialIcon name="plus" />
                {t.emptyShareCta}
              </a>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export interface HubDirectoryItem {
  slug: string;
  href: string;
  label: string;
  description: string;
  count: number;
  iconSlug?: string | null;
}

export function HubDirectoryPage({
  lang,
  title,
  intro,
  items,
}: {
  kind: 'collections' | 'cuisine';
  lang: string;
  title: string;
  intro: string;
  items: HubDirectoryItem[];
}) {
  const t = uiStrings(lang);
  const lq = langQuery(lang);
  return (
    <main className="wide discovery" id="main">
      <section className="discovery-index">
        <Crumbs items={[{ href: `/${lq}`, label: t.home }, { label: title }]} />
        <div className="index-heading">
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
        <ul className="hub-directory-grid">
          {items.map((it) => (
            <li key={it.slug} className="hub-directory-card">
              <span className="eyebrow">
                {it.iconSlug ? <CategoryIcon slug={it.iconSlug} /> : null}
                {it.count} {it.count === 1 ? t.recipeWord : t.recipesWord}
              </span>
              <h2>
                <a className="stretched" href={it.href}>{it.label}</a>
              </h2>
              <p>{it.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

const SAVED_COPY: Record<string, {
  title: string; leadAnon: string; leadSigned: string; syncPrompt: string; syncCta: string;
  savedHeading: string; emptySaved: string; browseCta: string; removeLabel: string;
  recentEmpty: string;
}> = {
  en: {
    title: 'Saved recipes',
    leadAnon: 'Recipes you tap with ♥ stay here on this browser even without an account.',
    leadSigned: 'Signed in as {email}. Your saved recipes sync across devices.',
    syncPrompt: 'Connect an email in My recipes to keep your saved list across devices.',
    syncCta: 'Connect email to sync',
    savedHeading: 'Saved bookmarks',
    emptySaved: 'No saved recipes yet. Tap the ♥ heart on any recipe to bookmark it for later.',
    browseCta: 'Browse recipes',
    removeLabel: 'Remove',
    recentEmpty: 'Recipes you open appear here automatically for quick backtracking while cooking.',
  },
  es: {
    title: 'Recetas guardadas',
    leadAnon: 'Las recetas que marques con ♥ se guardan en este navegador incluso sin cuenta.',
    leadSigned: 'Sesión iniciada como {email}. Tus recetas guardadas se sincronizan entre dispositivos.',
    syncPrompt: 'Conecta un correo en Mis recetas para conservar tu lista en otros dispositivos.',
    syncCta: 'Conectar correo para sincronizar',
    savedHeading: 'Marcadas con ♥',
    emptySaved: 'Aún no tienes recetas guardadas. Toca el ♥ en cualquier receta para guardarla.',
    browseCta: 'Explorar recetas',
    removeLabel: 'Quitar',
    recentEmpty: 'Las recetas que abras aparecerán aquí para volver rápido mientras cocinas.',
  },
  fr: {
    title: 'Recettes enregistrées',
    leadAnon: 'Les recettes marquées d’un ♥ restent ici dans ce navigateur, même sans compte.',
    leadSigned: 'Connecté en tant que {email}. Vos recettes enregistrées sont synchronisées sur vos appareils.',
    syncPrompt: 'Reliez votre e-mail dans Mes recettes pour retrouver vos favoris sur tous vos appareils.',
    syncCta: 'Relier un e-mail',
    savedHeading: 'Favoris ♥',
    emptySaved: 'Aucune recette enregistrée pour le moment. Touchez ♥ sur n’importe quelle recette pour la garder.',
    browseCta: 'Explorer les recettes',
    removeLabel: 'Retirer',
    recentEmpty: 'Les recettes que vous ouvrez s’affichent ici pour y revenir vite pendant la cuisine.',
  },
};

export function SavedPage({
  lang,
  signedIn,
  userEmail,
  recipes,
  savedIds,
}: {
  lang: string;
  signedIn: boolean;
  userEmail?: string | null;
  recipes: RecipeRow[];
  savedIds: string[];
}) {
  const c = SAVED_COPY[lang] ?? SAVED_COPY.en!;
  const t = uiStrings(lang);
  const lq = langQuery(lang);
  const savedSet = new Set(savedIds);
  return (
    <main className="wide discovery" id="main" data-saved-page data-signed-in={signedIn ? '1' : '0'}>
      <section className="discovery-index">
        <Crumbs items={[{ href: `/${lq}`, label: t.home }, { label: c.title }]} />
        <div className="index-heading">
          <h1>{c.title}</h1>
          <p>{signedIn && userEmail ? c.leadSigned.replace('{email}', userEmail) : c.leadAnon}</p>
        </div>
        {!signedIn ? (
          <div className="saved-sync-banner" data-sync-banner>
            <p>{c.syncPrompt}</p>
            <a className="discovery-cta-secondary" href={`/account${lq ? `${lq}&next=%2Fsaved` : '?next=%2Fsaved'}`}>
              {c.syncCta}
            </a>
          </div>
        ) : null}
        <section className="saved-section">
          <h2>{c.savedHeading}</h2>
          {signedIn ? (
            recipes.length > 0 ? (
              <ul className="discovery-list" data-recipe-list data-saved-server-list>
                {recipes.map((r, i) => (
                  <DiscoveryRowCard key={r.id} recipe={r} index={i} lang={lang} numbered savedIds={savedSet} />
                ))}
              </ul>
            ) : (
              <div className="empty-note empty-search-card">
                <EmptySkilletIllustration />
                <p>{c.emptySaved}</p>
                <div className="empty-actions">
                  <a className="empty-share-link" href={`/search${lq}`}>{c.browseCta}</a>
                </div>
              </div>
            )
          ) : (
            <div data-saved-local-root data-empty-text={c.emptySaved} data-browse-href={`/search${lq}`} data-browse-label={c.browseCta} data-remove-label={c.removeLabel}>
              <div className="empty-note empty-search-card">
                <EmptySkilletIllustration />
                <p>{c.emptySaved}</p>
                <div className="empty-actions">
                  <a className="empty-share-link" href={`/search${lq}`}>{c.browseCta}</a>
                </div>
              </div>
            </div>
          )}
        </section>
        <section className="saved-section recent-section">
          <h2>{t.recentlyViewed}</h2>
          <div data-recent-local-root data-empty-text={c.recentEmpty}>
            <p className="empty-note">{c.recentEmpty}</p>
          </div>
        </section>
      </section>
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
        <p>No necesitas iniciar sesi&oacute;n para leer recetas y leer no usa cookies. Si cambias entre unidades de EE. UU. y m&eacute;tricas, eliges tema claro/oscuro, guardas recetas favoritas o abres recetas recientes sin cuenta, tus preferencias se guardan solo en tu propio navegador (almacenamiento local, claves &quot;2y-units&quot;, &quot;2y-theme&quot;, &quot;2y-saved&quot;, &quot;2y-recent&quot; y &quot;2y-recent-q&quot;). Se quedan en tu dispositivo y no se env&iacute;an hasta que inicies sesi&oacute;n y elijas sincronizarlas.</p>
        <p>Si creas una cuenta para enviar o sincronizar recetas, guardamos tu correo electr&oacute;nico, el nombre de autor que elijas, tus recetas marcadas como guardadas y los borradores que guardes. Para iniciar sesi&oacute;n enviamos un c&oacute;digo de 6 d&iacute;gitos a tu correo mediante el servicio Resend; el c&oacute;digo se guarda solo como hash. Al iniciar sesi&oacute;n se usa una cookie de sesi&oacute;n (&quot;__Host-2y_sid&quot;, HttpOnly, hasta 30 d&iacute;as) que te mantiene conectado en ese navegador, y solo guardamos un hash de su valor. Los borradores son privados hasta que los env&iacute;es para revisi&oacute;n. Nada de lo que env&iacute;es se publica autom&aacute;ticamente. Si subes una foto opcional del plato, se redimensiona en tu dispositivo para quitar metadatos de ubicaci&oacute;n, se guarda de forma privada junto al borrador, solo se publica tras revisi&oacute;n y aprobaci&oacute;n expl&iacute;cita, y se elimina cuando la quitas o borras el borrador.</p>
        <p>Cuando una b&uacute;squeda de recetas no encuentra nada, guardamos las palabras buscadas, el idioma de la p&aacute;gina y la hora (sin cuenta, direcci&oacute;n IP ni cookie) para saber qu&eacute; recetas faltan. Mientras escribes una receta, una copia sin guardar y tu elecci&oacute;n de vista de lista o tarjetas tambi&eacute;n pueden quedar en el almacenamiento local de tu navegador para no perder nada si la p&aacute;gina se recarga; esa copia se queda en tu dispositivo.</p>
        <p>Medimos visitas y velocidad de p&aacute;gina con Cloudflare Web Analytics. Seg&uacute;n Cloudflare, este servicio de anal&iacute;tica no usa cookies ni almacenamiento local, no identifica a los visitantes y no recopila datos personales para estad&iacute;sticas.</p>
      </main>
    );
  }
  if (lang === 'fr') {
    return (
      <main id="main">
        <h1>Confidentialit&eacute;</h1>
        <p>Vous n&apos;avez pas besoin de vous connecter pour lire les recettes, et la lecture ne d&eacute;pose aucun cookie. Si vous changez d&apos;unit&eacute;s, de th&egrave;me clair/sombre, enregistrez des recettes en favoris ou consultez votre historique r&eacute;cent sans compte, ces donn&eacute;es restent dans le stockage local de votre navigateur (&laquo; 2y-units &raquo;, &laquo; 2y-theme &raquo;, &laquo; 2y-saved &raquo;, &laquo; 2y-recent &raquo;, &laquo; 2y-recent-q &raquo;).</p>
        <p>Si vous cr&eacute;ez un compte pour proposer ou synchroniser des recettes, nous conservons votre adresse e-mail, le nom d&apos;auteur choisi, vos favoris enregistr&eacute;s et vos brouillons priv&eacute;s. La connexion utilise un code &agrave; 6 chiffres envoy&eacute; via Resend (stock&eacute; uniquement sous forme de hachage) et un cookie de session (&laquo; __Host-2y_sid &raquo;, HttpOnly, 30 jours maximum). Rien de ce que vous envoyez n&apos;est publi&eacute; automatiquement. Si vous ajoutez une photo facultative du plat, elle est redimensionn&eacute;e sur votre appareil pour retirer les m&eacute;tadonn&eacute;es de localisation, conserv&eacute;e en priv&eacute; avec votre brouillon, publi&eacute;e uniquement apr&egrave;s examen et approbation explicite, et supprim&eacute;e si vous la retirez ou effacez le brouillon.</p>
        <p>Quand une recherche de recette ne trouve rien, nous enregistrons les mots cherch&eacute;s, la langue de la page et l&apos;heure (sans compte, adresse IP ni cookie) pour savoir quelles recettes manquent. Pendant que vous r&eacute;digez une recette, une copie non enregistr&eacute;e et votre choix d&apos;affichage liste ou cartes peuvent aussi rester dans le stockage local de votre navigateur, pour ne rien perdre si la page se recharge ; cette copie reste sur votre appareil.</p>
        <p>Nous mesurons les pages vues et la vitesse avec Cloudflare Web Analytics, un service sans cookies ni suivi individuel.</p>
      </main>
    );
  }
  return (
    <main id="main">
      <h1>Privacy</h1>
      <p>You do not need to sign in to read recipes, and reading sets no cookies. If you switch between US and metric units, choose a light/dark theme, bookmark recipes, or view recent searches and recipes without an account, that state stays in your own browser (local storage, keys &quot;2y-units&quot;, &quot;2y-theme&quot;, &quot;2y-saved&quot;, &quot;2y-recent&quot;, and &quot;2y-recent-q&quot;). It stays on your device and is never sent to us unless you sign in and sync saved bookmarks.</p>
      <p>If you create an account to send in a recipe or sync bookmarks, we store your email address, the author name you choose, your saved recipe bookmarks, and the recipe drafts you save. Signing in uses a 6-digit code sent to your email through the email service Resend; the code is stored only as a hash. Signing in sets one session cookie (&quot;__Host-2y_sid&quot;, HttpOnly, up to 30 days) that keeps you signed in on that browser, and we store only a hash of its value. Signing out ends that session. Drafts are private to you until you send one in for review. Nothing you send in is published automatically. If you attach an optional dish photo to a draft, it is resized on your device to strip camera metadata, stored privately with the draft, published only after explicit review approval, and deleted when you remove it or delete the draft.</p>
      <p>When a recipe search finds nothing, we record the search words, the page language and the time (no account, IP address or cookie) so we know which recipes people are missing. While you write a recipe, an unsaved copy and your list or card view choice can also be kept in your browser&apos;s local storage so nothing is lost if the page reloads; that copy stays on your device.</p>
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
