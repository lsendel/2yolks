import {describe,it,expect,vi} from 'vitest';
import {createPrivateFamilyApi,authenticateFamily} from './privateFamilyApi';
import type {PrivateFamilyStore,PrivateFamilyTransaction} from './privateFamilyService';
import type {Candidate,Family} from './privateFamily';
const ORIGIN='https://2yolks.com';
const body=()=>({candidateId:'c',familyId:'f',expectedRevision:3,digest:'b'.repeat(64),consentVersion:'private-family-v1',key:'stable-key'});
const env={DB:{} as D1Database,CANONICAL_ORIGIN:ORIGIN};
function fixture(method:'cookie'|'bearer'='bearer',principal='a'){
 let candidate:Candidate={id:'c',ownerId:'a',familyId:'f',revision:3,state:'awaiting_contributor',submitted:{id:'v1',digest:'a'.repeat(64),text:'raw',locale:'es',media:[]},improved:{id:'v2',digest:'b'.repeat(64),text:'improved',locale:'es',media:[{id:'cover',purpose:'dish_cover',bytes:1,verified:true,rights:true},{id:'source',purpose:'recipe_source',bytes:1,verified:true,rights:true}]}};
 const family:Family={id:'f',revision:1,members:[{userId:'a',role:'owner',active:true},{userId:'b',role:'member',active:true}]};
 const bind=vi.fn(async c=>{candidate=c});
 const tx:PrivateFamilyTransaction={candidate:async()=>candidate,family:async()=>family,receipt:async()=>null,acceptAndBind:bind,saveReceipt:async()=>{}};
 const store:PrivateFamilyStore={transaction:async work=>work(tx)};
 return {api:createPrivateFamilyApi({enabled:true,store,authenticate:async()=>({id:principal,method})}),bind,family};
}
function post(api:ReturnType<typeof createPrivateFamilyApi>,data:unknown=body(),headers:Record<string,string>={}){
 return api.request(ORIGIN+'/accept',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(data)},env);
}
describe('private API draft adapter, not mounted',()=>{
 it('default is disabled before DB or authentication',async()=>{let auth=vi.fn();let app=createPrivateFamilyApi({authenticate:auth});expect((await post(app)).status).toBe(503);expect(auth).not.toHaveBeenCalled();});
 it('cannot enable without a store',async()=>expect((await post(createPrivateFamilyApi({enabled:true}))).status).toBe(503));
 it('returns exact accepted receipt with private/no-store headers',async()=>{let x=fixture();let r=await post(x.api);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({candidateId:'c',familyId:'f',state:'family_shared',digest:'b'.repeat(64)});expect(r.headers.get('cache-control')).toBe('private, no-store');expect(r.headers.get('x-content-type-options')).toBe('nosniff');});
 it('requires exact origin for cookie writes',async()=>{let x=fixture('cookie');expect((await post(x.api)).status).toBe(403);expect((await post(x.api,body(),{origin:'https://evil.invalid'})).status).toBe(403);expect(x.bind).not.toHaveBeenCalled();expect((await post(x.api,body(),{origin:ORIGIN})).status).toBe(200);});
 it('also rejects foreign origin with bearer',async()=>expect((await post(fixture().api,body(),{origin:'https://evil.invalid'})).status).toBe(403));
 it('rejects nonJSON and unknown client-auth fields',async()=>{let x=fixture();expect((await post(x.api,body(),{'content-type':'text/plain'})).status).toBe(415);expect((await post(x.api,{...body(),principal:'other'})).status).toBe(400);expect(x.bind).not.toHaveBeenCalled();});
 it('does not trust client principal or family ownership',async()=>{let x=fixture('bearer','b');expect((await post(x.api)).status).toBe(403);expect(x.bind).not.toHaveBeenCalled();});
 it('requires authentication',async()=>{let x=fixture();let app=createPrivateFamilyApi({enabled:true,store:{transaction:async()=>{throw Error('should not call')}},authenticate:async()=>null});expect((await post(app)).status).toBe(401);expect(x.bind).not.toHaveBeenCalled();});
 it('bounds body before authentication',async()=>{let x=fixture();expect((await post(x.api,{text:'x'.repeat(5000)})).status).toBe(413);expect(x.bind).not.toHaveBeenCalled();});
 it('reads accepted version without source photos and enforces current membership',async()=>{let x=fixture();await post(x.api);let r=await x.api.request(ORIGIN+'/candidates/c',{},env);expect(r.status).toBe(200);expect((await r.json() as {media:{id:string}[]}).media.map(m=>m.id)).toEqual(['cover']);x.family.members[0]!.active=false;expect((await x.api.request(ORIGIN+'/candidates/c',{},env)).status).toBe(403);});
 it('maps unknown storage failures to non-sensitive unavailable error',async()=>{let app=createPrivateFamilyApi({enabled:true,store:{transaction:async()=>{throw Error('private secret text')}},authenticate:async()=>({id:'a',method:'bearer'})});let r=await post(app);expect(r.status).toBe(503);expect(await r.text()).not.toContain('private secret text');});
 it('invalid bearer never falls through to cookie session',async()=>{let prepare=vi.fn();let result=await authenticateFamily({db:{prepare} as unknown as D1Database,authorization:'Bearer malformed',cookieToken:'a'.repeat(64)});expect(result).toBeNull();expect(prepare).not.toHaveBeenCalled();});
 it('hashes bearer for session lookup and excludes deleted/expired users',async()=>{let first=vi.fn(async()=>({id:'a'}));let bind=vi.fn((..._values:unknown[])=>({first}));let prepare=vi.fn((_sql:string)=>({bind}));let token='a'.repeat(64);expect(await authenticateFamily({db:{prepare} as unknown as D1Database,authorization:'Bearer '+token,cookieToken:undefined})).toEqual({id:'a',method:'bearer'});expect(bind.mock.calls[0]?.[0]).not.toBe(token);expect(prepare.mock.calls[0]?.[0]).toContain('deleted_at IS NULL');expect(prepare.mock.calls[0]?.[0]).toContain('expires_at>?');});
});
import productionApp from './index';
describe('private adapter isolation and real auth contracts',()=>{
 it('production main does not expose private family routes',async()=>{let prepare=vi.fn(()=>{throw Error('must not access private DB')});for(const path of ['/api/v1/private-family/accept','/api/v1/private-family/candidates/c']){let r=await productionApp.request(ORIGIN+path,{method:'POST',headers:{'content-type':'application/json'},body:'{}'},{...env,DB:{prepare}} as never);expect(r.status).toBe(404);}});
 it('expired or unknown bearer denies instead of falling back to cookie',async()=>{let first=vi.fn(async()=>null);let bind=vi.fn(()=>({first}));let prepare=vi.fn(()=>({bind}));expect(await authenticateFamily({db:{prepare} as unknown as D1Database,authorization:'Bearer '+'a'.repeat(64),cookieToken:'b'.repeat(64)})).toBeNull();expect(prepare).toHaveBeenCalledTimes(1);});
 it('cookie path uses the existing hashed and nondeleted session lookup',async()=>{let first=vi.fn(async()=>({id:'cookie-user',email:'test@example.invalid',displayName:null}));let bind=vi.fn((..._values:unknown[])=>({first}));let prepare=vi.fn((_sql:string)=>({bind}));let token='b'.repeat(64);expect(await authenticateFamily({db:{prepare} as unknown as D1Database,authorization:undefined,cookieToken:token})).toEqual({id:'cookie-user',method:'cookie'});expect(bind.mock.calls[0]?.[0]).not.toBe(token);expect(prepare.mock.calls[0]?.[0]).toContain('u.deleted_at IS NULL');});
});
