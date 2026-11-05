import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { renderHome, renderCountryHome } from './server';

const rows = [
  { id: 'r1', slug: 'abuela-soup', title: 'Abuela Soup', country: 'us', lang: 'en', category: 'soups-stews', totalMinutes: 40, imageId: 'img-photo', imageStyle: 'photo' as const },
  { id: 'r1', slug: 'sopa-de-abuela', title: 'Sopa de la abuela', country: 'us', lang: 'es', category: 'soups-stews', totalMinutes: 40, imageId: 'img-photo', imageStyle: 'photo' as const },
  { id: 'r2', slug: 'midnight-noodles', title: 'Midnight Noodles', country: 'us', lang: 'en', category: 'mains', totalMinutes: 25, imageId: 'img-illu', imageStyle: 'illustration' as const },
  { id: 'r3', slug: 'pantry-cookies', title: 'Pantry Cookies', country: 'us', lang: 'en', category: 'desserts', totalMinutes: 55, imageId: 'img-graphic', imageStyle: 'graphic' as const },
  { id: 'r4', slug: 'garden-rice', title: 'Garden Rice', country: 'us', lang: 'en', category: 'mains', totalMinutes: 30 },
];

it('writes fixture HTML', () => {
  const locales = [{ country: 'us', countryName: 'United States', lang: 'en' }, { country: 'us', countryName: 'United States', lang: 'es' }];
  for (const lang of ['en', 'es', 'fr']) {
    writeFileSync(`/downloads/render-fixtures/home-${lang}.html`, renderHome({ recipes: rows, locales, lang }));
  }
  writeFileSync('/downloads/render-fixtures/country-us.html', renderCountryHome({ country: 'us', countryName: 'United States', recipes: rows }));
});
