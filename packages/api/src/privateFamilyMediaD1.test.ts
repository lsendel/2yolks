import {describe,it,expect,vi} from 'vitest';
import {DraftD1MediaCatalog} from './privateFamilyMediaD1';
import type {DraftD1} from './privateFamilyD1';
function fixture(){
 const calls:{sql:string;args:unknown[]}[]=[];let changes=1;let row:unknown=null;
 const db:DraftD1={prepare(sql){const call={sql,args:[] as unknown[]};calls.push(call);const stmt={bind(...args:unknown[]){call.args=args;return stmt;},first:async<T>()=>row as T|null,run:vi.fn(async()=>({success:true,meta:{changes}}))};return stmt;}};
 return {catalog:new DraftD1MediaCatalog(db,'family-1',()=> 'server-id-1'),calls,changes(n:number){changes=n;},row(r:unknown){row=r;}};
}
describe('unmounted D1 upload catalog statement contract, not SQL execution',()=>{
 it('reserves with one conditional statement including quota, membership and purpose guard',async()=>{const x=fixture();const r=await x.catalog.reserve('owner','candidate','recipe_source',20);expect(r.objectKey).toBe('private-family/server-id-1');expect(x.calls).toHaveLength(1);const q=x.calls[0]!;expect(q.sql).toContain('COALESCE(SUM(bytes),0)');expect(q.sql).toContain('NOT EXISTS');expect(q.sql).toContain("$.active");expect(q.sql).toContain("'draft','needs_changes'");expect(q.args.at(-1)).toBe(25*1024*1024);});
 it('refuses zero changes rather than inventing a reservation',async()=>{const x=fixture();x.changes(0);await expect(x.catalog.reserve('owner','candidate','dish_cover',1)).rejects.toThrow('conflict');});
 it('invalid size/purpose makes no query',async()=>{const x=fixture();for(const size of [0,-1,3*1024*1024+1,NaN])await expect(x.catalog.reserve('owner','candidate','dish_cover',size)).rejects.toThrow('invalid');expect(x.calls).toHaveLength(0);});
 it('verification includes current draft/member and exact reserved byte size',async()=>{const x=fixture();expect(await x.catalog.verify('a','id','a'.repeat(64),12)).toBe(true);const q=x.calls[0]!;expect(q.sql).toContain("state='reserved'");expect(q.sql).toContain('bytes=?');expect(q.sql).toContain("$.active");expect(q.args).toEqual(['a'.repeat(64),'id','a','family-1',12,'a']);});
 it('verification lost to revocation returns false',async()=>{const x=fixture();x.changes(0);expect(await x.catalog.verify('a','id','a'.repeat(64),12)).toBe(false);});
 it('unauthorized reads return no record',async()=>{const x=fixture();expect(await x.catalog.authorize('other','id')).toBe(null);expect(x.calls[0]!.sql).toContain('s.owner_id=?');});
 it('deletion remains owner-bound without requiring continued membership',async()=>{const x=fixture();expect(await x.catalog.beginDelete('a','id')).toBe(null);expect(x.calls[0]!.sql).toContain('owner_id=?');expect(x.calls[0]!.sql).not.toContain('json_each');});
 it('failed tombstone prevents finalization claim',async()=>{const x=fixture();x.changes(0);await expect(x.catalog.finishDelete('id')).rejects.toThrow('conflict');});
});
