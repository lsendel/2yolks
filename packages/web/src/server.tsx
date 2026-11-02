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
import { RECIPE_CLIENT_SCRIPT } from './clientScript';
import type { RecipePage } from '@2yolks/contracts';
import { uiStrings } from '@2yolks/contracts';

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
.recipe-actions { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: center; margin: 0.5rem 0 1rem; }
main img { max-width: 100%; height: auto; }
h1 { overflow-wrap: break-word; }
.recipe-actions .jump { font-weight: 600; }
.recipe-actions .cook-open { margin-left: auto; background: var(--brand); color: #fff; border: 0; border-radius: 0.5rem; padding: 0.5rem 1rem; font-weight: 700; cursor: pointer; }
.scaler { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; margin: 0 0 0.75rem; }
.scaler-label { color: var(--muted); font-size: 0.9rem; margin-right: 0.25rem; }
.scaler button { border: 1px solid #e7e5e4; background: var(--card); border-radius: 0.375rem; padding: 0.25rem 0.6rem; cursor: pointer; font-weight: 600; }
.scaler button[aria-pressed="true"] { background: var(--brand); color: #fff; border-color: var(--brand); }
ul.ingredients { list-style: none; padding: 0; }
ul.ingredients li { padding: 0.15rem 0; }
ul.ingredients label { display: flex; gap: 0.5rem; align-items: baseline; cursor: pointer; }
ul.ingredients input { transform: translateY(0.1em); }
ul.ingredients input:checked ~ .qty, ul.ingredients input:checked ~ .rest { text-decoration: line-through; color: var(--muted); }
.qty { font-weight: 600; }
ol.steps li { margin: 0.5rem 0; }
.cook-mode { position: fixed; inset: 0; background: var(--bg); z-index: 50; display: flex; }
.cook-mode[hidden] { display: none; }
.cook-inner { max-width: 42rem; margin: auto; padding: 1.5rem; width: 100%; display: flex; flex-direction: column; gap: 1.5rem; min-height: 60vh; justify-content: center; }
.cook-top { display: flex; justify-content: space-between; align-items: center; color: var(--muted); }
.cook-close { background: none; border: 1px solid #e7e5e4; border-radius: 0.375rem; padding: 0.35rem 0.75rem; cursor: pointer; }
.cook-step { font-size: 1.6rem; line-height: 1.4; font-weight: 600; }
.cook-nav { display: flex; justify-content: space-between; gap: 1rem; }
.cook-nav button { flex: 1; background: var(--brand); color: #fff; border: 0; border-radius: 0.5rem; padding: 0.75rem; font-size: 1.1rem; font-weight: 700; cursor: pointer; }
.cook-nav button:first-child { background: var(--card); color: var(--ink); border: 1px solid #e7e5e4; }
.cook-timer { display: flex; gap: 0.75rem; align-items: center; }
.timer-btn { border: 1px solid var(--brand); color: var(--brand); background: none; border-radius: 0.5rem; padding: 0.4rem 0.9rem; font-weight: 600; cursor: pointer; }
.timer-display { font-size: 1.4rem; font-weight: 700; font-variant-numeric: tabular-nums; }
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
  const t = uiStrings(page.locale.lang);
  const cookData = safeJsonLd({
    steps: JSON.parse(page.locale.stepsJson),
    strings: { timerDone: t.timerDone },
  });
  const body =
    renderToString(<RecipeView page={page} alternates={alternates} />) +
    `<script type="application/json" id="cook-data">${cookData}</script>` +
    `<script>${RECIPE_CLIENT_SCRIPT}</script>`;
  return shell(body, {
    title: `${page.locale.title} - 2yolks`,
    alternates,
    jsonLd,
    // Synthetic/dev-only sources must never be indexed as real recipes.
    noindex: page.source.license === 'internal-demo',
  });
}
