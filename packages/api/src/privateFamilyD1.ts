/** Unmounted draft D1 adapter. No binding or environment configuration.
 * One private family aggregate is the serializable unit. Candidate, membership,
 * shares and receipts live in one row and commit in ONE conditional UPDATE.
 * Every future writer (removal/withdrawal/review included) must use this CAS.
 * This is deliberately NOT an arbitrary callback wrapped in fake BEGIN/COMMIT.
 */
import {PrivateFamilyError,type Candidate,type Family,type Receipt} from './privateFamily';
import type {PrivateFamilyStore,PrivateFamilyTransaction} from './privateFamilyService';
export type FamilyAggregate={family:Family;candidates:Candidate[];receipts:Receipt[]};
export interface DraftD1Statement {
 bind(...values:unknown[]):DraftD1Statement;
 first<T>():Promise<T|null>;
 run():Promise<{success:boolean;meta?:{changes?:number}}>;
}
export interface DraftD1 {prepare(sql:string):DraftD1Statement}
const conflict=():never=>{throw new PrivateFamilyError('conflict');};
const forbidden=():never=>{throw new PrivateFamilyError('forbidden');};
export class DraftD1FamilyStore implements PrivateFamilyStore {
 constructor(private readonly db:DraftD1,private readonly familyId:string){}
 async transaction<T>(work:(tx:PrivateFamilyTransaction)=>Promise<T>):Promise<T>{
  const row=await this.db.prepare('SELECT revision, document FROM private_family_aggregates WHERE family_id=?').bind(this.familyId).first<{revision:number;document:string}>();
  if(!row)forbidden();
  if(new TextEncoder().encode(row!.document).byteLength>512_000)conflict();
  const snapshot:FamilyAggregate=JSON.parse(row!.document);
  if(!snapshot.family||!Array.isArray(snapshot.candidates)||!Array.isArray(snapshot.receipts)||!Array.isArray(snapshot.family.members)||snapshot.family.members.length>100||snapshot.candidates.length>100||snapshot.receipts.length>500)conflict();
  if(snapshot.family.id!==this.familyId||!Number.isSafeInteger(row!.revision)||row!.revision<1)conflict();
  const next=structuredClone(snapshot);let bound=false;let saved=false;
  const tx:PrivateFamilyTransaction={
   candidate:async id=>structuredClone(next.candidates.find(c=>c.id===id)??null),
   family:async id=>id===this.familyId?structuredClone(next.family):null,
   receipt:async(principal,key)=>structuredClone(next.receipts.find(r=>r.principal===principal&&r.key===key)??null),
   acceptAndBind:async(candidate,candidateRevision,familyRevision)=>{
    const i=next.candidates.findIndex(c=>c.id===candidate.id);
    if(bound||i<0||candidate.familyId!==this.familyId||next.family.revision!==familyRevision||next.candidates[i]!.revision!==candidateRevision)conflict();
    next.candidates[i]=structuredClone(candidate);bound=true;
   },
   saveReceipt:async receipt=>{
    if(!bound||saved||next.receipts.some(r=>r.principal===receipt.principal&&r.key===receipt.key))conflict();
    next.receipts.push(structuredClone(receipt));saved=true;
   }
  };
  const result=await work(tx);
  if(bound!==saved)conflict();
  if(bound){
   // The old JSON guard also protects a writer that failed to bump revision.
   // No auto retry: an unknown outcome must reconcile its principal-bound key.
   if(next.receipts.length>500||new TextEncoder().encode(JSON.stringify(next)).byteLength>512_000)throw new PrivateFamilyError('quota');
   const written=await this.db.prepare('UPDATE private_family_aggregates SET document=?, revision=revision+1 WHERE family_id=? AND revision=? AND document=?')
    .bind(JSON.stringify(next),this.familyId,row!.revision,row!.document).run();
   if(!written.success||written.meta?.changes!==1)conflict();
  }else{
   // Read/replay access is current at this second read, not a long-lived grant.
   const current=await this.db.prepare('SELECT revision, document FROM private_family_aggregates WHERE family_id=?').bind(this.familyId).first<{revision:number;document:string}>();
   if(!current||current.revision!==row!.revision||current.document!==row!.document)conflict();
  }
  return result;
 }
}
