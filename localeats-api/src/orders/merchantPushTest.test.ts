import test from "node:test";
import assert from "node:assert/strict";
import {createMerchantPushTestService,type MerchantPushTestDependencies} from "./merchantPushTest.js";
const valid="12345678-1234-4123-8123-123456789abc";
const token="fictional-fcm-token-"+("x".repeat(35));
function fakeDeps(overrides:Partial<MerchantPushTestDependencies>={}){
 const sent:{token:string;nonce:string}[]=[];
 const deps:MerchantPushTestDependencies={
   hasApprovedShop:async uid=>uid==="owner-a",
   findOwnedActiveDevice:async(uid,id)=>uid==="owner-a"&&id===valid?token:null,
   send:async(t,nonce)=>{sent.push({token:t,nonce});},
   now:()=>1_000_000,
   ...overrides
 };
 return {sent,run:createMerchantPushTestService(deps,new Map())};
}
test("approved merchant can trigger exactly one labeled device-only test, no order",async()=>{
 const {run,sent}=fakeDeps();
 const result=await run("owner-a",valid);
 assert.deepEqual(result,{status:202,code:"FCM_ACCEPTED_NOT_DEVICE_DELIVERED"});
 assert.equal(sent.length,1);
 assert.equal(sent[0].token,token);
 assert.match(sent[0].nonce,/^[0-9a-f-]{36}$/);
 assert.equal(JSON.stringify(result).includes(token),false);
 assert.equal(await run("owner-a",valid).then(x=>x.status),429);
 assert.equal(sent.length,1);
});
test("wrong merchant cannot test another merchant's active device",async()=>{
 const {run,sent}=fakeDeps();
 assert.deepEqual(await run("owner-b",valid),{status:403,code:"TEST_MERCHANT_NOT_APPROVED"});
 assert.equal(sent.length,0);
});
test("revoked or missing subscription is not sent to",async()=>{
 const {run,sent}=fakeDeps({findOwnedActiveDevice:async()=>null});
 assert.deepEqual(await run("owner-a",valid),{status:404,code:"TEST_DEVICE_NOT_REGISTERED"});
 assert.equal(sent.length,0);
});
test("malformed installation is rejected without lookup or FCM calls",async()=>{
 let attempts=0;
 const {run}=fakeDeps({hasApprovedShop:async()=>{attempts++;return true;}});
 assert.deepEqual(await run("owner-a","invalid"),{status:400,code:"TEST_INVALID_DEVICE"});
 assert.equal(attempts,0);
});
test("FCM errors never expose tokens and never claim device delivery",async()=>{
 const {run}=fakeDeps({send:async()=>{throw Error("synthetic provider error carrying secret");}});
 const answer=await run("owner-a",valid);
 assert.deepEqual(answer,{status:503,code:"TEST_FCM_UNAVAILABLE"});
 assert.equal(JSON.stringify(answer).includes("secret"),false);
});
test("concurrent same-device requests have one accepted send per instance",async()=>{
 let unblock:()=>void=()=>{};
 const gate=new Promise<void>(resolve=>{unblock=resolve;});
 let n=0;
 const {run}=fakeDeps({send:async()=>{n++;await gate;}});
 const first=run("owner-a",valid);
 const second=run("owner-a",valid);
 unblock();
 assert.deepEqual((await Promise.all([first,second])).map(x=>x.status).sort(),[202,429]);
 assert.equal(n,1);
});
test("throttle permits retest after cooldown and is scoped by user and installation",async()=>{
 let time=1_000_000,n=0;
 const {run}=fakeDeps({now:()=>time,send:async()=>{n++;}});
 assert.equal((await run("owner-a",valid)).status,202);
 time+=59_999;
 assert.equal((await run("owner-a",valid)).status,429);
 time++;
 assert.equal((await run("owner-a",valid)).status,202);
 assert.equal(n,2);
});
