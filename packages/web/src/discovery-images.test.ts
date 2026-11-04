import {describe,it,expect} from 'vitest';
import {renderHome} from './server';
import {uiStrings} from '@2yolks/contracts';

const base={country:'us',lang:'en',slug:'a',title:'Soup',category:'soups-stews',untested:false,totalMinutes:40};

describe('List photo previews with honest labels',()=>{
 it('renders the cleared hero image with its honest label',()=>{
  const html=renderHome({recipes:[{...base,id:'r1',imageId:'img1',imageStyle:'photo'}],locales:[],lang:'en'});
  expect(html).toContain('/img/recipe/img1');
  expect(html).toContain('>Photo</span>');
  expect(html).toContain('class="has-thumb"');
 });
 it('labels AI illustrations as illustrations, never as photos',()=>{
  const html=renderHome({recipes:[{...base,id:'r1',imageId:'img2',imageStyle:'illustration'}],locales:[],lang:'en'});
  expect(html).toContain('AI illustration');
  expect(html).not.toContain('>Photo</span>');
 });
 it('keeps recipes without an image text-only (no placeholder, no broken img)',()=>{
  const html=renderHome({recipes:[{...base,id:'r1'}],locales:[],lang:'en'});
  expect(html).not.toContain('/img/recipe/');
  expect(html).not.toContain('class="has-thumb"');
 });
 it('fails closed on an unknown style value: no thumbnail, no guessed Photo label',()=>{
  const html=renderHome({recipes:[{...base,id:'r1',imageId:'img9',imageStyle:'oil-painting' as unknown as 'photo'}],locales:[],lang:'en'});
  expect(html).not.toContain('/img/recipe/img9');
  expect(html).not.toContain('>Photo</span>');
  expect(html).not.toContain('class="has-thumb"');
 });
 it('fails closed when an image id arrives without a style',()=>{
  const html=renderHome({recipes:[{...base,id:'r1',imageId:'img10'}],locales:[],lang:'en'});
  expect(html).not.toContain('/img/recipe/img10');
 });
 it('localizes the label',()=>{
  const html=renderHome({recipes:[{...base,id:'r1',imageId:'img3',imageStyle:'illustration'}],locales:[],lang:'es'});
  expect(html).toContain('Ilustración de IA');
 });
 it('every locale exposes the three label strings',()=>{
  for (const lang of ['en','es','fr']) {
   const t=uiStrings(lang);
   expect(t.imageLabelPhoto).toBeTruthy();
   expect(t.imageLabelIllustration).toBeTruthy();
   expect(t.imageLabelGraphic).toBeTruthy();
  }
 });
});

import { CAPTURE_CLIENT_SCRIPT, CAPTURE_CHECK_STRINGS } from './clientScript';

// Minimal DOM stub to execute the capture script for real (EN<->ES/FR switch).
function stubDom(locale: string) {
  const listeners: Record<string, () => void> = {};
  const mk = (value = ''): any => ({ value, textContent: '', className: '' });
  const fields: Record<string, any> = {
    locale: mk(locale), title: mk(''), ingredients: mk(''), steps: mk(''), servings: mk(''),
    source_kind: mk('original'), source_url: mk(''),
  };
  const checks: Record<string, any> = {};
  for (const k of ['title', 'ingredients', 'qty', 'cups', 'steps', 'servings', 'source']) checks[k] = mk();
  const options = [{ value: '', textContent: 'Not sure yet' }, { value: 'soups-stews', textContent: 'Soups & stews' }];
  const catSel: any = { value: '', options };
  const prompt: any = mk(); const pre: any = mk(); const preHint: any = mk();
  const form: any = {
    querySelector: (sel: string) => {
      if (sel === '[name="category"]') return catSel;
      if (sel === '[name="locale"]') return fields['locale'];
      const m = /^\[name="(.+)"\]$/.exec(sel);
      if (m) return fields[m[1]!];
      return null;
    },
    addEventListener: (ev: string, fn: () => void) => { listeners[ev] = fn; },
  };
  const box: any = { querySelector: (sel: string) => { const m = /^\[data-check="(.+)"\]$/.exec(sel); return m ? checks[m[1]!] : null; } };
  const islands: Record<string, string> = {
    'capture-check-strings': CAPTURE_CHECK_STRINGS,
    'capture-cat-labels': '',
  };
  const doc: any = {
    querySelector: (sel: string) => {
      if (sel === 'form[action="/account/recipes/save"]') return form;
      if (sel === '[data-live-checks]') return box;
      if (sel === '[data-category-prompt]') return prompt;
      if (sel === '[data-preamble-label]') return pre;
      if (sel === '[data-preamble-hint]') return preHint;
      return null;
    },
    getElementById: (id: string) => ({ textContent: islands[id] ?? '' }),
  };
  return { doc, fields, checks, options, prompt, pre, preHint, fire: (ev: string) => listeners[ev]?.() };
}

const CAT_LABELS = JSON.stringify({
  en: { __prompt: 'What kind of dish is it?', __unsure: 'Not sure yet', __preamble: 'A sentence or two before the recipe', __preambleHint: '(optional - the story or context a cook reads first)', 'soups-stews': 'Soups & stews' },
  es: { __prompt: '¿Qué tipo de plato es?', __unsure: 'Aún no lo sé', __preamble: 'Una o dos frases antes de la receta', __preambleHint: '(opcional - la historia o el contexto que se lee primero)', 'soups-stews': 'Sopas y guisos' },
  fr: { __prompt: 'Quel type de plat est-ce ?', __unsure: 'Pas encore sûr', __preamble: 'Une phrase ou deux avant la recette', __preambleHint: "(facultatif - l'histoire ou le contexte à lire en premier)", 'soups-stews': 'Soupes et ragoûts' },
});

describe('capture script locale switch', () => {
  function run(locale: string) {
    const d = stubDom(locale);
    const patched = CAPTURE_CLIENT_SCRIPT.replace("document.getElementById('capture-cat-labels').textContent", 'CATLABELS_SRC');
    new Function('document', 'CATLABELS_SRC', patched)(d.doc, CAT_LABELS);
    return d;
  }
  it('blank category option, prompt and preamble follow EN -> ES -> FR', () => {
    const d = run('us:en');
    expect(d.options[0]!.textContent).toBe('Not sure yet');
    expect(d.prompt.textContent).toBe('What kind of dish is it?');
    d.fields['locale'].value = 'us:es';
    d.fire('change');
    expect(d.options[0]!.textContent).toBe('Aún no lo sé');
    expect(d.options[1]!.textContent).toBe('Sopas y guisos');
    expect(d.prompt.textContent).toBe('¿Qué tipo de plato es?');
    expect(d.pre.textContent).toBe('Una o dos frases antes de la receta');
    expect(d.checks['title']!.textContent).toContain('Ponle un nombre');
    d.fields['locale'].value = 'us:fr';
    d.fire('change');
    expect(d.options[0]!.textContent).toBe('Pas encore sûr');
    expect(d.preHint.textContent).toContain('facultatif');
    expect(d.checks['steps']!.textContent).toContain('Écrivez les étapes');
  });
  it('quantity hint: leading amount required, unicode fraction counts, mid-line digit does not', () => {
    const d = run('us:en');
    d.fields['ingredients'].value = 'stock for 2 people';
    d.fire('input');
    expect(d.checks['qty']!.className).toBe('todo');
    d.fields['ingredients'].value = '½ onion';
    d.fire('input');
    expect(d.checks['qty']!.className).toBe('ok');
    d.fields['ingredients'].value = '1 taza leche';
    d.fire('input');
    expect(d.checks['cups']!.className).toBe('todo');
  });
  it('source URL must parse as https with a dotted host', () => {
    const d = run('us:en');
    d.fields['source_kind'].value = 'adapted';
    d.fields['source_url'].value = 'https://';
    d.fire('input');
    expect(d.checks['source']!.className).toBe('todo');
    d.fields['source_url'].value = 'https://example.com/recipe';
    d.fire('input');
    expect(d.checks['source']!.className).toBe('ok');
  });
  it('untouched fields stay idle, never green', () => {
    const d = run('us:en');
    expect(d.checks['qty']!.className).toBe('idle');
    expect(d.checks['cups']!.className).toBe('idle');
    expect(d.checks['title']!.className).toBe('idle');
  });
});
