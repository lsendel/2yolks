import type { RecipePage } from '@2yolks/contracts';
import type { IngredientEntry } from '@2yolks/contracts';
import { SCALE_MULTIPLIERS, defaultUnitSystem, renderIngredient, renderStep, ingredientVariants, stepVariants, isConvertible, hasStepTokens, countryPath, recipePathFor, uiStrings, parseIngredient, scalingIsSafe, isUntested, COUNTRY_INTROS, defaultLocale, categoryLabel } from '@2yolks/contracts';

// ---------------------------------------------------------------------------
// Site chrome
// ---------------------------------------------------------------------------

export interface SiteNavItem {
  href: string;
  label: string;
  current?: boolean;
}

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

export function SiteHeader({ nav = [], lang = 'en' }: { nav?: SiteNavItem[]; lang?: string }) {
  const t = uiStrings(lang);
  return (
    <header className="site-header">
      <a className="skip" href="#main">
        {t.skipToContent}
      </a>
      <div className="header-inner">
        <a className="brand" href="/">
          <BrandMark />
          <span className="brand-word">2yolks</span>
        </a>
        {nav.length > 0 ? (
          <nav className="site-nav" aria-label="Site">
            {nav.map((item) => (
              <a key={item.href} href={item.href} aria-current={item.current ? 'page' : undefined}>
                {item.label}
              </a>
            ))}
            <a href="/how-we-test">{t.testingShort}</a>
          </nav>
        ) : null}
      </div>
    </header>
  );
}

export function SiteFooter({ nav = [], lang = 'en' }: { nav?: SiteNavItem[]; lang?: string }) {
  const t = uiStrings(lang);
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand-col">
          <a className="brand" href="/">
            <BrandMark />
            <span className="brand-word">2yolks</span>
          </a>
          <p className="footer-note">{t.tagline}</p>
        </div>
        {nav.length > 0 ? (
          <nav className="footer-col" aria-label={t.browseByCountry}>
            <h4>{t.browseByCountry}</h4>
            {nav.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}
        <nav className="footer-col" aria-label="2yolks">
          <h4>2yolks</h4>
          <a href="/about">About / Acerca de</a>
          <a href="/how-we-test">How we test / C&oacute;mo probamos</a>
          <a href="/privacy">Privacy / Privacidad</a>
        </nav>
      </div>
      <p className="footer-fine">
        No invented ratings or reviews: a recipe is &quot;tested&quot; only after someone cooks it. / Sin rese&ntilde;as
        inventadas: una receta solo es &quot;probada&quot; cuando alguien la cocina.
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
        <a className="stretched" href={recipePathFor(country, primary.lang, primary.id, primary.slug)}>
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
        {primary.untested ? <span className="badge">{t.untestedBadge}</span> : null}
      </p>
      {others.length > 0 ? (
        <p className="chips">
          {others.map((o) => (
            <a key={o.lang} className="chip" hrefLang={o.lang} href={recipePathFor(country, o.lang, o.id, o.slug)}>
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
}

export function Home({ locales, recipes }: HomeProps) {
  const t = uiStrings('en');
  // One entry per country that has at least one listed locale.
  const countries: { code: string; name: string; langs: string[] }[] = [];
  for (const l of locales) {
    const c = countries.find((x) => x.code === l.country);
    if (c) c.langs.push(l.lang);
    else countries.push({ code: l.country, name: l.countryName, langs: [l.lang] });
  }
  const countryNames = countries.map((c) => c.name).join(' and ');
  const langNames = [...new Set(locales.map((l) => LANG_NAMES[l.lang] ?? l.lang))].join(', ');
  return (
    <main className="wide" id="main">
      <section className="hero">
        <div className="hero-text">
          <h1>{t.tagline}</h1>
          <p className="lede">
            Recipes from {countryNames || 'around the world'}, in {langNames}. Every recipe carries an honest label:
            tested, or not yet tested.
          </p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <BrandMark large />
        </div>
      </section>
      <section className="section">
        <h2>{t.browseByCountry}</h2>
        <ul className="country-grid">
          {countries.map((c) => {
            const n = recipes.filter((r) => r.country === c.code && r.lang === defaultLocale(c.code)).length;
            return (
              <li key={c.code}>
                <a className="country-card" href={countryPath(c.code)}>
                  <h3>{c.name}</h3>
                  <p className="meta">
                    {n} {n === 1 ? t.recipeWord : t.recipesWord} · {c.langs.map((l) => LANG_NAMES[l] ?? l).join(' · ')}
                  </p>
                  <span className="go" aria-hidden="true">
                    &rarr;
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="section">
        <h2>{t.allRecipes}</h2>
        {countries.map((c) => {
          const groups = groupRecipes(recipes, c.code);
          if (groups.length === 0) return null;
          return (
            <div className="country-block" key={c.code}>
              <h3 className="country-block-head">
                <a href={countryPath(c.code)}>{c.name}</a>
              </h3>
              <ul className="recipe-grid">
                {groups.map((g) => (
                  <RecipeCard key={g.primary.id} group={g} country={c.code} pageLang="en" />
                ))}
              </ul>
            </div>
          );
        })}
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

export function CountryHome({ countryName, country, recipes, categories = [], activeCategory = null }: CountryHomeProps) {
  const intro = COUNTRY_INTROS[country];
  const pageLang = intro?.lang ?? defaultLocale(country) ?? 'en';
  const t = uiStrings(pageLang);
  const groups = groupRecipes(recipes, country);
  return (
    <main className="wide" id="main">
      <Crumbs items={[{ href: '/', label: t.home }, { label: countryName }]} />
      <header className="page-head">
        <h1>{countryName}</h1>
        {intro ? (
          <p className="lede" lang={intro.lang}>
            {intro.text}
          </p>
        ) : null}
      </header>
      {categories.length > 0 ? (
        <nav className="cat-nav" aria-label={t.categories}>
          <a className="chip" aria-current={activeCategory === null ? 'page' : undefined} href={countryPath(country)}>
            {t.allCategories}
          </a>
          {categories.map((slug) => (
            <a
              key={slug}
              className="chip"
              aria-current={activeCategory === slug ? 'page' : undefined}
              href={countryPath(country) + '?cat=' + slug}
            >
              {categoryLabel(slug, pageLang)}
            </a>
          ))}
        </nav>
      ) : null}
      {groups.length > 0 ? (
        <ul className="recipe-grid">
          {groups.map((g) => (
            <RecipeCard key={g.primary.id} group={g} country={country} pageLang={pageLang} />
          ))}
        </ul>
      ) : (
        <p className="empty-note">{t.emptyCategory}</p>
      )}
      <p className="langs">
        <a href="/how-we-test">{t.howWeTest}</a>
      </p>
    </main>
  );
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
    { key: 'email', label: '', href: `mailto:?subject=${t}&body=${u}` },
  ];
  if (imageUrl) {
    links.splice(1, 0, { key: 'pinterest', label: 'Pinterest', href: `https://www.pinterest.com/pin/create/button/?url=${u}&media=${encodeURIComponent(imageUrl)}&description=${t}` });
  }
  return links;
}

export function RecipeView({
  page,
  alternates = [],
  canonicalUrl,
  imageUrl,
  countryName,
}: {
  page: RecipePage;
  alternates?: { hreflang: string; href: string }[];
  canonicalUrl?: string;
  imageUrl?: string | null;
  countryName?: string;
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
  return (
    <main id="main">
      <Crumbs
        items={[
          { href: '/', label: t.home },
          { href: countryPath(page.locale.country), label: countryName ?? page.locale.country.toUpperCase() },
          { label: page.locale.title },
        ]}
      />
      <h1>{page.locale.title}</h1>
      {isUntested(page.recipe) ? (
        <p className="untested" role="note">
          <span className="badge">{t.untestedBadge}</span> {t.untestedNote}{' '}
          <a href="/how-we-test">{t.howWeTest}</a>
        </p>
      ) : null}
      {page.locale.translationOf && page.locale.translationMethod === 'machine' && page.locale.translationReviewerKind !== 'human' ? (
        <p className="machine-note" role="note">
          <span className="badge">{page.locale.lang === 'es' ? 'Traducci\u00f3n autom\u00e1tica' : page.locale.lang === 'fr' ? 'Traduction automatique' : 'Machine-translated'}</span> {t.machineNote}
        </p>
      ) : null}
      {others.length > 0 || cat ? (
        <p className="langs">
          {cat ? (
            <a className="chip" href={countryPath(page.locale.country) + '?cat=' + page.recipe.category}>
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
      <p className="recipe-actions">
        <a href="#recipe" className="jump">
          {t.jumpToRecipe} &darr;
        </a>
        <button type="button" className="print-open" data-print-open>
          {t.print}
        </button>
        <button type="button" className="cook-open" data-cook-open>
          {t.cookMode}
        </button>
      </p>
      {page.locale.intro ? <p className="recipe-intro">{page.locale.intro}</p> : null}
      <section id="recipe">
        <h2>{t.ingredients}</h2>
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
        <h2>{t.steps}</h2>
        <ol className="steps">
          {steps.map((st, i) => (
            <li key={i} data-v={hasStepTokens([st]) ? JSON.stringify(stepVariants(st, entries, lang, mults)) : undefined}>
              {renderStep(st, entries, lang, sys, 1)}
            </li>
          ))}
        </ol>
      </section>
      {canonicalUrl ? (
        <nav className="share" aria-label={t.share} data-share-url={canonicalUrl} data-share-title={page.locale.title}>
          <span className="share-label">{t.share}:</span>
          <button type="button" className="share-native" data-share-native hidden>{t.share}</button>
          <button type="button" className="share-copy" data-share-copy data-copied={t.linkCopied}>{t.copyLink}</button>
          {shareLinks(canonicalUrl, page.locale.title, imageUrl).map((l) => (
            <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer">{l.label || t.shareEmail}</a>
          ))}
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
      <div className="cook-mode" data-cook-mode hidden>
        <div className="cook-inner">
          <div className="cook-top">
            <span className="cook-progress" data-cook-progress />
            <button type="button" className="cook-close" data-cook-close>
              {t.exitCookMode}
            </button>
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
// Static pages (content unchanged; chrome comes from the shell)
// ---------------------------------------------------------------------------

export function PrivacyView() {
  return (
    <main id="main">
      <h1>Privacy</h1>
      <p>You do not need to sign in to read recipes, and 2yolks sets no cookies. If you switch between US and metric units, your choice is saved in your own browser (local storage, key &quot;2y-units&quot;) so the page remembers it. It stays on your device and is not sent to us.</p>
      <p>We measure page views and page speed with Cloudflare Web Analytics. Per Cloudflare, this analytics service does not use cookies or local storage, does not fingerprint visitors, and does not collect personal data for analytics. We use the counts only to see which pages people read.</p>
      <h2>Privacidad</h2>
      <p>No necesitas iniciar sesi&oacute;n para leer recetas y 2yolks no usa cookies. Si cambias entre unidades de EE. UU. y m&eacute;tricas, tu elecci&oacute;n se guarda en tu propio navegador (almacenamiento local, clave &quot;2y-units&quot;) para recordarla. Se queda en tu dispositivo y no se nos env&iacute;a.</p>
      <p>Medimos visitas y velocidad de p&aacute;gina con Cloudflare Web Analytics. Seg&uacute;n Cloudflare, este servicio de anal&iacute;tica no usa cookies ni almacenamiento local, no identifica a los visitantes y no recopila datos personales para estad&iacute;sticas.</p>
    </main>
  );
}

export function AboutView() {
  return (
    <main id="main">
      <h1>About 2yolks</h1>
      <p>2yolks is an international recipe site. We start with the United States (English) and Mexico (Spanish) and add countries as the first two are done well.</p>
      <p>Recipes are written for 2yolks in our own words, from standard, widely documented techniques. We do not copy text or photos from other sites. A recipe is only shown when its source has been cleared for use.</p>
      <p>Right now every recipe is labeled not yet tested. We will say so until a person cooks it and signs it off. <a href="/how-we-test">How we test and label recipes</a>.</p>
      <h2>Acerca de 2yolks</h2>
      <p>2yolks es un sitio de recetas internacionales. Empezamos con Estados Unidos (ingl&eacute;s) y M&eacute;xico (espa&ntilde;ol). Escribimos las recetas con nuestras propias palabras y las marcamos como "a&uacute;n no probada" hasta que alguien las cocine.</p>
    </main>
  );
}

export function HowWeTestView() {
  return (
    <main id="main">
      <h1>How we test and label recipes</h1>
      <p>Every recipe on 2yolks carries one of two labels.</p>
      <ul>
        <li><strong>Not yet tested.</strong> Written from standard techniques and checked against food-safety guidance (for example USDA safe minimum temperatures). Nobody has cooked it for 2yolks yet, so times and yields are estimates.</li>
        <li><strong>Tested.</strong> A person cooked it, recorded the real yield and time, and noted changes. We show the date. No recipe has this label yet.</li>
      </ul>
      <p>We never invent ratings, reviews or testing. If a recipe has not been cooked, we say so.</p>
      <h2>C&oacute;mo probamos y etiquetamos las recetas</h2>
      <p>Cada receta es <strong>&quot;A&uacute;n no probada&quot;</strong> (escrita con t&eacute;cnicas est&aacute;ndar y revisada contra gu&iacute;as de seguridad alimentaria; tiempos y rendimientos son estimados) o <strong>&quot;Probada&quot;</strong> (alguien la cocin&oacute; y registr&oacute; rendimiento, tiempo y cambios, con fecha). Hoy ninguna tiene la etiqueta &quot;Probada&quot;.</p>
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
