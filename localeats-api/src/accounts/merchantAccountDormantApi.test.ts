import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {readFileSync} from "node:fs";
import express from "express";
import type {App} from "firebase-admin/app";
import type {Firestore} from "firebase-admin/firestore";
import type {SupabaseClient} from "@supabase/supabase-js";
import {
  prepareDormantMerchantAccountApi, verifyMerchantAccountTarget,
  type MerchantAccountTarget,
} from "./merchantAccountDormantApi.js";

const target:MerchantAccountTarget={
  apiProjectId:"synthetic-firebase-project",
  merchantProjectId:"synthetic-firebase-project",
  apiDatabaseId:"synthetic-named-firestore-db",
  merchantDatabaseId:"synthetic-named-firestore-db",
};
const app= {options:{projectId:"synthetic-firebase-project"}} as unknown as App;

function fixture(approved=true) {
  const rows=new Map([
    ["owner-A", {uid:"owner-A",full_name:"Owner Alpha",phone:"0712345678",role:"merchant"}],
    ["owner-B", {uid:"owner-B",full_name:"Owner Beta",phone:"0723456789",role:"merchant"}],
  ]);
  const writes:{uid:string;patch:Record<string,unknown>}[]=[];
  let reads=0,queries=0;
  const firestore={
    doc(path:string) {
      if(!path.startsWith("users/"))throw Error("Not account collection");
      const uid=path.slice("users/".length);
      return {
        async get(){reads++;const data=rows.get(uid);
          return {id:uid,exists:!!data,data:()=>data};},
        async update(patch:Record<string,unknown>){
          writes.push({uid,patch});throw Error("unexpected write");
        },
      };
    },
  } as unknown as Pick<Firestore,"doc">;
  const ownerDb={
    from(table:string){
      assert.equal(table,"shops_with_availability");
      return {select(columns:string){
        assert.equal(columns,"id,owner_id,approval_status,archived_at");
        let verifiedOwnerUid="";
        const filter={
          eq(field:string,value:string){
            if(field==="owner_id"){verifiedOwnerUid=value;queries++;}
            else {assert.equal(field,"approval_status");assert.equal(value,"approved");}
            return this;
          },
          is(field:string,value:null){
            assert.equal(field,"archived_at");assert.equal(value,null);
            return this;
          },
          limit(n:number){
            assert.equal(n,1);
            const data=approved?[{id:"shop",owner_id:verifiedOwnerUid,
              approval_status:"approved",archived_at:null}]:[];
            return Promise.resolve({data,error:null});
          },
        };
        return filter;
      }};
    },
  } as unknown as Pick<SupabaseClient,"from">;
  const api=prepareDormantMerchantAccountApi({
    app,target,ownershipDb:ownerDb,
    reviewFirestoreFactory:(_app,apiDb,clientDb)=>{
      assert.equal(apiDb,target.apiDatabaseId);
      assert.equal(clientDb,target.merchantDatabaseId);
      return firestore;
    },
    reviewVerifier:async(token,checkRevoked)=>{
      assert.equal(checkRevoked,true);
      if(token==="revoked"||token==="disabled")throw Error("Firebase denied session");
      if(token==="anonymous")return {uid:"guest",firebase:{sign_in_provider:"anonymous"}};
      if(token==="owner-A"||token==="owner-B")
        return {uid:token,firebase:{sign_in_provider:"password"}};
      throw Error("Invalid Firebase ID token");
    },
  });
  return {api,writes,stats:()=>({reads,queries})};
}

async function serve(f:ReturnType<typeof fixture>,run:(base:string)=>Promise<void>) {
  const serverApp=express();
  serverApp.use(express.json({limit:"2kb"}));
  serverApp.use("/merchant/account",f.api);
  const server=serverApp.listen(0,"127.0.0.1");
  try{
    await once(server,"listening");
    const addr=server.address();
    if(!addr||typeof addr==="string")throw Error("Missing test port");
    await run("http://127.0.0.1:"+addr.port+"/merchant/account/me");
  }finally{
    server.closeAllConnections();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
}

async function request(url:string,token:string,method="GET",body?:unknown){
  const response=await fetch(url,{method,headers:{
    authorization:"Bearer fb-"+token,
    "Content-Type":"application/json",
  },...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,payload:await response.json() as
    {success?:boolean;code?:string;profile?:Record<string,unknown>},
    cache:response.headers.get("cache-control")};
}

test("N8D target guard refuses missing/mismatched Firebase project and database",()=>{
  assert.deepEqual(verifyMerchantAccountTarget(app,target),{
    projectId:target.apiProjectId,databaseId:target.apiDatabaseId,
  });
  for(const broken of [
    {...target,apiProjectId:"wrong-project"},
    {...target,merchantProjectId:"wrong-project"},
    {...target,merchantDatabaseId:"(default)"},
    {...target,apiDatabaseId:undefined},
    {...target,merchantProjectId:undefined},
    {...target,apiDatabaseId:" synthetic-named-firestore-db"},
  ]){
    assert.throws(()=>verifyMerchantAccountTarget(app,broken));
  }
  assert.throws(()=>verifyMerchantAccountTarget({options:{}} as App,target));
});

test("N8D mismatched configurations fail before creating any Firestore connection",()=>{
  let called=0;
  assert.throws(()=>prepareDormantMerchantAccountApi({
    app,target:{...target,merchantDatabaseId:"wrong-db"},
    ownershipDb:{from(){throw Error("must not query");}} as unknown as Pick<SupabaseClient,"from">,
    reviewFirestoreFactory:()=>{called++;throw Error("must not connect");},
  }));
  assert.equal(called,0);
});

test("N8D legitimate Merchant GET is scoped and contains no privileged claims",async()=>{
  const f=fixture();
  await serve(f,async url=>{
    const a=await request(url,"owner-A");
    const b=await request(url,"owner-B");
    assert.equal(a.status,200);assert.equal(b.status,200);
    assert.equal(a.payload.profile?.uid,"owner-A");
    assert.equal(b.payload.profile?.uid,"owner-B");
    assert.equal(a.payload.profile?.full_name,"Owner Alpha");
    assert.equal(b.payload.profile?.full_name,"Owner Beta");
    assert.equal(a.payload.profile?.role,undefined);
    assert.equal(b.payload.profile?.role,undefined);
    assert.equal(a.cache,"no-store");
    assert.ok(!JSON.stringify(b.payload).includes("Owner Alpha"));
  });
  assert.equal(f.writes.length,0);
  assert.equal(f.stats().reads,2);
  assert.equal(f.stats().queries,2);
});

test("N8D unauthorized/revoked/disabled and nonapproved owners never reach Firestore",async()=>{
  const f=fixture(false);
  await serve(f,async url=>{
    for(const token of ["revoked","disabled","anonymous","outsider","owner-A"]){
      const r=await request(url,token);
      assert.ok(r.status===401||r.status===403);
    }
  });
  assert.equal(f.stats().reads,0);
  assert.equal(f.writes.length,0);
});

test("N8D POST always refuses writes even with activation environment set",async()=>{
  const prev=process.env.MERCHANT_ACCOUNT_WRITES_ENABLED;
  process.env.MERCHANT_ACCOUNT_WRITES_ENABLED="true";
  const f=fixture();
  try{
    await serve(f,async url=>{
      const body={full_name:"Changed Account",phone:"+27712345678",dark_mode:true};
      const r=await request(url,"owner-A","POST",body);
      assert.equal(r.status,503);
      assert.equal(r.payload.code,"MERCHANT_ACCOUNT_WRITES_DISABLED");
      assert.equal(r.payload.success,false);
      assert.equal(r.cache,"no-store");
      const again=await request(url,"owner-A");
      assert.equal(again.payload.profile?.full_name,"Owner Alpha");
    });
  }finally{
    if(prev===undefined)delete process.env.MERCHANT_ACCOUNT_WRITES_ENABLED;
    else process.env.MERCHANT_ACCOUNT_WRITES_ENABLED=prev;
  }
  assert.equal(f.writes.length,0);
});

test("N8D composition stays unmounted in active server regardless of env flags",()=>{
  const active=readFileSync(new URL("../../src/server.ts",import.meta.url),"utf8");
  assert.ok(!active.includes("merchantAccountDormantApi"));
  assert.ok(!active.includes("merchantAccountContract"));
  assert.ok(!active.includes("merchantFirestoreAccountStore"));
  assert.ok(!active.includes('app.use("/api/v1/merchant/account"'));
});
