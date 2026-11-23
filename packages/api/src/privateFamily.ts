/** Phase1 foundation only. No route, DB/R2 adapter, model, mail or scheduler.
 * Public recipe/photo promotion must never call this module implicitly.
 * Every operation gets the authenticated principal from the future adapter.
 */
export const PRIVATE_FAMILY_ENABLED = false;
export const DRAFT_RETENTION_ENABLED = false; // legal/privacy review + deployment approval required
export const IMAGE_LIMIT = 3 * 1024 * 1024;
export const PENDING_MEDIA_LIMIT = 25 * 1024 * 1024;
export type Role = 'owner' | 'admin' | 'member';
export type Membership = { userId: string; role: Role; active: boolean };
export type Family = { id: string; revision: number; members: Membership[] };
export type MediaPurpose = 'recipe_source' | 'dish_cover';
export type Media = { id: string; purpose: MediaPurpose; bytes: number; verified: boolean; rights: boolean };
export type Version = { id: string; digest: string; text: string; locale: string; media: Media[] };
export type CandidateState = 'draft' | 'received' | 'in_review' | 'needs_changes' | 'declined' | 'awaiting_contributor' | 'family_shared' | 'withdrawn';
export type Candidate = {
  id: string; ownerId: string; familyId: string; revision: number; state: CandidateState;
  submitted: Version; improved?: Version; acceptedDigest?: string; acceptedBy?: string; consentVersion?: string;
};
export class PrivateFamilyError extends Error {
  constructor(public readonly code: 'forbidden' | 'conflict' | 'invalid' | 'quota') { super(code); }
}
const fail = (code: PrivateFamilyError['code']): never => { throw new PrivateFamilyError(code); };
const requireValue = (condition: unknown, code: PrivateFamilyError['code']) => { if (!condition) fail(code); };
export const activeMember = (f: Family, userId: string) => f.members.find(m => m.userId === userId && m.active);
export const canManage = (f: Family, userId: string) => ['owner', 'admin'].includes(activeMember(f, userId)?.role ?? '');
export function validateVersion(v: Version, readyToShare = false): void {
  requireValue(v.id && /^[a-f0-9]{64}$/.test(v.digest) && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(v.locale), 'invalid');
  requireValue(v.text.length <= 64_000 && v.media.length <= 2, 'invalid');
  requireValue(v.text.trim() || v.media.some(m => m.purpose === 'recipe_source'), 'invalid');
  const purposes = new Set<string>();
  for (const media of v.media) {
    requireValue(media.id && !purposes.has(media.purpose) && ['recipe_source','dish_cover'].includes(media.purpose), 'invalid');
    requireValue(media.verified && Number.isSafeInteger(media.bytes) && media.bytes > 0 && media.bytes <= IMAGE_LIMIT, 'invalid');
    requireValue(media.rights, 'forbidden'); purposes.add(media.purpose);
  }
  if (readyToShare) {
    requireValue(v.text.trim() && v.media.some(m => m.purpose === 'dish_cover' && m.rights), 'invalid');
  }
}
export function checkQuota(existingPendingBytes: number, replacedBytes: number, newBytes: number): void {
  requireValue([existingPendingBytes,replacedBytes,newBytes].every(n => Number.isSafeInteger(n) && n >= 0), 'invalid');
  requireValue(replacedBytes <= existingPendingBytes, 'invalid');
  requireValue(existingPendingBytes - replacedBytes + newBytes <= PENDING_MEDIA_LIMIT, 'quota');
}
/** Pure state calculation, not an atomic write. DB adapter MUST CAS revision and
 * re-check membership inside the same transaction that binds the family share. */
export function submit(c: Candidate, principal: string, family: Family, expectedRevision: number): Candidate {
  requireValue(c.ownerId === principal && c.familyId === family.id && activeMember(family, principal), 'forbidden');
  requireValue(c.revision === expectedRevision && ['draft','needs_changes'].includes(c.state), 'conflict');
  validateVersion(c.submitted);
  return structuredClone({ ...c, revision:c.revision+1, state:'received', improved:undefined, acceptedDigest:undefined, acceptedBy:undefined, consentVersion:undefined });
}
export type ReviewDecision = { kind:'in_review' | 'needs_changes' | 'declined' } | { kind:'preview'; version:Version };
export function review(c: Candidate, principal: string, authorizedReviewer: boolean, expectedRevision:number, decision:ReviewDecision): Candidate {
  requireValue(authorizedReviewer && principal !== c.ownerId, 'forbidden');
  requireValue(c.revision === expectedRevision && ['received','in_review'].includes(c.state), 'conflict');
  if (decision.kind === 'preview') validateVersion(decision.version, true);
  return structuredClone({ ...c, revision:c.revision+1, state: decision.kind === 'preview' ? 'awaiting_contributor' : decision.kind,
    improved: decision.kind === 'preview' ? decision.version : undefined, acceptedDigest:undefined, acceptedBy:undefined, consentVersion:undefined });
}
export function accept(c: Candidate, principal:string, family:Family, expectedRevision:number, digest:string, consentVersion:string):Candidate {
  requireValue(c.ownerId === principal && c.familyId === family.id && activeMember(family,principal), 'forbidden');
  requireValue(consentVersion === 'private-family-v1', 'invalid');
  // An idempotent receipt must wrap acceptance in the persistence adapter. A
  // duplicate domain command still cannot alter consent or the exact version.
  if(c.state === 'family_shared' && c.acceptedBy === principal && c.acceptedDigest === digest && c.consentVersion === consentVersion) return structuredClone(c);
  requireValue(c.revision === expectedRevision && c.state === 'awaiting_contributor' && c.improved?.digest === digest, 'conflict');
  validateVersion(c.improved!,true);
  return structuredClone({...c,revision:c.revision+1,state:'family_shared',acceptedBy:principal,acceptedDigest:digest,consentVersion});
}
export function withdraw(c:Candidate, principal:string, expectedRevision:number):Candidate {
  requireValue(c.ownerId === principal,'forbidden');
  requireValue(c.revision === expectedRevision,'conflict');
  return structuredClone({...c,revision:c.revision+1,state:'withdrawn',acceptedDigest:undefined,acceptedBy:undefined,consentVersion:undefined});
}
/** Owner can inspect sources. Current family readers get accepted improved
 * text/cover only. Reviewer-source access needs separate adapter authorization. */
export function readFamilyVersion(c:Candidate, principal:string, family:Family): Version {
  requireValue(c.familyId === family.id && c.state === 'family_shared' && activeMember(family,principal),'forbidden');
  requireValue(c.improved && c.improved.digest === c.acceptedDigest,'conflict');
  return structuredClone({...c.improved!,media:c.improved!.media.filter(m=>m.purpose === 'dish_cover')});
}
export function removeMember(f:Family, principal:string, target:string, expectedRevision:number):Family {
  requireValue(canManage(f,principal),'forbidden');
  requireValue(f.revision === expectedRevision,'conflict');
  const member=activeMember(f,target);requireValue(member,'invalid');
  requireValue(member!.role !== 'owner','forbidden'); // ownership transfer is a separate accepted operation
  requireValue(member!.role !== 'admin' || activeMember(f,principal)?.role === 'owner','forbidden');
  return {...structuredClone(f),revision:f.revision+1,members:f.members.map(m=>({...m,active:m.userId===target?false:m.active}))};
}
export type Receipt = { principal:string; key:string; requestDigest:string; result:unknown };
export function replayReceipt(receipt:Receipt, principal:string, key:string, requestDigest:string):unknown {
  requireValue(receipt.principal===principal,'forbidden');
  requireValue(receipt.key===key && receipt.requestDigest===requestDigest,'conflict');
  return structuredClone(receipt.result);
}
/** No timer is wired. A cleanup adapter needs a new deployment decision and
 * policy review; never delete submitted, accepted or audit/version records. */
export function abandonedDraftEligible(state:CandidateState, ageDays:number, enabled:boolean = DRAFT_RETENTION_ENABLED):boolean {
  return enabled && state==='draft' && Number.isFinite(ageDays) && ageDays>=30;
}
export type JoinRequest = { id:string; familyId:string; requesterId:string; state:'pending'|'approved'|'rejected'; expiresAt:number };
/** A join link may prefill a request, but cannot grant family read access. */
export function approveJoin(f:Family, request:JoinRequest, principal:string, expectedRevision:number, now:number):{family:Family;request:JoinRequest} {
  requireValue(canManage(f,principal) && principal!==request.requesterId,'forbidden');
  requireValue(f.id===request.familyId && f.revision===expectedRevision && request.state==='pending' && now<request.expiresAt,'conflict');
  requireValue(!activeMember(f,request.requesterId),'conflict');
  return {family:{...structuredClone(f),revision:f.revision+1,members:[...f.members.filter(m=>m.userId!==request.requesterId).map(m=>({...m})),{userId:request.requesterId,role:'member',active:true}]},request:{...request,state:'approved'}};
}
export function revise(c:Candidate, principal:string, expectedRevision:number, version:Version):Candidate {
  requireValue(c.ownerId===principal,'forbidden');
  requireValue(c.revision===expectedRevision && ['draft','needs_changes'].includes(c.state),'conflict');
  validateVersion(version);
  requireValue(version.id!==c.submitted.id && version.digest!==c.submitted.digest,'conflict');
  return structuredClone({...c,revision:c.revision+1,submitted:version,improved:undefined,acceptedBy:undefined,acceptedDigest:undefined,consentVersion:undefined});
}
