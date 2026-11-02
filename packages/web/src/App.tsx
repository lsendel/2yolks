import type { RecipePage } from '@2yolks/contracts';
import { countryPath, recipePath, uiStrings } from '@2yolks/contracts';

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

export function RecipeView({ page, alternates = [] }: { page: RecipePage; alternates?: { hreflang: string; href: string }[] }) {
  const t = uiStrings(page.locale.lang);
  const ingredients = JSON.parse(page.locale.ingredientsJson) as string[];
  const steps = JSON.parse(page.locale.stepsJson) as string[];
  const others = alternates.filter((a) => a.hreflang !== 'x-default' && !a.hreflang.startsWith(page.locale.lang + '-'));
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
      {page.locale.intro ? <p>{page.locale.intro}</p> : null}
      <h2>{t.ingredients}</h2>
      <ul>
        {ingredients.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <h2>{t.steps}</h2>
      <ol>
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="recipe-source">
        {t.source}:{' '}
        {page.source.url.startsWith('http') ? (
          <a href={page.source.url}>{page.source.name}</a>
        ) : (
          <span>{page.source.name}</span>
        )}
      </p>
    </main>
  );
}
