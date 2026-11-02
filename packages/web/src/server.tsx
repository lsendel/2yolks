import { renderToString } from 'react-dom/server';

/** Escape text interpolated into raw HTML head elements. */
function escapeHtml(text: string): string {
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
import { Home, CountryHome, RecipeView, type HomeProps, type CountryHomeProps } from './App';
import type { RecipePage } from '@2yolks/contracts';

interface ShellOptions {
  title: string;
  /** hreflang alternates: exact content equivalents only */
  alternates?: { hreflang: string; href: string }[];
  jsonLd?: object;
  noindex?: boolean;
}

const BASE_CSS = `
:root { color-scheme: light; --brand: #c2410c; --ink: #1c1917; --muted: #57534e; --bg: #fffbf5; --card: #ffffff; }
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; background: var(--bg); color: var(--ink); line-height: 1.6; }
a { color: var(--brand); }
.site-header { background: var(--card); border-bottom: 1px solid #e7e5e4; padding: 0.75rem 1rem; }
.site-header a.brand { font-weight: 700; font-size: 1.25rem; text-decoration: none; color: var(--brand); }
main { max-width: 42rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
.tagline { color: var(--muted); margin-top: -0.5rem; }
.cards { list-style: none; padding: 0; display: grid; gap: 0.75rem; }
.cards a { display: block; background: var(--card); border: 1px solid #e7e5e4; border-radius: 0.5rem; padding: 0.75rem 1rem; text-decoration: none; color: var(--ink); font-weight: 600; }
.cards a:hover { border-color: var(--brand); }
.recipe-source { color: var(--muted); font-size: 0.9rem; border-top: 1px solid #e7e5e4; margin-top: 2rem; padding-top: 1rem; }
.langs { font-size: 0.9rem; color: var(--muted); }
`;

function shell(body: string, { title, alternates = [], jsonLd, noindex = false }: ShellOptions): string {
  const links = alternates
    .map((a) => `<link rel="alternate" hreflang="${escapeHtml(a.hreflang)}" href="${escapeHtml(a.href)}" />`)
    .join('\n    ');
  const ld = jsonLd ? `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>` : '';
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    ${noindex ? '<meta name="robots" content="noindex, nofollow" />' : ''}
    ${links}
    ${ld}
    <style>${BASE_CSS}</style>
  </head>
  <body><header class="site-header"><a class="brand" href="/">2yolks</a></header>${body}</body>
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
  return shell(renderToString(<RecipeView page={page} alternates={alternates} />), {
    title: `${page.locale.title} - 2yolks`,
    alternates,
    jsonLd,
    // Synthetic/dev-only sources must never be indexed as real recipes.
    noindex: page.source.license === 'internal-demo',
  });
}
