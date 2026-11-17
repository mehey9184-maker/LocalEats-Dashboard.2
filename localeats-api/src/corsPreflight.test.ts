import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";

test("merchant push registration PUT preflight succeeds only for approved origins",async()=>{
  process.env.MERCHANT_DASHBOARD_ORIGIN="https://dashboard.localeatssa.co.za";
  const {default:app}=await import("./server.js");
  const server=createServer(app);
  await new Promise<void>((resolve,reject)=>{
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
  });
  try{
    const {port}=server.address() as AddressInfo;
    const target=`http://127.0.0.1:${port}/api/v1/push-subscriptions/00000000-0000-4000-8000-000000000001`;
    const allowed=await fetch(target,{method:"OPTIONS",headers:{
      Origin:"https://dashboard.localeatssa.co.za",
      "Access-Control-Request-Method":"PUT",
      "Access-Control-Request-Headers":"authorization,content-type"
    }});
    assert.equal(allowed.status,204);
    assert.equal(allowed.headers.get("access-control-allow-origin"),"https://dashboard.localeatssa.co.za");
    assert.ok((allowed.headers.get("access-control-allow-methods")||"").split(",").map(x=>x.trim()).includes("PUT"),
      "Authenticated browser PUT must be on Access-Control-Allow-Methods");
    const headers=(allowed.headers.get("access-control-allow-headers")||"").toLowerCase();
    assert.ok(headers.includes("authorization"));
    assert.ok(headers.includes("content-type"));

    // This preflight grants no write privileges and no anonymous registration.
    const unauthorized=await fetch(target,{method:"PUT",headers:{
      Origin:"https://dashboard.localeatssa.co.za",
      "Content-Type":"application/json"
    },body:JSON.stringify({permission_granted:true})});
    assert.equal(unauthorized.status,401);

    const rejected=await fetch(target,{method:"OPTIONS",headers:{
      Origin:"https://dashboard.localeatssa.co.za.attacker.test",
      "Access-Control-Request-Method":"PUT"
    }});
    assert.equal(rejected.status,403);
    assert.notEqual(rejected.headers.get("access-control-allow-origin"),
      "https://dashboard.localeatssa.co.za.attacker.test");
  }finally{
    await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
});
