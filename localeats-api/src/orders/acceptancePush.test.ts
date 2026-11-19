import test from 'node:test';
import assert from 'node:assert/strict';
import {drainAcceptancePush} from './acceptancePush.js';
test('deadline push defaults off without claiming or sending',async()=>{
 let called=0;delete process.env.PICKUP_ACCEPTANCE_PUSH_ENABLED;
 await drainAcceptancePush({rpc:async()=>{called++;return {} as any;}} as any,async()=>{called++;});
 assert.equal(called,0);
});
test('bounded claim checks sendability and fences completion; provider outage never fabricates sent',async()=>{
 Object.assign(process.env,{PICKUP_ACCEPTANCE_ENABLED:'true',PICKUP_ACCEPTANCE_PUSH_ENABLED:'true',PICKUP_WRITES_ENABLED:'true'});
 const calls:any[]=[];
 const client={rpc:async(name:string,args:any)=>{
  calls.push({name,args});return {data:name==='pickup_claim_acceptance_push'?{id:'job',attempts:1,lease_until:'lease',token:'synthetic-token',order_id:'order'}:true,error:null};
 }};
 await drainAcceptancePush(client as any,async()=>{throw Error('provider unavailable');});
 assert.equal(calls.length,3);
 assert.equal(calls[2].args.p_sent,false);
 assert.equal(calls[2].args.p_attempt,1);
 delete process.env.PICKUP_ACCEPTANCE_PUSH_ENABLED;delete process.env.PICKUP_WRITES_ENABLED;delete process.env.PICKUP_ACCEPTANCE_ENABLED;
});
