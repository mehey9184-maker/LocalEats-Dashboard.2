import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import express from "express";
import { previewReadOnlyGate } from "./previewReadOnlyGate.js";

test("Preview HTTP requests cannot mutate database via any API verb, but can read",async()=>{
  const prior=process.env.VERCEL_ENV;
  process.env.VERCEL_ENV="preview";
  const app=express();
  app.use(previewReadOnlyGate);
  app.all("/synthetic",(_req,res)=>res.status(200).json({success:true}));
  const server=app.listen(0,"127.0.0.1");
  try{
    await once(server,"listening");
    const addr=server.address();
    if(!addr||typeof addr==="string")throw Error("Missing local test port");
    const url="http://127.0.0.1:"+addr.port+"/synthetic";
    for(const method of ["POST","PUT","PATCH","DELETE"]){
      const response=await fetch(url,{method});
      assert.equal(response.status,503,method+" should be blocked in Preview");
      assert.equal(response.headers.get("cache-control"),"no-store");
      const body=await response.json() as {code?:string;success?:boolean};
      assert.equal(body.code,"PREVIEW_READ_ONLY");
      assert.equal(body.success,false);
    }
    for(const method of ["GET","HEAD","OPTIONS"]){
      const response=await fetch(url,{method});
      assert.equal(response.status,200,method+" should remain read-only available");
    }
  }finally{
    server.close();
    if(prior===undefined)delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV=prior;
  }
});

test("Production and local API handling remain unchanged by Preview guard",async()=>{
  const previous=process.env.VERCEL_ENV;
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
