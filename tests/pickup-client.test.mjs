import test from "node:test";
import assert from "node:assert/strict";
import {createPickupApi} from "../src/pickup/client.ts";
test("business requests use only the Firebase bearer identity and no-store",async()=>{
 let captured;
 const client=createPickupApi("http://127.0.0.1:4000/",async()=>"fixture-token",async(url,options)=>{
  captured={url,options};return new Response(JSON.stringify({success:true,orders:[]}),{status:200});
 });
 await client.orders();
 assert.equal(captured.url,"http://127.0.0.1:4000/api/v1/orders");
 assert.equal(captured.options.headers.Authorization,"Bearer fb-fixture-token");
 assert.equal(captured.options.cache,"no-store");
});
test("missing identity, server errors and malformed responses fail honestly",async()=>{
 let calls=0;
 const missing=createPickupApi("",async()=>"",async()=>{calls++;throw Error("must not run");});
 await assert.rejects(()=>missing.orders(),error=>error.status===401);assert.equal(calls,0);
 for(const response of [new Response(JSON.stringify({success:false,error:"offline"}),{status:503}),new Response("<html>bad gateway</html>",{status:502})]){
  await assert.rejects(()=>createPickupApi("",async()=>"fixture",async()=>response).create({}));
 }
});
test("an HTTP 200 never manufactures order confirmation without a saved id",async()=>{
 for(const body of [{success:true},{success:true,order:{},replayed:false},{success:false,order:{id:"fake"},replayed:false}]){
  const client=createPickupApi("",async()=>"fixture",async()=>new Response(JSON.stringify(body),{status:200}));
  await assert.rejects(()=>client.create({}));
 }
});
test("lost-response retry preserves the original intent and idempotency key",async()=>{
 const payload={idempotency_key:"550e8400-e29b-41d4-a716-446655440000",consent:{total_minor:6250}};
 const calls=[];let attempt=0;
 const client=createPickupApi("",async()=>"fixture",async(_url,options)=>{
  calls.push(options.body);if(attempt++===0)throw Error("response lost after commit");
  return new Response(JSON.stringify({success:true,order:{id:"saved"},replayed:true}),{status:200});
 });
 await assert.rejects(()=>client.create(payload),error=>error.code==="CONNECTION_LOST");
 assert.equal((await client.create(payload)).order.id,"saved");assert.equal(calls[0],calls[1]);
});


test("production connectivity fails before token retrieval or transport for invalid API origins",async()=>{
 for(const base of ["", "/api/v1", "//api.example.test", "http://api.example.test", "https://api.example.test/api/v1",
   "https://user:pass@api.example.test", "https://api.example.test?key=secret", "https://api.example.test/#fragment",
   "https://localhost", "https://127.0.0.1", "https://[::1]"]){
  let calls=0;
  const client=createPickupApi(base,async()=>{calls++;return "identity";},async()=>{calls++;throw Error("must not send");},
   {requireExplicitHttps:true});
  await assert.rejects(()=>client.orders(),error=>error.status===503 && error.code==="API_CONFIGURATION_INVALID");
  await assert.rejects(()=>client.shops({lat:-26,lng:28}),error=>error.code==="API_CONFIGURATION_INVALID");
  assert.equal(calls,0);
 }
});

test("production uses the configured HTTPS API origin, retaining identity and replay body",async()=>{
 const calls=[];
 const client=createPickupApi("https://api.example.test/",async()=>"identity",async(url,options)=>{
  calls.push({url,options});return new Response(JSON.stringify({success:true,order:{id:"saved"},replayed:true}));
 },{requireExplicitHttps:true});
 const payload={idempotency_key:"same-intent"};
 assert.equal((await client.create(payload)).replayed,true);
 assert.equal(calls[0].url,"https://api.example.test/api/v1/orders");
 assert.equal(calls[0].options.headers.Authorization,"Bearer fb-identity");
 assert.equal(calls[0].options.body,JSON.stringify(payload));
});
