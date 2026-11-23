/** Draft adapter factory only. NOT mounted by index.ts/appapi.ts.
 * No production store exists. Calling with defaults fails closed before DB.
 */
import {Hono} from 'hono';
import {bodyLimit} from 'hono/body-limit';
import {getCookie} from 'hono/cookie';
import {readSessionUser,SESSION_COOKIE,sha256Hex,type AccountBindings} from './account';
import {PrivateFamilyError} from './privateFamily';
import {acceptPrivateVersion,readPrivateVersion,type AcceptanceInput,type PrivateFamilyStore} from './privateFamilyService';
export type FamilyPrincipal={id:string;method:'cookie'|'bearer'};
export type FamilyAuthInput={db:D1Database;authorization:string|undefined;cookieToken:string|undefined};
/** Authorization header is authoritative: malformed/expired bearer never falls
 * through to ambient cookies and cannot act as a different signed-in account. */
export async function authenticateFamily(input:FamilyAuthInput):Promise<FamilyPrincipal|null>{
 if(input.authorization!==undefined){
  const match=/^Bearer ([a-f0-9]{64})$/.exec(input.authorization);
  if(!match)return null;
  const tokenHash=await sha256Hex(match[1]!);
  const user=await input.db.prepare('SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>? AND u.deleted_at IS NULL').bind(tokenHash,Date.now()).first<{id:string}>();
  return user?{id:user.id,method:'bearer'}:null;
 }
 const user=await readSessionUser(input.db,input.cookieToken);
 return user?{id:user.id,method:'cookie'}:null;
}
type Options={enabled?:boolean;store?:PrivateFamilyStore;authenticate?:typeof authenticateFamily};
type Env={Bindings:AccountBindings;Variables:{principal:FamilyPrincipal}};
const NO_STORE={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const allowedFields=['candidateId','familyId','expectedRevision','digest','consentVersion','key'];
function acceptanceInput(body:unknown):AcceptanceInput|null{
 if(!body||typeof body!=='object'||Array.isArray(body))return null;
 const value=body as Record<string,unknown>;
 if(Object.keys(value).length!==allowedFields.length||Object.keys(value).some(key=>!allowedFields.includes(key)))return null;
 if(!['candidateId','familyId','digest','consentVersion','key'].every(key=>typeof value[key]==='string'&&(value[key] as string).length<=128))return null;
 if(typeof value.expectedRevision!=='number')return null;
 return value as AcceptanceInput;
}
export function createPrivateFamilyApi(options:Options={}){
 const api=new Hono<Env>();
 // Deliberately no environment flag or production store. Must be separately
 // reviewed before mounting. Disabled requests perform no authentication/DB I/O.
 api.use('*',async(c,next)=>{
  for(const [name,value] of Object.entries(NO_STORE))c.header(name,value);
  if(options.enabled!==true||!options.store)return c.json({error:'Private families are not enabled.'},503);
  await next();
 });
 api.use('*',bodyLimit({maxSize:4096,onError:c=>c.json({error:'Request too large.'},413)}));
 api.use('*',async(c,next)=>{
  const p=await (options.authenticate??authenticateFamily)({db:c.env.DB,authorization:c.req.header('authorization'),cookieToken:getCookie(c,SESSION_COOKIE)});
  if(!p)return c.json({error:'Sign in first.'},401);
  // Every browser mutation must have an exact trusted Origin. Reject foreign
  // origins even with a bearer. No permissive CORS or OPTIONS handler.
  if(c.req.method!=='GET'){
   const origin=c.req.header('origin');
   const canonical=c.env.CANONICAL_ORIGIN;
   const allowed=canonical?new URL(canonical).origin:new URL(c.req.url).origin;
   if((p.method==='cookie'&&!origin)||(origin!==undefined&&origin!==allowed))return c.json({error:'Request origin rejected.'},403);
   if(c.req.header('content-type')?.split(';')[0]?.trim()!=='application/json')return c.json({error:'Send application/json.'},415);
  }
  c.set('principal',p);await next();
 });
 api.onError((error,c)=>{
  if(error instanceof PrivateFamilyError){
   const status=error.code==='forbidden'?403:error.code==='conflict'?409:error.code==='quota'?429:400;
   return c.json({error:error.code},status);
  }
  // No raw DB error, source text, cookie or token in HTTP bodies/logs.
  return c.json({error:'Private recipe request failed. Reconcile its receipt before retrying.'},503);
 });
 api.post('/accept',async c=>{
  const input=acceptanceInput(await c.req.json().catch(()=>null));
  if(!input)return c.json({error:'Invalid acceptance fields.'},400);
  const result=await acceptPrivateVersion(options.store!,c.get('principal').id,input);
  return c.json(result,200);
 });
 api.get('/candidates/:id',async c=>{
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(c.req.param('id')))return c.json({error:'Invalid id.'},400);
  return c.json(await readPrivateVersion(options.store!,c.get('principal').id,c.req.param('id')),200);
 });
 return api;
}
