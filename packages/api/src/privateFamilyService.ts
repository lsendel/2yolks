import { accept, readFamilyVersion, replayReceipt, type Candidate, type Family, type Receipt, type Version, PrivateFamilyError } from './privateFamily';

/** Contract only: no production DB implementation exists. Each transaction must
 * serialize/CAS candidate revision, membership, receipt insertion and share bind
 * together. Implementations must roll back if any part fails. */
export interface PrivateFamilyTransaction {
  candidate(id:string):Promise<Candidate|null>;
  family(id:string):Promise<Family|null>;
  receipt(principal:string,key:string):Promise<Receipt|null>;
  acceptAndBind(next:Candidate, expectedCandidateRevision:number, expectedFamilyRevision:number):Promise<void>;
  saveReceipt(receipt:Receipt):Promise<void>;
}
export interface PrivateFamilyStore {
  transaction<T>(work:(tx:PrivateFamilyTransaction)=>Promise<T>):Promise<T>;
}
export type AcceptanceInput={candidateId:string;familyId:string;expectedRevision:number;digest:string;consentVersion:string;key:string};
export type AcceptanceReceipt={candidateId:string;familyId:string;revision:number;state:'family_shared';digest:string};
const check=(condition:unknown,code:'invalid'|'forbidden'|'conflict')=>{if(!condition)throw new PrivateFamilyError(code);};
export async function requestDigest(input:AcceptanceInput):Promise<string>{
  // Fixed field order, no client digest for the idempotency request body.
  const canonical=JSON.stringify([input.candidateId,input.familyId,input.expectedRevision,input.digest,input.consentVersion]);
  const bytes=new TextEncoder().encode(canonical);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function acceptPrivateVersion(store:PrivateFamilyStore, authenticatedPrincipal:string, input:AcceptanceInput):Promise<AcceptanceReceipt>{
  check(authenticatedPrincipal && /^[A-Za-z0-9_-]{8,128}$/.test(input.key),'invalid');
  check(input.candidateId.length>0 && input.familyId.length>0 && Number.isSafeInteger(input.expectedRevision) && input.expectedRevision>0 && /^[a-f0-9]{64}$/.test(input.digest),'invalid');
  const digest=await requestDigest(input);
  return store.transaction(async tx=>{
    const c=await tx.candidate(input.candidateId);
    check(c && c.ownerId===authenticatedPrincipal && c.familyId===input.familyId,'forbidden');
    const f=await tx.family(input.familyId);
    check(f && f.members.some(m=>m.userId===authenticatedPrincipal && m.active),'forbidden');
    // Recheck state/withdrawal before replay, so a historical success does not
    // falsely imply current access after revocation. Never creates a new share.
    check(c!.state!=='withdrawn','conflict');
    const prior=await tx.receipt(authenticatedPrincipal,input.key);
    if(prior)return replayReceipt(prior,authenticatedPrincipal,input.key,digest) as AcceptanceReceipt;
    const next=accept(c!,authenticatedPrincipal,f!,input.expectedRevision,input.digest,input.consentVersion);
    const result:AcceptanceReceipt={candidateId:next.id,familyId:next.familyId,revision:next.revision,state:'family_shared',digest:next.acceptedDigest!};
    await tx.acceptAndBind(next,c!.revision,f!.revision);
    await tx.saveReceipt({principal:authenticatedPrincipal,key:input.key,requestDigest:digest,result});
    return result;
  });
}
export async function readPrivateVersion(store:PrivateFamilyStore, authenticatedPrincipal:string, candidateId:string):Promise<Version>{
  return store.transaction(async tx=>{
    const c=await tx.candidate(candidateId);check(c,'forbidden');
    const f=await tx.family(c!.familyId);check(f,'forbidden');
    return readFamilyVersion(c!,authenticatedPrincipal,f!);
  });
}
