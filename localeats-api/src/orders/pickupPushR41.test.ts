import test from "node:test";
import assert from "node:assert/strict";
import {drainPickupPush, type PushJob} from "./pickupPush.js";
import type {RpcClient} from "./pickupService.js";

// Synthetic only: no Firebase initialization, real tokens, Supabase client or network.
const job:PushJob = {
  id:"550e8400-e29b-41d4-a716-446655440001",
  event_id:"550e8400-e29b-41d4-a716-446655440002",
  order_id:"550e8400-e29b-41d4-a716-446655440003",
  attempts:2, lease_until:"2026-11-08T01:00:00Z",
  token:"R41_SYNTHETIC_DO_NOT_SEND"
};
type Reply={data:unknown;error:null|{message:string}};
const client=(fn:(name:string,args:Record<string,unknown>)=>Promise<Reply>):RpcClient=>
  ({rpc:fn} as unknown as RpcClient);

test("R4.1: empty UID never claims an outbox job",async()=>{
  let calls=0;
  await drainPickupPush(client(async()=>{calls++;return {data:null,error:null};}),"",async()=>{throw Error("should not send");});
  assert.equal(calls,0);
});

test("R4.1: send and fenced acknowledgement are awaited in strict order",async()=>{
  const steps:string[]=[];
  let finish:Record<string,unknown>|undefined;
  const db=client(async(name,args)=>{
    steps.push(name);
    if(name==="pickup_claim_push")return {data:job,error:null};
    if(name==="pickup_push_sendable")return {data:true,error:null};
    if(name==="pickup_finish_push"){finish=args;return {data:true,error:null};}
    throw Error("unexpected RPC");
  });
  await drainPickupPush(db,"fake-customer",async received=>{
    assert.equal(received,job);
    steps.push("FAKE_FCM_SEND");
  });
  assert.deepEqual(steps,["pickup_claim_push","pickup_push_sendable","FAKE_FCM_SEND","pickup_finish_push"]);
  assert.equal(finish?.p_uid,"fake-customer");
  assert.equal(finish?.p_attempt,job.attempts);
  assert.equal(finish?.p_lease,job.lease_until);
  assert.equal(finish?.p_sent,true);
  assert.equal(finish?.p_permanent,false);
});

test("R4.1: revoked or rotated token fails sendability and sends nothing",async()=>{
  const steps:string[]=[];
  let finish:Record<string,unknown>|undefined;
  const db=client(async(name,args)=>{
    steps.push(name);
    if(name==="pickup_claim_push")return {data:job,error:null};
    if(name==="pickup_push_sendable"){
      assert.equal(args.p_token,job.token);
      return {data:false,error:null};
    }
    if(name==="pickup_finish_push"){finish=args;return {data:true,error:null};}
    throw Error("unexpected RPC");
  });
  await drainPickupPush(db,"fake-customer",async()=>{throw Error("MUST_NOT_SEND");});
  assert.deepEqual(steps,["pickup_claim_push","pickup_push_sendable","pickup_finish_push"]);
  assert.equal(finish?.p_sent,false);
  assert.equal(finish?.p_permanent,true);
  assert.equal(finish?.p_attempt,job.attempts);
});

test("R4.1: transient FCM failure is one best-effort attempt, not a false success",async()=>{
  const steps:string[]=[];
  let finish:Record<string,unknown>|undefined;
  const db=client(async(name,args)=>{
    steps.push(name);
    if(name==="pickup_claim_push")return {data:job,error:null};
    if(name==="pickup_push_sendable")return {data:true,error:null};
    if(name==="pickup_finish_push"){finish=args;return {data:true,error:null};}
    throw Error("unexpected RPC");
  });
  await drainPickupPush(db,"fake-customer",async()=>{
    steps.push("FAKE_FCM_TRANSIENT_FAIL");
    throw Object.assign(new Error("synthetic provider failure"),{code:"messaging/internal-error"});
  });
  assert.deepEqual(steps,["pickup_claim_push","pickup_push_sendable","FAKE_FCM_TRANSIENT_FAIL","pickup_finish_push"]);
  assert.equal(finish?.p_sent,false);
  assert.equal(finish?.p_permanent,false);
});

test("R4.1: unregistered or invalid FCM token is marked permanently undeliverable",async()=>{
  for(const code of ["messaging/registration-token-not-registered","messaging/invalid-registration-token"]){
    const finishes:Record<string,unknown>[]=[];
    const db=client(async(name,args)=>{
      if(name==="pickup_claim_push")return {data:job,error:null};
      if(name==="pickup_push_sendable")return {data:true,error:null};
      if(name==="pickup_finish_push"){finishes.push(args);return {data:true,error:null};}
      throw Error("unexpected RPC");
    });
    await drainPickupPush(db,"fake-customer",async()=>{throw {code};});
    assert.equal(finishes.length,1);
    assert.equal(finishes[0]?.p_sent,false);
    assert.equal(finishes[0]?.p_permanent,true);
  }
});

test("R4.1: malformed job and failed database recheck never reach FCM",async()=>{
  for(const claimed of [{...job,token:""},{...job,attempts:1.5}]){
    let sends=0;
    const db=client(async name=>({data:name==="pickup_claim_push"?claimed:true,error:null}));
    await drainPickupPush(db,"fake-customer",async()=>{sends++;});
    assert.equal(sends,0);
  }
  let sends=0;
  const denied=client(async name=>name==="pickup_claim_push"
    ? {data:job,error:null}
    : {data:null,error:{message:"temporary database error"}});
  await drainPickupPush(denied,"fake-customer",async()=>{sends++;});
  assert.equal(sends,0);
});
