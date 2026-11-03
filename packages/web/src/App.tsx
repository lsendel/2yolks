import type { RecipePage } from '@2yolks/contracts';
import type { IngredientEntry } from '@2yolks/contracts';
import { SCALE_MULTIPLIERS, defaultUnitSystem, renderIngredient, renderStep, ingredientVariants, stepVariants, isConvertible, hasStepTokens, countryPath, recipePath, recipePathFor, uiStrings, parseIngredient, formatQty, scalingIsSafe, isUntested, COUNTRY_INTROS, defaultLocale } from '@2yolks/contracts';

export interface HomeProps {
  locales: { country: string; countryName: string; lang: string }[];
}

export function Home({ locales }: HomeProps) {
  return (
    <main>
      <h1>2yolks</h1>
      <p className="tagline">Recipes worth cracking two eggs for.</p>
      <ul className="cards">
        {locales.map((l) => (
          <li key={`${l.country}-${l.lang}`}>
            <a href={countryPath(l.country)}>
              {l.countryName} ({l.lang})
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}

export interface CountryHomeProps {
  countryName: string;
  country: string;
  recipes: { id: string; slug: string; title: string; untested?: boolean; lang?: string }[];
}

export function CountryHome({ countryName, country, recipes }: CountryHomeProps) {
  const intro = COUNTRY_INTROS[country];
  const t = uiStrings(intro?.lang ?? defaultLocale(country) ?? 'en');
  return (
    <main>
      <h1>{countryName}</h1>
      {intro ? <p lang={intro.lang}>{intro.text}</p> : null}
      <ul className="cards">
        {recipes.map((r) => (
          <li key={`${r.id}-${r.slug}`}>
            <a href={recipePathFor(country, r.lang ?? defaultLocale(country) ?? "", r.id, r.slug)}>
              {r.title}
              {r.untested ? <span className="badge">{t.untestedBadge}</span> : null}
            </a>
          </li>
        ))}
      </ul>
      <p className="langs"><a href="/how-we-test">{t.howWeTest}</a></p>
    </main>
  );
}


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

const LANG_NAMES: Record<string, string> = { en: 'English', es: 'Espa\u00f1ol', fr: 'Fran\u00e7ais' };

export function RecipeView({ page, alternates = [], canonicalUrl, imageUrl }: { page: RecipePage; alternates?: { hreflang: string; href: string }[]; canonicalUrl?: string; imageUrl?: string | null }) {
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
  return (
    <main>
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
      {others.length > 0 ? (
        <p className="langs">
          {others.map((a) => (
            <a key={a.hreflang} href={a.href} hrefLang={a.hreflang}>
              {LANG_NAMES[a.hreflang.split('-')[0]] ?? a.hreflang}
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
      {page.locale.intro ? <p>{page.locale.intro}</p> : null}
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

export function PrivacyView() {
  return (
    <main>
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
    <main>
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
    <main>
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
    <main>
      <h1>Page not found / P&aacute;gina no encontrada</h1>
      <p>We could not find that page. <a href="/">Go to the 2yolks home page</a>.</p>
      <p>No encontramos esa p&aacute;gina. <a href="/">Ir al inicio</a>.</p>
    </main>
  );
}
