import { renderToString } from 'react-dom/server';
import { Home, CountryHome, RecipeView, type HomeProps, type CountryHomeProps } from './App';
import type { RecipePage } from '@2yolks/contracts';

interface ShellOptions {
  title: string;
  /** hreflang alternates: exact content equivalents only */
  alternates?: { hreflang: string; href: string }[];
  jsonLd?: object;
  noindex?: boolean;
}

function shell(body: string, { title, alternates = [], jsonLd, noindex = false }: ShellOptions): string {
  const links = alternates
    .map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`)
    .join('\n    ');
  const ld = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : '';
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    ${noindex ? '<meta name="robots" content="noindex, nofollow" />' : ''}
    ${links}
    ${ld}
  </head>
  <body>${body}</body>
</html>`;
}

export function renderHome(props: HomeProps): string {
  return shell(renderToString(<Home {...props} />), { title: '2yolks' });
}

export function renderCountryHome(props: CountryHomeProps): string {
  return shell(renderToString(<CountryHome {...props} />), {
    title: `2yolks - ${props.countryName}`,
  });
}

export function renderRecipe(page: RecipePage, alternates: { hreflang: string; href: string }[]): string {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: page.locale.title,
    recipeIngredient: JSON.parse(page.locale.ingredientsJson),
    recipeInstructions: (JSON.parse(page.locale.stepsJson) as string[]).map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text: s,
    })),
  };
  return shell(renderToString(<RecipeView page={page} />), {
    title: `${page.locale.title} - 2yolks`,
    alternates,
    jsonLd,
    // Synthetic/dev-only sources must never be indexed as real recipes.
    noindex: page.source.license === 'internal-demo',
  });
}
