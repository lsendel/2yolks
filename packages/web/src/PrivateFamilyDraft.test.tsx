import React from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {PrivateFamilyDraftView} from './PrivateFamilyDraft';
describe('unconnected private family screen draft',()=>{
 for(const state of ['compose','review','family'] as const)it(state+' clearly disabled and privacy scoped',()=>{const html=renderToStaticMarkup(<PrivateFamilyDraftView state={state}/>);expect(html).toContain('Nothing is saved, uploaded or shared');expect(html).toContain('disabled');expect(html).not.toContain('type="file"');expect(html).not.toContain('action=');expect(html).toContain('Family sharing is separate from public publication');});
});
