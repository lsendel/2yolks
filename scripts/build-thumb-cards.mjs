// Builds thumbnail-safe 1200x675 "graphic" recipe cards (no text, honest by
// omission: the UI already labels these "Graphic" + "Not yet tested").
// The current house cards (scripts/build-house-graphics.py) put the recipe
// title on the image; discovery rows crop the center ~76px square, so the
// title clipped into unreadable fragments. v2 is text-free: brand plum +
// the category icon centered in lime, so every crop (square list thumb,
// 170px grid band, hero) reads clean at any size.
//
// Usage: node scripts/build-thumb-cards.mjs --manifest manifest.json --outdir /tmp/cards
//   manifest: [{"id":"<recipe-id>","category":"<slug>"}] (category optional)
// Emits <id>.svg and <id>.png per row plus contact-sheet.html for review.
// PNG rendering uses headless Chrome (same renderer as the site).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PLUM = '#211729';
const PLUM_MID = '#302038';
const LIME = '#e0fa80';
const RULE = '#605469';

// Category icon paths, copied verbatim from packages/web/src/icons.tsx
// (CategoryIcon, 20x20 viewBox, stroke 1.6). Keep in sync: if icons.tsx
// changes, re-copy. The fallback circle matches icons.tsx.
const ICONS = {
  'soups-stews': '<path d="M3.5 9.5h13v3a5.5 5.5 0 0 1-5.5 5.5H9a5.5 5.5 0 0 1-5.5-5.5v-3z"/><path d="M2 9.5h16M7 6c0-1 .8-1.5.8-2.5M10 6c0-1 .8-1.5.8-2.5M13 6c0-1 .8-1.5.8-2.5"/>',
  'tacos-tortillas': '<path d="M3 14.5a7 7 0 0 1 14 0H3z"/><path d="M6.2 11.2c.8-.7 1.8-.7 2.5 0 .8.7 1.8.7 2.6 0 .7-.7 1.7-.7 2.5 0"/>',
  'dumplings': '<path d="M3 13.5c0-4.2 3.1-7 7-7s7 2.8 7 7c0 1.2-.9 2-2.2 2H5.2c-1.3 0-2.2-.8-2.2-2z"/><path d="M6.5 7.5l1.2 2M10 6.5v2.3M13.5 7.5l-1.2 2"/>',
  'desserts-baking': '<path d="M5.5 11.5l1.2 5.5h6.6l1.2-5.5"/><path d="M4.5 11.5a3 3 0 0 1 2.2-5 3.2 3.2 0 0 1 6.6 0 3 3 0 0 1 2.2 5H4.5z"/>',
  'drinks': '<path d="M5.5 4.5h9l-1.2 8a3.3 3.3 0 0 1-6.6 0l-1.2-8z"/><path d="M10 15.8v2.2M7.5 18h5M12.5 2.5L11 7.5"/>',
  'breakfast': '<path d="M10 3.2c4.2 0 6.8 3.2 6.8 6.9 0 3.9-2.9 6.7-6.8 6.7s-6.8-2.8-6.8-6.7C3.2 6.4 5.8 3.2 10 3.2z"/><circle cx="10.2" cy="10.6" r="2.7"/>',
  'mains': '<path d="M3.5 13.5a6.5 6.5 0 0 1 13 0"/><path d="M2 13.5h16M10 5v2"/><circle cx="10" cy="4.2" r="1"/>',
  'sides': '<path d="M3.5 10.5h13a6.5 6.5 0 0 1-13 0z"/><path d="M7 10.5c0-2.5 2-4.5 4.8-4.5 0 2.5-2 4.5-4.8 4.5z"/>',
  'snacks-dips': '<path d="M3.5 11.5h13a5.5 5.5 0 0 1-11 0"/><path d="M9.5 4.5l3.8 5.2-5.6.8 1.8-6z"/>',
};
const FALLBACK = '<circle cx="10" cy="10" r="5"/>';

function cardSvg(category) {
  const icon = ICONS[category] ?? FALLBACK;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <rect width="1200" height="675" fill="${PLUM}"/>
  <rect width="1200" height="16" fill="${LIME}"/>
  <rect x="36" y="48" width="1128" height="591" fill="none" stroke="${RULE}" stroke-width="2"/>
  <circle cx="600" cy="330" r="238" fill="${PLUM_MID}"/>
  <circle cx="600" cy="330" r="238" fill="none" stroke="${RULE}" stroke-width="2"/>
  <g transform="translate(430,160) scale(17)" fill="none" stroke="${LIME}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icon}</g>
  <text x="76" y="616" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="44" fill="${LIME}" letter-spacing="1">2yolks</text>
  <circle cx="206" cy="602" r="7" fill="${LIME}"/><circle cx="228" cy="602" r="7" fill="${LIME}"/>
</svg>`;
}

function parseArgs(argv) {
  const args = { manifest: null, outdir: '/tmp/thumb-cards', chrome: 'google-chrome' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--manifest') args.manifest = argv[++i];
    else if (argv[i] === '--outdir') args.outdir = argv[++i];
    else if (argv[i] === '--chrome') args.chrome = argv[++i];
  }
  if (!args.manifest) throw new Error('--manifest required');
  return args;
}

const args = parseArgs(process.argv);
const items = JSON.parse(await import('node:fs').then(fs => fs.readFileSync(args.manifest, 'utf8')));
mkdirSync(args.outdir, { recursive: true });

for (const item of items) {
  const svg = cardSvg(item.category);
  const svgPath = join(args.outdir, `${item.id}.svg`);
  const pngPath = join(args.outdir, `${item.id}.png`);
  writeFileSync(svgPath, svg);
  execFileSync(args.chrome, ['--headless', '--disable-gpu', '--no-sandbox', `--screenshot=${pngPath}`, '--window-size=1200,675', '--hide-scrollbars', '--default-background-color=00000000', `file://${svgPath}`], { stdio: 'pipe' });
}

// Contact sheet: list-thumb crop (76px square) + grid band (170px) + full card,
// the three sizes the site actually shows.
const cells = items.map((it) => `<div style="margin:18px;text-align:center;color:#d4c8dc;font:12px sans-serif">
  <div style="display:flex;gap:18px;align-items:flex-start;justify-content:center">
    <img src="${it.id}.png" style="width:76px;height:76px;object-fit:cover;border-radius:4px;border:1px solid #65566e">
    <img src="${it.id}.png" style="width:300px;height:170px;object-fit:cover;border-radius:2px">
    <img src="${it.id}.png" style="width:400px;height:225px;object-fit:cover;border:1px solid #605469">
  </div>${it.id} (${it.category ?? 'none'})</div>`).join('\n');
writeFileSync(join(args.outdir, 'contact-sheet.html'), `<!doctype html><html><body style="background:#211729;margin:0;padding:24px">${cells}</body></html>`);
console.log(`Rendered ${items.length} cards into ${args.outdir} (svg+png) + contact-sheet.html`);
