import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptanceEnabled,readAcceptanceInbox,resumeReception} from './acceptance.js';
test('disabled acceptance makes no database calls',async()=>{
 delete process.env.PICKUP_ACCEPTANCE_ENABLED;
 const client={rpc:async()=>{throw Error('MUST_NOT_CALL');}};
 assert.equal(acceptanceEnabled(),false);
 assert.deepEqual(await readAcceptanceInbox(client as any,'customer'),{enabled:false,notices:[]});
 await assert.rejects(()=>resumeReception(client as any,'merchant',{shop_id:'shop',expected_revision:0}),/ACCEPTANCE_DISABLED/);
});
test('enabled inbox derives UID from authenticated caller and fails closed',async()=>{
 process.env.PICKUP_ACCEPTANCE_ENABLED='true';
 const calls:any[]=[];
 const client={rpc:async(name:string,args:any)=>{calls.push({name,args});return {data:[],error:null};}};
 assert.deepEqual(await readAcceptanceInbox(client as any,'customer'),{enabled:true,notices:[]});
 assert.deepEqual(calls,[{name:'pickup_acceptance_inbox',args:{p_uid:'customer'}}]);
 await assert.rejects(()=>readAcceptanceInbox(client as any,''),/UNAUTHORIZED/);
});
test('resume needs separate write gate and strict revision/fields',async()=>{
 process.env.PICKUP_ACCEPTANCE_ENABLED='true';delete process.env.PICKUP_WRITES_ENABLED;
 const client={rpc:async()=>({data:{shop_id:'shop',paused:false,revision:2},error:null})};
 await assert.rejects(()=>resumeReception(client as any,'merchant',{shop_id:'shop',expected_revision:1}),(e:any)=>e.code==='PICKUP_WRITES_DISABLED');
 process.env.PICKUP_WRITES_ENABLED='true';
 await assert.rejects(()=>resumeReception(client as any,'merchant',{shop_id:'shop',expected_revision:1,owner_id:'merchant'}),/INVALID_REQUEST/);
 assert.deepEqual(await resumeReception(client as any,'merchant',{shop_id:'shop',expected_revision:1}),{shop_id:'shop',paused:false,revision:2});
 delete process.env.PICKUP_WRITES_ENABLED;delete process.env.PICKUP_ACCEPTANCE_ENABLED;
});
