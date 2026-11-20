import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {once} from "node:events";
import express from "express";
import type {Firestore} from "firebase-admin/firestore";
import type {App} from "firebase-admin/app";
import {
  createFirestoreMerchantAccountStore, reconcileMerchantProfileDisplay,
} from "./merchantFirestoreAccountStore.js";
import {
  createApprovedMerchantOwnershipLookup,createSupabaseMerchantOwnershipLookup,
} from "./merchantApprovedOwner.js";
import {openMerchantAccountFirestoreForReview} from "./merchantAdminFirestore.js";
import {makeReviewOnlyMerchantAccountRouter} from "../routes/merchantAccountContract.js";

type Row=Record<string,unknown>;
type FakeDbOptions={noWrites?:boolean;failRead?:boolean;failWrite?:boolean;deleteBeforeWrite?:boolean};
function fakeFirestore(source:Record<string,Row>={},opts:FakeDbOptions={}) {
  const rows=new Map(Object.entries(source).map(([key,value])=>[key,{...value}]));
  const writes:Array<{path:string;data:Row}>=[];
  const reads:string[]=[];
  const db={
    doc(path:string){
      if(!path.startsWith("users/"))throw Error("unexpected collection");
      const id=path.slice("users/".length);
      return {
        async get(){
          reads.push(path);
          if(opts.failRead)throw Error("synthetic read outage");
          const record=rows.get(id);
          return {id,exists:record!==undefined,data:()=>record?{...record}:undefined};
        },
        async update(patch:Row){
          if(opts.deleteBeforeWrite)rows.delete(id);
          if(opts.failWrite)throw Error("synthetic write outage");
          if(!rows.has(id))throw Error("document not found");
          writes.push({path,data:{...patch}});
          if(!opts.noWrites)rows.set(id,{...rows.get(id),...patch});
        },
      };
    },
  } as unknown as Pick<Firestore,"doc">;
  return {db,rows,writes,reads};
}
const original=(uid:string):Row=>({
  uid,full_name:"Legacy Person",phone:"0712345678",
  role:"merchant",owner_id:"shop-role-must-not-change",email:"untrusted@example.test",
  created_at:"2026-01-01T00:00:00Z",marketing_preferences:false,dark_mode:false,
});
test("N8C real Firestore store creates no records and is scoped to users/UID",async()=>{
  const f=fakeFirestore({"owner-A":original("owner-A")});
  const store=createFirestoreMerchantAccountStore(f.db,()=> "2026-11-20T06:00:00.000Z");
  assert.equal((await store.read("owner-A"))?.uid,"owner-A");
  assert.equal(await store.read("missing"),null);
  await assert.rejects(store.write("missing",{full_name:"New Name"}),/MISSING/);
  assert.equal(f.writes.length,0);
  assert.deepEqual(f.reads,["users/owner-A","users/missing","users/missing"]);
});
test("owner A updates only permitted profile fields; owner B and authority fields untouched",async()=>{
  const f=fakeFirestore({"owner-A":original("owner-A"),"owner-B":original("owner-B")});
  const store=createFirestoreMerchantAccountStore(f.db,()=> "2026-11-20T06:00:00.000Z");
  await store.write("owner-A",{full_name:"New Alpha",phone:"",marketing_preferences:true,dark_mode:true});
  assert.deepEqual(f.writes,[{path:"users/owner-A",data:{
    full_name:"New Alpha",phone:"",marketing_preferences:true,dark_mode:true,
    updated_at:"2026-11-20T06:00:00.000Z",
  }}]);
  assert.equal((await store.read("owner-A"))?.full_name,"New Alpha");
  assert.equal((await store.read("owner-B"))?.full_name,"Legacy Person");
  assert.equal(f.rows.get("owner-A")?.role,"merchant");
  assert.equal(f.rows.get("owner-A")?.owner_id,"shop-role-must-not-change");
  assert.equal(f.rows.get("owner-A")?.email,"untrusted@example.test");
  assert.equal(f.rows.get("owner-B")?.updated_at,undefined);
});
test("forbidden fields, malformed UID and untrusted types cannot reach write",async()=>{
  const f=fakeFirestore({"owner-A":original("owner-A")});
  const store=createFirestoreMerchantAccountStore(f.db);
  for(const uid of ["","../owner-B","owner/B","owner\\B","bad\u0001uid"]){
    await assert.rejects(store.read(uid));
  }
  for(const patch of [{role:"admin"},{email:"attacker@test.invalid"},{uid:"owner-B"},
      {avatar_url:"https://example.invalid/image.png"},{full_name:"x"},
      {phone:"000"},{dark_mode:"yes"},{}]){
    await assert.rejects(store.write("owner-A",patch as never));
  }
  assert.equal(f.writes.length,0);
});
test("storage never trusts a mismatched embedded user UID",async()=>{
  const f=fakeFirestore({"owner-A":{...original("owner-A"),uid:"owner-B"}});
  const store=createFirestoreMerchantAccountStore(f.db);
  await assert.rejects(store.read("owner-A"),/OWNER_MISMATCH/);
  await assert.rejects(store.write("owner-A",{full_name:"Legit New"}),/OWNER_MISMATCH/);
  assert.equal(f.writes.length,0);
});
test("write fails for stale deleted records or unavailable storage",async()=>{
  for(const opts of [{deleteBeforeWrite:true},{failRead:true},{failWrite:true}]){
    const f=fakeFirestore({"owner-A":original("owner-A")},opts);
    const store=createFirestoreMerchantAccountStore(f.db);
    await assert.rejects(store.write("owner-A",{full_name:"Valid New"}));
    if(opts.failRead)assert.equal(f.writes.length,0);
  }
});
test("read-back is required: silent no-op Firestore update never yields HTTP success",async()=>{
  const f=fakeFirestore({"owner-A":original("owner-A")},{noWrites:true});
  const store=createFirestoreMerchantAccountStore(f.db);
  const app=express();app.use(express.json());
  app.use("/me",makeReviewOnlyMerchantAccountRouter({
    verifyToken:async(_token,revocation)=>{assert.equal(revocation,true);
      return {uid:"owner-A",firebase:{sign_in_provider:"password"}};},
    isApprovedMerchantOwner:async uid=>uid==="owner-A",store,writesEnabled:()=>true,
  }));
  const server=app.listen(0,"127.0.0.1");
  try{
    await once(server,"listening");
    const addr=server.address();
    if(!addr||typeof addr==="string")throw Error("listener unavailable");
    const response=await fetch("http://127.0.0.1:"+addr.port+"/me/me",{
      method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer fb-synthetic"},
      body:JSON.stringify({full_name:"New Alpha"}),
    });
    assert.equal(response.status,503);
    const body=await response.json() as {code:string;success:boolean};
    assert.equal(body.code,"MERCHANT_ACCOUNT_SAVE_UNCONFIRMED");
    assert.equal(f.rows.get("owner-A")?.full_name,"Legacy Person");
  }finally{server.close();}
});
test("profile owner lookup accepts several approved owned shops without selecting any shop",async()=>{
  const samples:Array<{rows:unknown;approved:boolean}>= [
    {rows:[{id:"shop1",owner_id:"owner-A",approval_status:"approved",archived_at:null}],approved:true},
    {rows:[],approved:false},
    {rows:[{id:"shop1",owner_id:"owner-B",approval_status:"approved",archived_at:null}],approved:false},
    {rows:[{id:"shop1",owner_id:"owner-A",approval_status:"pending",archived_at:null}],approved:false},
    {rows:[{id:"shop1",owner_id:"owner-A",approval_status:"approved",archived_at:"yesterday"}],approved:false},
    {rows:[{id:"shop1",owner_id:"owner-A",approval_status:"approved",archived_at:null},
           {id:"shop2",owner_id:"owner-A",approval_status:"approved",archived_at:null}],approved:true},
    {rows:[{id:"shop1",owner_id:"owner-A",approval_status:"approved",archived_at:null},
           {id:"shop2",owner_id:"owner-B",approval_status:"approved",archived_at:null}],approved:false},
    {rows:[{id:"shop1",owner_id:"owner-A",approval_status:"approved",archived_at:null},
           {id:"shop2",owner_id:"owner-A",approval_status:"pending",archived_at:null}],approved:false},
    {rows:[{owner_id:"owner-A",approval_status:"approved",archived_at:null}],approved:false},
    {rows:null,approved:false},
  ];
  for(const entry of samples) {
    const lookup=createApprovedMerchantOwnershipLookup(async()=>entry.rows);
    if(entry.rows===null)await assert.rejects(lookup("owner-A"));
    else assert.equal(await lookup("owner-A"),entry.approved,JSON.stringify(entry.rows));
  }
  await assert.rejects(createApprovedMerchantOwnershipLookup(async()=>[] )("../other"));
  await assert.rejects(createApprovedMerchantOwnershipLookup(async()=>{throw Error("db down");})("owner-A"));
});
test("service-role lookup applies owner+archive filters and rejects failed database reads",async()=>{
  const calls:string[]=[];
  const fake={
    from(name:string){
      calls.push("from:"+name);
      return {select(cols:string){
        calls.push("select:"+cols);
        const chain={
          eq(k:string,v:string){calls.push("eq:"+k+"="+v);return chain;},
          is(k:string,v:null){calls.push("is:"+k+"="+v);return chain;},
          limit(n:number){calls.push("limit:"+n);return Promise.resolve({
            data:[{id:7,owner_id:"owner-A",approval_status:"approved",archived_at:null}],
            error:null,
          });},
        };
        return chain;
      }};
    },
  };
  const lookup=createSupabaseMerchantOwnershipLookup(fake as never);
  assert.equal(await lookup("owner-A"),true);
  assert.deepEqual(calls,[
    "from:shops_with_availability",
    "select:id,owner_id,approval_status,archived_at",
    "eq:owner_id=owner-A","eq:approval_status=approved","is:archived_at=null","limit:1",
  ]);
});
test("Firebase Auth email is authoritative; Firestore wins editable name & phone",()=>{
  const auth={uid:"owner-A",email:"new-email@firebase.test",displayName:"Old Firebase Name",
    phoneNumber:"+27711234567"};
  const doc={uid:"owner-A",full_name:"Saved Merchant Name",phone:"",
    email:"forged@firestore.test",role:"admin",
    marketing_preferences:true,dark_mode:true};
  assert.deepEqual(reconcileMerchantProfileDisplay(auth,doc),{
    uid:"owner-A",email:"new-email@firebase.test",full_name:"Saved Merchant Name",
    phone:"",marketing_preferences:true,dark_mode:true,
  });
  assert.equal(reconcileMerchantProfileDisplay(auth,null).full_name,"Old Firebase Name");
  assert.equal(reconcileMerchantProfileDisplay({...auth,displayName:null},null).full_name,"new-email");
  assert.throws(()=>reconcileMerchantProfileDisplay(auth,{...doc,uid:"owner-B"}));
});
test("review-only Admin DB factory rejects missing or mismatched named database IDs",()=>{
  const dummyApp={options:{}} as unknown as App;
  for(const [server,client] of [[undefined,undefined],["db-A","db-B"],["","db-A"],
      ["db-A",undefined],["db-A ","db-A"]]){
    assert.throws(()=>openMerchantAccountFirestoreForReview(dummyApp,server,client));
  }
});
test("future composition remains absent from active API and frontend",()=>{
  const active=readFileSync(new URL("../../src/server.ts",import.meta.url),"utf8");
  for(const marker of ["merchantFirestoreAccountStore","merchantApprovedOwner",
    "merchantAdminFirestore","merchantAccountContract"]){
    assert.ok(!active.includes(marker),"review-only adapter unexpectedly mounted: "+marker);
  }
});
