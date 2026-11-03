import type { RecipePage } from '@2yolks/contracts';
import { countryPath, recipePath, uiStrings, parseIngredient, formatQty, scalingIsSafe } from '@2yolks/contracts';

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
  recipes: { id: string; slug: string; title: string }[];
}

export function CountryHome({ countryName, country, recipes }: CountryHomeProps) {
  return (
    <main>
      <h1>{countryName}</h1>
      <ul className="cards">
        {recipes.map((r) => (
          <li key={`${r.id}-${r.slug}`}>
            <a href={recipePath(country, r.id, r.slug)}>{r.title}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}

const MULTIPLIERS = [0.5, 1, 2, 3];

export function RecipeView({ page, alternates = [] }: { page: RecipePage; alternates?: { hreflang: string; href: string }[] }) {
  const t = uiStrings(page.locale.lang);
  const ingredients = (JSON.parse(page.locale.ingredientsJson) as string[]).map((raw) => ({
    raw,
    parsed: parseIngredient(raw),
  }));
  const steps = JSON.parse(page.locale.stepsJson) as string[];
  const others = alternates.filter((a) => a.hreflang !== 'x-default' && !a.hreflang.startsWith(page.locale.lang + '-'));
  const hasQty =
    ingredients.some((i) => i.parsed.qty !== null) &&
    scalingIsSafe(ingredients.map((i) => i.raw), steps);
  return (
    <main>
      <h1>{page.locale.title}</h1>
      {others.length > 0 ? (
        <p className="langs">
          {others.map((a) => (
            <a key={a.hreflang} href={a.href} hrefLang={a.hreflang}>
              {a.hreflang}
            </a>
          ))}
        </p>
      ) : null}
      <p className="recipe-actions">
        <a href="#recipe" className="jump">
          {t.jumpToRecipe} &darr;
        </a>
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
            {MULTIPLIERS.map((m) => (
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
        <ul className="ingredients">
          {ingredients.map(({ raw, parsed }) => (
            <li key={raw}>
              <label>
                <input type="checkbox" />
                {parsed.qty !== null ? (
                  <>
                    <span className="qty" data-qty={parsed.qty} data-qty-end={parsed.qtyEnd ?? ''}>
                      {formatQty(parsed.qty)}
                      {parsed.qtyEnd !== null ? `-${formatQty(parsed.qtyEnd)}` : ''}
                    </span>{' '}
                    <span className="rest">{parsed.rest}</span>
                  </>
                ) : (
                  <span className="rest">{raw}</span>
                )}
              </label>
            </li>
          ))}
        </ul>
        <h2>{t.steps}</h2>
        <ol className="steps">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>
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
