import {describe,it,expect,vi} from 'vitest';
import {acceptPrivateVersion,requestDigest,readPrivateVersion,type AcceptanceInput,type PrivateFamilyStore,type PrivateFamilyTransaction} from './privateFamilyService';
import type {Candidate,Family,Receipt} from './privateFamily';
const input=():AcceptanceInput=>({candidateId:'c',familyId:'f',expectedRevision:3,digest:'b'.repeat(64),consentVersion:'private-family-v1',key:'stable-key'});
function fixture(){
 let c:Candidate={id:'c',ownerId:'a',familyId:'f',revision:3,state:'awaiting_contributor',submitted:{id:'v1',digest:'a'.repeat(64),text:'source',locale:'es',media:[]},improved:{id:'v2',digest:'b'.repeat(64),text:'improved',locale:'es',media:[{id:'p',purpose:'dish_cover',bytes:1,verified:true,rights:true},{id:'s',purpose:'recipe_source',bytes:1,verified:true,rights:true}]}};
 let f:Family={id:'f',revision:1,members:[{userId:'a',role:'owner',active:true},{userId:'b',role:'member',active:true}]};
 let receipt:Receipt|null=null;
 const bind=vi.fn(async(next:Candidate,revision:number,familyRevision:number)=>{if(c.revision!==revision||f.revision!==familyRevision)throw Error('CAS');c=structuredClone(next);});
 const tx:PrivateFamilyTransaction={candidate:async()=>structuredClone(c),family:async()=>structuredClone(f),receipt:async()=>receipt,acceptAndBind:bind,saveReceipt:async r=>{receipt=structuredClone(r);}};
 const store:PrivateFamilyStore={transaction:async work=>work(tx)};
 return {store,bind,c:()=>c,f,tx};
}
describe('private family service contract, fake transaction only',()=>{
 it('writes one share binding and returns the persisted operation receipt',async()=>{let x=fixture();let result=await acceptPrivateVersion(x.store,'a',input());expect(result.state).toBe('family_shared');expect(x.bind).toHaveBeenCalledWith(expect.objectContaining({state:'family_shared'}),3,1);});
 it('reconciles unknown response by principal-bound stable key without a duplicate bind',async()=>{let x=fixture();let first=await acceptPrivateVersion(x.store,'a',input());expect(await acceptPrivateVersion(x.store,'a',input())).toEqual(first);expect(x.bind).toHaveBeenCalledTimes(1);});
 it('rejects changed payload on replay',async()=>{let x=fixture();await acceptPrivateVersion(x.store,'a',input());await expect(acceptPrivateVersion(x.store,'a',{...input(),digest:'c'.repeat(64)})).rejects.toThrow('conflict');});
 it('does not replay success after membership removal or withdrawal',async()=>{let x=fixture();await acceptPrivateVersion(x.store,'a',input());x.f.members[0]!.active=false;await expect(acceptPrivateVersion(x.store,'a',input())).rejects.toThrow('forbidden');x.f.members[0]!.active=true;x.c().state='withdrawn';await expect(acceptPrivateVersion(x.store,'a',input())).rejects.toThrow('conflict');});
 it('rejects wrong principal, family, revision and digest without binding',async()=>{let x=fixture();for(const [p,v] of [['b',input()],['a',{...input(),familyId:'other'}],['a',{...input(),expectedRevision:2}],['a',{...input(),digest:'a'.repeat(64)}]] as const)await expect(acceptPrivateVersion(x.store,p,v)).rejects.toThrow();expect(x.bind).not.toHaveBeenCalled();});
 it('does not return success if binding or receipt persistence fails',async()=>{let x=fixture();x.tx.acceptAndBind=async()=>{throw Error('storage')};await expect(acceptPrivateVersion(x.store,'a',input())).rejects.toThrow('storage');x=fixture();x.tx.saveReceipt=async()=>{throw Error('receipt')};await expect(acceptPrivateVersion(x.store,'a',input())).rejects.toThrow('receipt');});
 it('reads only current member allowed version and strips source photo',async()=>{let x=fixture();await acceptPrivateVersion(x.store,'a',input());expect((await readPrivateVersion(x.store,'b','c')).media.map(m=>m.id)).toEqual(['p']);x.f.members[1]!.active=false;await expect(readPrivateVersion(x.store,'b','c')).rejects.toThrow('forbidden');});
 it('canonical digest is repeatable and sensitive to all acceptance fields',async()=>{let a=input();expect(await requestDigest(a)).toEqual(await requestDigest({...a}));for(const patch of [{familyId:'other'},{expectedRevision:4},{candidateId:'x'},{consentVersion:'other'},{digest:'c'.repeat(64)}])expect(await requestDigest({...a,...patch})).not.toEqual(await requestDigest(a));});
});
describe('fail closed against inconsistent store results',()=>{
 it('rejects a store returning the wrong candidate or family',async()=>{let x=fixture();x.c().id='wrong';await expect(acceptPrivateVersion(x.store,'a',input())).rejects.toThrow('forbidden');x=fixture();x.f.id='wrong';await expect(acceptPrivateVersion(x.store,'a',input())).rejects.toThrow('forbidden');});
 it('refuses malformed/stale receipt instead of claiming stored success',async()=>{let x=fixture();await acceptPrivateVersion(x.store,'a',input());x.c().state='needs_changes';await expect(acceptPrivateVersion(x.store,'a',input())).rejects.toThrow('conflict');});
 it('propagates a concurrent CAS failure without a success receipt',async()=>{let x=fixture();x.tx.acceptAndBind=async()=>{throw Error('CAS conflict')};let save=vi.fn();x.tx.saveReceipt=save;await expect(acceptPrivateVersion(x.store,'a',input())).rejects.toThrow('CAS conflict');expect(save).not.toHaveBeenCalled();});
});
