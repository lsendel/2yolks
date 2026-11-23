import {describe,it,expect} from 'vitest';
import {submit,review,accept,withdraw,readFamilyVersion,removeMember,replayReceipt,checkQuota,validateVersion,abandonedDraftEligible,PRIVATE_FAMILY_ENABLED,DRAFT_RETENTION_ENABLED,IMAGE_LIMIT,PENDING_MEDIA_LIMIT,type Candidate,type Family,type Version} from './privateFamily';
const version=():Version=>({id:'v1',digest:'a'.repeat(64),text:'Eggs\nCook gently',locale:'en',media:[{id:'cover',purpose:'dish_cover',bytes:68,verified:true,rights:true},{id:'source',purpose:'recipe_source',bytes:68,verified:true,rights:true}]});
const family=():Family=>({id:'f1',revision:1,members:[{userId:'a',role:'owner',active:true},{userId:'b',role:'member',active:true},{userId:'admin',role:'admin',active:true}]});
const draft=():Candidate=>({id:'c1',ownerId:'a',familyId:'f1',revision:1,state:'draft',submitted:version()});
function preview(){let c=submit(draft(),'a',family(),1);return review(c,'reviewer',true,c.revision,{kind:'preview',version:{...version(),id:'v2',digest:'b'.repeat(64)}});}
function shared(){let c=preview();return accept(c,'a',family(),c.revision,'b'.repeat(64),'private-family-v1');}
describe('private family foundation (not deployed)',()=>{
 it('is disabled including retention',()=>{expect(PRIVATE_FAMILY_ENABLED).toBe(false);expect(DRAFT_RETENTION_ENABLED).toBe(false);expect(abandonedDraftEligible('draft',40)).toBe(false);});
 it('pins submission, reviews and requires exact owner acceptance',()=>{let c=preview();expect(c.state).toBe('awaiting_contributor');expect(shared().state).toBe('family_shared');});
 it('copies snapshots instead of mutating source objects',()=>{let c=draft();let next=submit(c,'a',family(),1);c.submitted.text='changed';expect(next.submitted.text).not.toBe('changed');});
 it('denies other users and nonmembers',()=>{expect(()=>submit(draft(),'b',family(),1)).toThrow('forbidden');let f=family();f.members[0]!.active=false;expect(()=>submit(draft(),'a',f,1)).toThrow('forbidden');});
 it('rejects stale revisions',()=>expect(()=>submit(draft(),'a',family(),0)).toThrow('conflict'));
 it('denies self review and false reviewer grant',()=>{let c=submit(draft(),'a',family(),1);expect(()=>review(c,'a',true,2,{kind:'in_review'})).toThrow('forbidden');expect(()=>review(c,'b',false,2,{kind:'in_review'})).toThrow('forbidden');});
 it('cannot share a draft or a different digest',()=>{expect(()=>accept(draft(),'a',family(),1,'a'.repeat(64),'private-family-v1')).toThrow('conflict');let c=preview();expect(()=>accept(c,'a',family(),c.revision,'a'.repeat(64),'private-family-v1')).toThrow('conflict');});
 it('checks membership again at acceptance',()=>{let c=preview(),f=family();f.members[0]!.active=false;expect(()=>accept(c,'a',f,c.revision,'b'.repeat(64),'private-family-v1')).toThrow('forbidden');});
 it('requires correct consent version',()=>{let c=preview();expect(()=>accept(c,'a',family(),c.revision,'b'.repeat(64),'public')).toThrow('invalid');});
 it('duplicate acceptance does not create another version',()=>{let c=shared();expect(accept(c,'a',family(),c.revision,'b'.repeat(64),'private-family-v1')).toEqual(c);});
 it('hides raw sources and revokes removed members on the next read',()=>{let c=shared();expect(readFamilyVersion(c,'b',family()).media.map(m=>m.purpose)).toEqual(['dish_cover']);let f=removeMember(family(),'a','b',1);expect(()=>readFamilyVersion(c,'b',f)).toThrow('forbidden');});
 it('denies cross-family object reads',()=>expect(()=>readFamilyVersion(shared(),'b',{...family(),id:'other'})).toThrow('forbidden'));
 it('withdrawal prevents sharing and family reads',()=>{let c=shared();c=withdraw(c,'a',c.revision);expect(()=>readFamilyVersion(c,'b',family())).toThrow('forbidden');expect(c.acceptedDigest).toBeUndefined();});
 it('requires admin approval and prevents owner removal',()=>{expect(()=>removeMember(family(),'b','admin',1)).toThrow('forbidden');expect(()=>removeMember(family(),'admin','a',1)).toThrow('forbidden');});
 it('supports source-photo-only intake but not source-only sharing',()=>{let v=version();v.text='';v.media=v.media.filter(m=>m.purpose==='recipe_source');expect(()=>validateVersion(v)).not.toThrow();expect(()=>validateVersion(v,true)).toThrow('invalid');});
 it.each(['verified','rights'] as const)('requires media %s',field=>{let v=version();v.media[0]![field]=false;expect(()=>validateVersion(v)).toThrow();});
 it('enforces one image of each purpose and exact size',()=>{let v=version();v.media[0]!.bytes=IMAGE_LIMIT;expect(()=>validateVersion(v)).not.toThrow();v.media[0]!.bytes++;expect(()=>validateVersion(v)).toThrow('invalid');v=version();v.media[1]!.purpose='dish_cover';expect(()=>validateVersion(v)).toThrow('invalid');});
 it('checks pending quota including replacements',()=>{expect(()=>checkQuota(PENDING_MEDIA_LIMIT,IMAGE_LIMIT,IMAGE_LIMIT)).not.toThrow();expect(()=>checkQuota(PENDING_MEDIA_LIMIT,0,1)).toThrow('quota');expect(()=>checkQuota(0,1,0)).toThrow('invalid');});
 it('binds receipts to principal and immutable request digest',()=>{let r={principal:'a',key:'key',requestDigest:'digest',result:{id:'c1'}};expect(replayReceipt(r,'a','key','digest')).toEqual({id:'c1'});expect(()=>replayReceipt(r,'b','key','digest')).toThrow('forbidden');expect(()=>replayReceipt(r,'a','key','changed')).toThrow('conflict');});
 it('30day eligibility never targets submitted/shared history',()=>{expect(abandonedDraftEligible('draft',30,true)).toBe(true);for(const state of ['received','family_shared','declined','withdrawn'] as const)expect(abandonedDraftEligible(state,100,true)).toBe(false);});
});
import {approveJoin,revise} from './privateFamily';
describe('membership approval and revision',()=>{
 const request=()=>({id:'join',familyId:'f1',requesterId:'new',state:'pending' as const,expiresAt:100});
 it('admin approves and new member reads existing accepted recipe',()=>{let result=approveJoin(family(),request(),'admin',1,99);expect(result.request.state).toBe('approved');expect(readFamilyVersion(shared(),'new',result.family).text).toBeTruthy();});
 it('ordinary members cannot approve or self-admit',()=>expect(()=>approveJoin(family(),request(),'new',1,50)).toThrow('forbidden'));
 it('rejects expiry, replay, family mismatch and stale membership revision',()=>{expect(()=>approveJoin(family(),request(),'a',1,100)).toThrow('conflict');expect(()=>approveJoin(family(),{...request(),state:'approved'},'a',1,1)).toThrow('conflict');expect(()=>approveJoin(family(),{...request(),familyId:'other'},'a',1,1)).toThrow('conflict');expect(()=>approveJoin(family(),request(),'a',0,1)).toThrow('conflict');});
 it('requires a new immutable version after needs_changes',()=>{let c=submit(draft(),'a',family(),1);c=review(c,'reviewer',true,c.revision,{kind:'needs_changes'});expect(()=>revise(c,'a',c.revision,c.submitted)).toThrow('conflict');let v={...version(),id:'v3',digest:'c'.repeat(64)};c=revise(c,'a',c.revision,v);expect(submit(c,'a',family(),c.revision).state).toBe('received');});
 it('cannot rewrite a shared version',()=>{let c=shared();expect(()=>revise(c,'a',c.revision,{...version(),id:'v3',digest:'c'.repeat(64)})).toThrow('conflict');});
});
