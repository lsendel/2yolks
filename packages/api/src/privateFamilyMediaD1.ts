/** Unmounted D1 catalog experiment. Uses existing draft aggregate row for
 * membership/candidate authorization, plus a proposed upload-slot table. No
 * schema execution, binding or route. Every statement is parameterized.
 * SQLite serializes each conditional write; no JS read-then-write quota claim.
 */
import {PrivateFamilyError,IMAGE_LIMIT,PENDING_MEDIA_LIMIT,type MediaPurpose} from './privateFamily';
import type {MediaCatalog,PrivateMediaRow} from './privateFamilyMedia';
import type {DraftD1} from './privateFamilyD1';
const fail=(code:'invalid'|'forbidden'|'conflict'|'quota'):never=>{throw new PrivateFamilyError(code);};
const MEMBER=`EXISTS (SELECT 1 FROM private_family_aggregates a, json_each(a.document,'$.family.members') m WHERE a.family_id=s.family_id AND json_extract(m.value,'$.userId')=? AND json_extract(m.value,'$.active')=1)`;
// Owner only for this milestone. Family cover/reviewer rights are not inferred.
const CANDIDATE=`EXISTS (SELECT 1 FROM private_family_aggregates a,json_each(a.document,'$.candidates') c WHERE a.family_id=s.family_id AND json_extract(c.value,'$.id')=s.candidate_id AND json_extract(c.value,'$.ownerId')=s.owner_id AND json_extract(c.value,'$.state') IN ('draft','needs_changes'))`;
type Slot={id:string;owner_id:string;candidate_id:string;purpose:MediaPurpose;object_key:string;state:PrivateMediaRow['state'];digest:string|null;bytes:number};
const map=(r:Slot):PrivateMediaRow=>({id:r.id,ownerId:r.owner_id,candidateId:r.candidate_id,purpose:r.purpose,objectKey:r.object_key,state:r.state,bytes:r.bytes,...(r.digest?{digest:r.digest}:{})});
export class DraftD1MediaCatalog implements MediaCatalog {
 constructor(private readonly db:DraftD1,private readonly familyId:string,private readonly newId:()=>string=()=>crypto.randomUUID()){}
 async reserve(principal:string,candidateId:string,purpose:MediaPurpose,bytes:number):Promise<PrivateMediaRow>{
  if(!principal||!candidateId||!['recipe_source','dish_cover'].includes(purpose)||!Number.isSafeInteger(bytes)||bytes<1||bytes>IMAGE_LIMIT)fail('invalid');
  const id=this.newId();if(!/^[A-Za-z0-9_-]{8,128}$/.test(id))fail('invalid');
  // The unique partial index also prevents duplicate active purpose slots.
  const sql=`INSERT INTO private_family_upload_slots (id,owner_id,family_id,candidate_id,purpose,object_key,state,bytes,digest)
 SELECT ?,?,?,?,?,?,'reserved',?,NULL WHERE
 EXISTS (SELECT 1 FROM private_family_aggregates a,json_each(a.document,'$.family.members') m,json_each(a.document,'$.candidates') c WHERE a.family_id=? AND json_extract(m.value,'$.userId')=? AND json_extract(m.value,'$.active')=1 AND json_extract(c.value,'$.id')=? AND json_extract(c.value,'$.ownerId')=? AND json_extract(c.value,'$.state') IN ('draft','needs_changes'))
 AND NOT EXISTS (SELECT 1 FROM private_family_upload_slots WHERE family_id=? AND candidate_id=? AND purpose=? AND state!='deleted')
 AND (SELECT COALESCE(SUM(bytes),0) FROM private_family_upload_slots WHERE owner_id=? AND state!='deleted')+?<=?`;
  const result=await this.db.prepare(sql).bind(id,principal,this.familyId,candidateId,purpose,`private-family/${id}`,bytes,this.familyId,principal,candidateId,principal,this.familyId,candidateId,purpose,principal,bytes,PENDING_MEDIA_LIMIT).run();
  if(!result.success||result.meta?.changes!==1)fail('conflict');
  return {id,ownerId:principal,candidateId,purpose,objectKey:`private-family/${id}`,state:'reserved',bytes};
 }
 async verify(principal:string,id:string,digest:string,bytes:number):Promise<boolean>{
  if(!/^[a-f0-9]{64}$/.test(digest)||!Number.isSafeInteger(bytes)||bytes<1||bytes>IMAGE_LIMIT)fail('invalid');
  const result=await this.db.prepare(`UPDATE private_family_upload_slots AS s SET state='verified',digest=? WHERE id=? AND owner_id=? AND family_id=? AND state='reserved' AND bytes=? AND ${MEMBER} AND ${CANDIDATE}`).bind(digest,id,principal,this.familyId,bytes,principal).run();
  return result.success&&result.meta?.changes===1;
 }
 async authorize(principal:string,id:string):Promise<PrivateMediaRow|null>{
  // Restrictive by design: only the contributor reads draft source/cover here.
  // Sharing a dish cover later needs immutable accepted-version rights checks.
  const row=await this.db.prepare(`SELECT s.* FROM private_family_upload_slots s WHERE s.id=? AND s.owner_id=? AND s.family_id=? AND s.state='verified' AND ${MEMBER} AND ${CANDIDATE}`).bind(id,principal,this.familyId,principal).first<Slot>();
  return row?map(row):null;
 }
 async beginDelete(principal:string,id:string):Promise<PrivateMediaRow|null>{
  // An owner may remove private draft media after family membership is revoked.
  // Deliberately no family-admin power over another contributor's source photo.
  const updated=await this.db.prepare(`UPDATE private_family_upload_slots SET state='deleting' WHERE id=? AND owner_id=? AND family_id=? AND state IN ('reserved','verified','deleting')`).bind(id,principal,this.familyId).run();
  if(!updated.success||updated.meta?.changes!==1)return null;
  const row=await this.db.prepare(`SELECT * FROM private_family_upload_slots WHERE id=? AND owner_id=? AND family_id=? AND state='deleting'`).bind(id,principal,this.familyId).first<Slot>();return row?map(row):null;
 }
 async finishDelete(id:string):Promise<void>{
  const result=await this.db.prepare(`UPDATE private_family_upload_slots SET state='deleted',bytes=0,digest=NULL WHERE id=? AND family_id=? AND state='deleting'`).bind(id,this.familyId).run();
  if(!result.success||result.meta?.changes!==1)fail('conflict');
 }
}
