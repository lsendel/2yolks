/** Unmounted private R2 adapter. No route, bucket binding, public URL or timer.
 * Raw uploads are NEVER written: a separately qualified decoder must return
 * re-encoded JPEG/PNG/WebP bytes with metadata removed before this is usable.
 */
import {IMAGE_LIMIT,PrivateFamilyError,type MediaPurpose} from './privateFamily';
export type PrivateMediaRow={id:string;ownerId:string;candidateId:string;purpose:MediaPurpose;objectKey:string;state:'reserved'|'verified'|'deleting'|'deleted';digest?:string;bytes:number};
export interface MediaCatalog {
 reserve(principal:string,candidateId:string,purpose:MediaPurpose,bytes:number):Promise<PrivateMediaRow>;
 // Must atomically verify reservation still current, rights and current membership.
 verify(principal:string,id:string,digest:string,bytes:number):Promise<boolean>;
 authorize(principal:string,id:string):Promise<PrivateMediaRow|null>;
 // Removal must immediately deny reads, survive R2 failure, and be repeatable.
 beginDelete(principal:string,id:string):Promise<PrivateMediaRow|null>;
 finishDelete(id:string):Promise<void>;
}
export interface PrivateBucket {
 put(key:string,body:Uint8Array,options:{httpMetadata:{contentType:string;cacheControl:string}}):Promise<unknown>;
 get(key:string):Promise<{arrayBuffer():Promise<ArrayBuffer>}|null>;
 delete(key:string):Promise<void>;
}
export interface ImageSanitizer {reencode(input:Uint8Array):Promise<{bytes:Uint8Array;mime:'image/jpeg'|'image/png'|'image/webp';width:number;height:number;metadataRemoved:true}>}
const validId=(v:string)=>/^[A-Za-z0-9_-]{1,128}$/.test(v);
const fail=(code:'invalid'|'forbidden'|'conflict'):never=>{throw new PrivateFamilyError(code);};
const safeKey=(r:PrivateMediaRow)=>{if(!validId(r.id)||r.objectKey!==`private-family/${r.id}`)fail('conflict');return r.objectKey;};
export class DraftPrivateMedia {
 constructor(private readonly bucket:PrivateBucket,private readonly catalog:MediaCatalog,private readonly sanitizer:ImageSanitizer){}
 async upload(principal:string,candidateId:string,purpose:MediaPurpose,input:Uint8Array){
  if(!principal||!validId(candidateId)||!['recipe_source','dish_cover'].includes(purpose)||!input.byteLength||input.byteLength>IMAGE_LIMIT)fail('invalid');
  const image=await this.sanitizer.reencode(input);
  if(image.metadataRemoved!==true||!['image/jpeg','image/png','image/webp'].includes(image.mime)||!image.bytes.byteLength||image.bytes.byteLength>IMAGE_LIMIT||!Number.isSafeInteger(image.width)||!Number.isSafeInteger(image.height)||image.width<1||image.height<1||image.width>8192||image.height>8192||image.width*image.height>25_000_000)fail('invalid');
  // Catalog reserves both one-per-purpose and account pending byte quota. It
  // must not expose a reservation as readable. IDs/keys are server generated.
  const row=await this.catalog.reserve(principal,candidateId,purpose,image.bytes.byteLength);
  if(row.ownerId!==principal||row.candidateId!==candidateId||row.purpose!==purpose||row.state!=='reserved')fail('forbidden');
  const key=safeKey(row);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',image.bytes as Uint8Array<ArrayBuffer>)),b=>b.toString(16).padStart(2,'0')).join('');
  await this.bucket.put(key,image.bytes,{httpMetadata:{contentType:image.mime,cacheControl:'private, no-store'}});
  if(!await this.catalog.verify(principal,row.id,digest,image.bytes.byteLength)){
   // Leave reservation non-readable and deletion resumable. Do not delete an
   // object that might have been committed after an unknown verify outcome.
   fail('conflict');
  }
  return {id:row.id,digest,bytes:image.bytes.byteLength};
 }
 async read(principal:string,id:string):Promise<Uint8Array>{
  if(!principal||!validId(id))fail('invalid');
  const before=await this.catalog.authorize(principal,id);
  if(!before||before.id!==id||before.state!=='verified'||!before.digest)fail('forbidden');
  const object=await this.bucket.get(safeKey(before!));if(!object)fail('conflict');
  const bytes=new Uint8Array(await object!.arrayBuffer());
  if(bytes.byteLength>IMAGE_LIMIT||bytes.byteLength!==before!.bytes)fail('conflict');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const after=await this.catalog.authorize(principal,id);
  if(!after||after.state!=='verified'||after.id!==id||after.digest!==digest||after.objectKey!==before!.objectKey)fail('forbidden');
  return bytes; // Future HTTP adapter MUST set private,no-store and nosniff.
 }
 async erase(principal:string,id:string){
  if(!principal||!validId(id))fail('invalid');
  const row=await this.catalog.beginDelete(principal,id);
  if(!row||row.id!==id||row.ownerId!==principal||row.state!=='deleting')fail('forbidden');
  await this.bucket.delete(safeKey(row!));
  await this.catalog.finishDelete(id);
 }
}
