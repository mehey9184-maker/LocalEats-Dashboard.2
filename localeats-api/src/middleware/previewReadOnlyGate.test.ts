import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import express from "express";
import { isReadOnlyPreviewMode, previewReadOnlyGate } from "./previewReadOnlyGate.js";
import { pickupNotificationRoutes } from "../routes/pickupNotifications.js";
import { authAdmin } from "../lib/firebaseAdmin.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

test("Preview HTTP requests cannot mutate database via any API verb, but can read",async()=>{
  const prior=process.env.VERCEL_ENV;
  process.env.VERCEL_ENV="preview";
  const app=express();
  app.use(previewReadOnlyGate);
  app.all("/synthetic",(_req,res)=>res.status(200).json({success:true}));
  app.all("/api/v1/notifications",(_req,res)=>res.status(200).json({success:true,notifications:[]}));
  const server=app.listen(0,"127.0.0.1");
  try{
    await once(server,"listening");
    const addr=server.address();
    if(!addr||typeof addr==="string")throw Error("Missing local test port");
    const url="http://127.0.0.1:"+addr.port+"/synthetic";
    for(const method of ["POST","PUT","PATCH","DELETE"]){
      const response: Awaited<ReturnType<typeof fetch>> = await fetch(url,{method});
      assert.equal(response.status,503,method+" should be blocked in Preview");
      assert.equal(response.headers.get("cache-control"),"no-store");
      const body=await response.json() as {code?:string;success?:boolean};
      assert.equal(body.code,"PREVIEW_READ_ONLY");
      assert.equal(body.success,false);
    }
    for(const method of ["GET","HEAD","OPTIONS"]){
      const response: Awaited<ReturnType<typeof fetch>> = await fetch(url,{method});
      assert.equal(response.status,200,method+" should remain read-only available");
    }
    // The notification route now suppresses all push/outbox side effects in
    // read-only Preview, so its authenticated GET and implicit HEAD may read.
    for(const method of ["GET","HEAD"]){
      const response: Awaited<ReturnType<typeof fetch>> = await fetch("http://127.0.0.1:"+addr.port+"/api/v1/notifications",{method});
      assert.equal(response.status,200,"Read-only notification "+method+" must be permitted");
    }
  }finally{
    server.close();
    if(prior===undefined)delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV=prior;
  }
});

test("Production and local API handling remain unchanged by Preview guard",async()=>{
  const previous=process.env.VERCEL_ENV;
  const previousFlag=process.env.LOCALEATS_PREVIEW_READ_ONLY;
  delete process.env.LOCALEATS_PREVIEW_READ_ONLY;
  let next=0,responseCode=0;
  const res={
    status(status:number){responseCode=status;return this;},
    set(){return this;},
    json(){return this;}
  };
  const handler=(method:string)=>previewReadOnlyGate(
    {method} as never,res as never,()=>{next++;}
  );
  try{
    process.env.VERCEL_ENV="production";
    handler("POST");
    process.env.VERCEL_ENV="development";
    handler("PATCH");
    delete process.env.VERCEL_ENV;
    handler("DELETE");
    assert.equal(next,3);
    assert.equal(responseCode,0);
  }finally{
    if(previous===undefined)delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV=previous;
    if(previousFlag===undefined)delete process.env.LOCALEATS_PREVIEW_READ_ONLY;
    else process.env.LOCALEATS_PREVIEW_READ_ONLY=previousFlag;
  }
});

test("Explicit Preview read-only flag blocks writes even without Vercel system env",()=>{
  const prev=process.env.VERCEL_ENV;
  const prevFlag=process.env.LOCALEATS_PREVIEW_READ_ONLY;
  try{
    delete process.env.VERCEL_ENV;
    process.env.LOCALEATS_PREVIEW_READ_ONLY="true";
    let blocked=0,nextCalled=false;
    const res={
      status(n:number){blocked=n;return this;},
      set(){return this;},
      json(){return this;}
    };
    previewReadOnlyGate({method:"POST"} as never,res as never,()=>{nextCalled=true;});
    assert.equal(blocked,503);
    assert.equal(nextCalled,false);
  } finally {
    if(prev===undefined)delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV=prev;
    if(prevFlag===undefined)delete process.env.LOCALEATS_PREVIEW_READ_ONLY;
    else process.env.LOCALEATS_PREVIEW_READ_ONLY=prevFlag;
  }
});

test("Preview barrier sits ahead of every app write route",()=>{
  const appSource=readFileSync(new URL("../../src/server.ts",import.meta.url),"utf8");
  const gate=appSource.indexOf("app.use(previewReadOnlyGate);");
  const legacy=appSource.indexOf("app.use(legacyOrderGuard);");
  const pickup=appSource.indexOf("app.use(pickupWriteGate);");
  const merchant=appSource.indexOf('app.use("/api/v1/merchant", merchantRoutes)');
  assert.ok(gate>0);
  assert.ok(gate<legacy && gate<pickup && gate<merchant);
});


test("Preview authenticated notification inbox reads account-scoped events without outbox writes",async()=>{
  const priorEnv=process.env.VERCEL_ENV, priorFlag=process.env.LOCALEATS_PREVIEW_READ_ONLY;
  const originalFrom=supabaseAdmin.from, originalRpc=supabaseAdmin.rpc;
  const originalVerify=authAdmin.verifyIdToken;
  const seenFilters:Array<Array<[string,unknown]>>=[];
  let rpcCalls=0, readCalls=0;
  try {
    process.env.VERCEL_ENV="preview";
    delete process.env.LOCALEATS_PREVIEW_READ_ONLY;
    (authAdmin as any).verifyIdToken=async(token:string)=>({uid:token,email:null});
    (supabaseAdmin as any).rpc=async()=>{rpcCalls++;throw Error("Preview must never call mutating outbox RPC");};
    (supabaseAdmin as any).from=(table:string)=>{
      assert.equal(table,"pickup_order_events");
      readCalls++;
      const filters:Array<[string,unknown]>=[];
      seenFilters.push(filters);
      const q:any={
        select:()=>q,
        eq:(k:string,v:unknown)=>{filters.push([k,v]);return q;},
        order:()=>q, limit:()=>q, or:()=>q,
        then:(resolve:any,reject:any)=>Promise.resolve({
          data:filters.some(([k,v])=>k==="recipient_uid" && v==="customer-a")
            ? [{id:"550e8400-e29b-41d4-a716-446655440000",
                order_id:"550e8400-e29b-41d4-a716-446655440001",
                kind:"ready",occurred_at:"2026-11-07T00:00:00Z"}] : [],
          error:null
        }).then(resolve,reject)
      };
      return q;
    };
    const app=express();
    app.use(previewReadOnlyGate);
    app.use("/api/v1",pickupNotificationRoutes);
    const server=app.listen(0,"127.0.0.1");await once(server,"listening");
    try {
      const address=server.address();
      if(!address||typeof address==="string")throw Error("Missing test server");
      const url="http://127.0.0.1:"+address.port+"/api/v1/notifications";
      const a=await fetch(url,{headers:{Authorization:"Bearer fb-customer-a"}});
      assert.equal(a.status,200);
      assert.equal((await a.json() as {notifications:unknown[]}).notifications.length,1);
      const b=await fetch(url,{headers:{Authorization:"Bearer fb-customer-b"}});
      assert.equal(b.status,200);
      assert.deepEqual((await b.json() as {notifications:unknown[]}).notifications,[]);
      const anon=await fetch(url);
      assert.equal(anon.status,401);
      const head=await fetch(url,{method:"HEAD",headers:{Authorization:"Bearer fb-customer-a"}});
      assert.equal(head.status,200);
      const rejected=await fetch(url.replace("/notifications","/push-subscriptions/550e8400-e29b-41d4-a716-446655440000"),{
        method:"PUT",headers:{Authorization:"Bearer fb-customer-a","Content-Type":"application/json"},
        body:JSON.stringify({fcm_token:"synthetic",permission_granted:true})
      });
      assert.equal(rejected.status,503);
      assert.equal((await rejected.json() as {code:string}).code,"PREVIEW_READ_ONLY");
      assert.equal(readCalls,3);
      assert.equal(rpcCalls,0);
      for(const filters of seenFilters){
        assert.equal(filters.some(([key])=>key==="recipient_uid"),true);
        assert.equal(filters.some(([key,value])=>key==="kind" && value==="ready"),true);
      }
    } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
  } finally {
    (supabaseAdmin as any).from=originalFrom;
    (supabaseAdmin as any).rpc=originalRpc;
    (authAdmin as any).verifyIdToken=originalVerify;
    if(priorEnv===undefined)delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV=priorEnv;
    if(priorFlag===undefined)delete process.env.LOCALEATS_PREVIEW_READ_ONLY;
    else process.env.LOCALEATS_PREVIEW_READ_ONLY=priorFlag;
  }
});

test("explicit read-only flag suppresses notification outbox operations without Vercel preview env",()=>{
  const priorEnv=process.env.VERCEL_ENV,priorFlag=process.env.LOCALEATS_PREVIEW_READ_ONLY;
  try {
    process.env.VERCEL_ENV="production";
    process.env.LOCALEATS_PREVIEW_READ_ONLY="true";
    assert.equal(isReadOnlyPreviewMode(),true);
    process.env.LOCALEATS_PREVIEW_READ_ONLY="false";
    assert.equal(isReadOnlyPreviewMode(),false);
    process.env.VERCEL_ENV="preview";
    assert.equal(isReadOnlyPreviewMode(),true);
  } finally {
    if(priorEnv===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=priorEnv;
    if(priorFlag===undefined)delete process.env.LOCALEATS_PREVIEW_READ_ONLY;else process.env.LOCALEATS_PREVIEW_READ_ONLY=priorFlag;
  }
});
