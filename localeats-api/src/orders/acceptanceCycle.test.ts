import test from 'node:test';import assert from 'node:assert/strict';import {runAcceptanceCycle} from './acceptanceCycle.js';import type {RpcClient} from './pickupService.js';
test('trusted worker cycle is off by default and bounds the send batch',async()=>{
 let calls=0;const client={rpc:async()=>{calls++;return {data:0,error:null};}};
 delete process.env.PICKUP_ACCEPTANCE_WORKER_ENABLED;
 assert.deepEqual(await runAcceptanceCycle(client as unknown as RpcClient,async()=>{}),{enabled:false,processed:0});assert.equal(calls,0);
 Object.assign(process.env,{PICKUP_ACCEPTANCE_WORKER_ENABLED:'true',PICKUP_ACCEPTANCE_ENABLED:'true',PICKUP_WRITES_ENABLED:'true'});
 let drains=0;assert.deepEqual(await runAcceptanceCycle(client as unknown as RpcClient,async()=>{drains++;}),{enabled:true,processed:0});assert.equal(calls,1);assert.equal(drains,10);
 delete process.env.PICKUP_ACCEPTANCE_WORKER_ENABLED;delete process.env.PICKUP_ACCEPTANCE_ENABLED;delete process.env.PICKUP_WRITES_ENABLED;
});
