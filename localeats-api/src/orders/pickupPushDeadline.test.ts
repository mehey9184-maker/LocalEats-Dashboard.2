import test from "node:test";
import assert from "node:assert/strict";
import { drainPickupPush, PICKUP_PUSH_REQUEST_BUDGET_MS, type PushJob } from "./pickupPush.js";
import type { RpcClient } from "./pickupService.js";

const job:PushJob={
  id:"550e8400-e29b-41d4-a716-446655440000",
  attempts:2,
  lease_until:"2026-11-07T00:00:30Z",
  event_id:"550e8400-e29b-41d4-a716-446655440001",
  order_id:"550e8400-e29b-41d4-a716-446655440002",
  token:"synthetic-token-no-live-device"
};
type Call={name:string;args:Record<string,unknown>};
function fakeRpc(work:(name:string,args:Record<string,unknown>)=>Promise<unknown>):RpcClient {
  return {rpc:async(name:string,args:Record<string,unknown>)=>({data:await work(name,args),error:null})} as unknown as RpcClient;
}
function bounded(elapsed:number) {
  // Avoid brittle millisecond assertions on loaded CI runners: a hanging
  // provider would never finish at all, while the bounded attempt settles.
  assert.ok(elapsed<1_500,`push attempt ran too long (${elapsed}ms)`);
}

test("pickup push attempt has a hard upper request budget",()=>{
  assert.equal(PICKUP_PUSH_REQUEST_BUDGET_MS,4_000);
});

test("stalled FCM response leaves fenced lease unknown; no fake sent receipt",async()=>{
  const calls:Call[]=[]; let deliverLate:()=>void=()=>{};
  const sender=async()=>new Promise<void>(resolve=>{deliverLate=resolve;});
  const rpc=fakeRpc(async(name,args)=>{
    calls.push({name,args});
    return name==="pickup_claim_push" ? job : true;
  });
  const start=Date.now();
  await drainPickupPush(rpc,"merchant",sender,55);
  bounded(Date.now()-start);
  assert.deepEqual(calls.map(x=>x.name),["pickup_claim_push","pickup_push_sendable"]);
  // FCM may deliver after timeout; do not claim the outcome either way.
  deliverLate();
  await Promise.resolve();
  assert.equal(calls.some(x=>x.name==="pickup_finish_push"),false);
});

test("stalled claim cannot block HTTP and does not invent a push attempt",async()=>{
  const calls:Call[]=[];let senderCalls=0;
  const rpc=fakeRpc(async(name,args)=>{
    calls.push({name,args});
    return new Promise<never>(()=>{});
  });
  const start=Date.now();
  await drainPickupPush(rpc,"customer",async()=>{senderCalls++;},55);
  bounded(Date.now()-start);
  assert.deepEqual(calls.map(x=>x.name),["pickup_claim_push"]);
  assert.equal(senderCalls,0);
});

test("stalled lease/token recheck does not send or finish a stale job",async()=>{
  const calls:Call[]=[];let senderCalls=0;
  const rpc=fakeRpc(async(name,args)=>{
    calls.push({name,args});
    return name==="pickup_claim_push"?job:new Promise<never>(()=>{});
  });
  const start=Date.now();
  await drainPickupPush(rpc,"customer",async()=>{senderCalls++;},55);
  bounded(Date.now()-start);
  assert.deepEqual(calls.map(x=>x.name),["pickup_claim_push","pickup_push_sendable"]);
  assert.equal(senderCalls,0);
});

test("stalled receipt completion does not block a confirmed FCM send",async()=>{
  const calls:Call[]=[];let senderCalls=0;
  const rpc=fakeRpc(async(name,args)=>{
    calls.push({name,args});
    if(name==="pickup_finish_push")return new Promise<never>(()=>{});
    return name==="pickup_claim_push"?job:true;
  });
  const start=Date.now();
  await drainPickupPush(rpc,"customer",async()=>{senderCalls++;},75);
  bounded(Date.now()-start);
  assert.equal(senderCalls,1);
  assert.equal(calls.at(-1)?.name,"pickup_finish_push");
  assert.equal(calls.at(-1)?.args.p_sent,true);
  // Receipt completion is unknown; the database lease may expire.
});

test("rapid success confirms a fenced sent receipt",async()=>{
  const calls:Call[]=[];let sends=0;
  const rpc=fakeRpc(async(name,args)=>{
    calls.push({name,args});
    return name==="pickup_claim_push"?job:true;
  });
  await drainPickupPush(rpc,"merchant",async()=>{sends++;},100);
  assert.equal(sends,1);
  assert.deepEqual(calls.map(x=>x.name),["pickup_claim_push","pickup_push_sendable","pickup_finish_push"]);
  assert.deepEqual(calls.at(-1)?.args,{
    p_uid:"merchant",p_job:job.id,p_attempt:job.attempts,p_lease:job.lease_until,
    p_sent:true,p_permanent:false
  });
});

test("rejected FCM sends remain retryable; revoked tokens are permanent",async()=>{
  for(const [code,permanent] of [
    ["messaging/unavailable",false],
    ["messaging/registration-token-not-registered",true],
  ] as const) {
    const calls:Call[]=[];
    const rpc=fakeRpc(async(name,args)=>{
      calls.push({name,args});
      return name==="pickup_claim_push"?job:true;
    });
    await drainPickupPush(rpc,"customer",async()=>{throw Object.assign(new Error("synthetic"),{code});},100);
    assert.equal(calls.at(-1)?.name,"pickup_finish_push");
    assert.equal(calls.at(-1)?.args.p_sent,false);
    assert.equal(calls.at(-1)?.args.p_permanent,permanent);
  }
});

test("unsendable subscription cannot send and must be marked permanent",async()=>{
  const calls:Call[]=[];let sends=0;
  const rpc=fakeRpc(async(name,args)=>{
    calls.push({name,args});
    return name==="pickup_claim_push"?job:name==="pickup_push_sendable"?false:true;
  });
  await drainPickupPush(rpc,"customer",async()=>{sends++;},100);
  assert.equal(sends,0);
  assert.equal(calls.at(-1)?.name,"pickup_finish_push");
  assert.equal(calls.at(-1)?.args.p_sent,false);
  assert.equal(calls.at(-1)?.args.p_permanent,true);
});

test("no app/no UID and malformed claimed payload send nothing",async()=>{
  let called=0;
  const rpc=fakeRpc(async()=>{
    called++;return {...job,token:""};
  });
  await drainPickupPush(rpc,"",async()=>{called++;},100);
  assert.equal(called,0);
  await drainPickupPush(rpc,"customer",async()=>{called++;},100);
  assert.equal(called,1);
});
