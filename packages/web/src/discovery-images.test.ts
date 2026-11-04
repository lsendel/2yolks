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
