import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {createInertR32WorkerAdmission,
  type DurableWorkerNonceStore,type InternalWorkerEnvelope,
} from "./internalWorkerAdmissionR32.js";

const orderId="00000000-0000-4000-8000-000000000402";
const collectedCommandId="00000000-0000-4000-8000-000000000422";
const leaseToken="00000000-0000-4000-8000-000000000499";
const ms=1794100000000;
const nonce="r32_test_nonce_123456789abc";
const key=new Uint8Array(32).fill(17);
const audience="localeats-rewards-r32-internal-worker";
function sign(
  values:{orderId:string;collectedCommandId:string;leaseToken:string;
    ms:number;nonce:string},
  keyBytes:Uint8Array=key,
){
  const parts=[audience,String(values.ms),values.nonce,
    values.orderId.toLowerCase(),values.collectedCommandId.toLowerCase(),
    values.leaseToken.toLowerCase()];
  const hex=createHmac("sha256",keyBytes).update(parts.join("\n")).digest("hex");
  return "InternalHMAC "+values.ms+"."+values.nonce+"."+hex;
}
const base=()=>({orderId,collectedCommandId,leaseToken,ms,nonce});
function createStore(){
  const used=new Set<string>();
  const store:DurableWorkerNonceStore={
    consumeOnce:async nonce=>{
      if(used.has(nonce))return false;
      used.add(nonce);
      return true;
    }
  };
  return {store,used};
}
const envelope=(overrides:Partial<InternalWorkerEnvelope>={}):InternalWorkerEnvelope=>({
  orderId,collectedCommandId,leaseToken,
  authorization:sign(base()),...overrides
});

test("R3.2: signed internal worker may inspect intent, never credit or acknowledge",async()=>{
  const {store,used}=createStore();
  const admission=createInertR32WorkerAdmission({signingKey:key,nonces:store,nowMs:()=>ms});
  const result=await admission.inspect(envelope());
  assert.deepEqual(result,{
    mode:"worker-admitted-only",orderId,collectedCommandId,leaseToken,
    canCredit:false,canPayout:false,canAcknowledge:false,
  });
  assert.ok(Object.isFrozen(result));
  assert.equal(used.size,1);
  assert.equal(typeof (admission as unknown as {payMerchant?:unknown}).payMerchant,"undefined");
  assert.equal(typeof (admission as unknown as {creditOrder?:unknown}).creditOrder,"undefined");
  assert.equal(typeof (admission as unknown as {acknowledge?:unknown}).acknowledge,"undefined");
});
test("R3.2: same signed nonce is denied on replay across separate server instances",async()=>{
  const {store}=createStore();
  const a=createInertR32WorkerAdmission({signingKey:key,nonces:store,nowMs:()=>ms});
  const b=createInertR32WorkerAdmission({signingKey:key,nonces:store,nowMs:()=>ms});
  const [x,y]=await Promise.allSettled([a.inspect(envelope()),b.inspect(envelope())]);
  assert.deepEqual([x.status,y.status].sort(),["fulfilled","rejected"]);
  assert.equal((x.status==="rejected"?x.reason:y.status==="rejected"?y.reason:null)?.message,
    "R32_INTERNAL_WORKER_UNAUTHORIZED");
});
test("R3.2: worker cannot change order, collection event, lease token or timestamp",async()=>{
  for(const changes of [
    {orderId:"00000000-0000-4000-8000-000000000403"},
    {collectedCommandId:"00000000-0000-4000-8000-000000000423"},
    {leaseToken:"00000000-0000-4000-8000-000000000498"},
    {orderId:"not-a-uuid"},
    {authorization:"Bearer fb-legit-customer-token"},
    {authorization:"InternalHMAC bad"},
  ]){
    const {store,used}=createStore();
    const admission=createInertR32WorkerAdmission({signingKey:key,nonces:store,nowMs:()=>ms});
    await assert.rejects(()=>admission.inspect(envelope(changes)),
      /R32_INTERNAL_WORKER_UNAUTHORIZED/);
    assert.equal(used.size,0);
  }
});
test("R3.2: expired or suspiciously future signed command is denied",async()=>{
  for(const delta of [-30001,5001]){
    const {store,used}=createStore();
    const admission=createInertR32WorkerAdmission({signingKey:key,nonces:store,nowMs:()=>ms});
    const v={...base(),ms:ms+delta};
    await assert.rejects(()=>admission.inspect(envelope({authorization:sign(v)})),
      /R32_INTERNAL_WORKER_UNAUTHORIZED/);
    assert.equal(used.size,0);
  }
});
test("R3.2: wrong private signing key cannot admit command or consume nonce",async()=>{
  const {store,used}=createStore();
  const admission=createInertR32WorkerAdmission({signingKey:key,nonces:store,nowMs:()=>ms});
  await assert.rejects(()=>admission.inspect(envelope({
    authorization:sign(base(),new Uint8Array(32).fill(90))
  })),/R32_INTERNAL_WORKER_UNAUTHORIZED/);
  assert.equal(used.size,0);
});
test("R3.2: a nonce-store outage fails closed, not as accepted worker identity",async()=>{
  const store:DurableWorkerNonceStore={
    consumeOnce:async()=>{throw Error("DATABASE_UNAVAILABLE");}
  };
  const admission=createInertR32WorkerAdmission({signingKey:key,nonces:store,nowMs:()=>ms});
  await assert.rejects(()=>admission.inspect(envelope()),/R32_INTERNAL_WORKER_UNAUTHORIZED/);
});
test("R3.2: malformed configuration or short secret does not create an executor",()=>{
  const {store}=createStore();
  assert.throws(()=>createInertR32WorkerAdmission({
    signingKey:new Uint8Array(16),nonces:store,
  }),/R32_WORKER_ADMISSION_NOT_CONFIGURED/);
  assert.throws(()=>createInertR32WorkerAdmission({
    signingKey:key,nonces:null as unknown as DurableWorkerNonceStore,
  }),/R32_WORKER_ADMISSION_NOT_CONFIGURED/);
  assert.throws(()=>createInertR32WorkerAdmission({
    signingKey:key,nonces:store,nowMs:null as unknown as ()=>number,
  }),/R32_WORKER_ADMISSION_NOT_CONFIGURED/);
});
test("R3.2: original configuration is copied, cannot be changed by mutation later",async()=>{
  const {store}=createStore();
  const original=new Uint8Array(key);
  const admission=createInertR32WorkerAdmission({
    signingKey:original,nonces:store,nowMs:()=>ms
  });
  original.fill(0);
  const result=await admission.inspect(envelope());
  assert.equal(result.mode,"worker-admitted-only");
});
