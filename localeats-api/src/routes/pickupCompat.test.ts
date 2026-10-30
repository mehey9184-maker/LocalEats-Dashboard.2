import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../server.js";
import {authAdmin} from "../lib/firebaseAdmin.js";
import {supabaseAdmin} from "../lib/supabaseAdmin.js";

test("mounted Firebase-authenticated pickup quote, CORS and write gate use no persistence",async()=>{
 // Test-process-only provider substitution. This module is never imported by the deployed server.
 const originalVerify=authAdmin.verifyIdToken,originalFrom=supabaseAdmin.from;
 let verified=0,reads=0;
 (authAdmin as any).verifyIdToken=async(token:string)=>{assert.equal(token,"offline-test");verified++;return {uid:"customer-test"};};
 (supabaseAdmin as any).from=(table:string)=>{
  assert.ok(["shops","menu_items"].includes(table));reads++;
  const data=table==="shops" ? {id:"s",name:"Shop",location:"Ivory Park",archived_at:null,is_active:true,approval_status:"approved",lat:-25.98,lng:28.2,latitude:null,longitude:null}
   : [{id:"m",shop_id:"s",name:"Kota",price:32.5,is_available:true}];
  const query:any={select(){return this;},eq(){return this;},in(){return this;},maybeSingle(){return Promise.resolve({data,error:null});},then(resolve:any){return Promise.resolve({data,error:null}).then(resolve);}};
  return query;
 };
 const server=http.createServer(app);
 try {
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  const denied=await fetch(base+"/api/v1/orders/quote",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
  assert.equal(denied.status,401);assert.equal(reads,0);
  const preflight=await fetch(base+"/api/v1/orders/quote",{method:"OPTIONS",headers:{origin:"https://www.localeatssa.co.za","access-control-request-method":"POST","access-control-request-headers":"authorization,content-type"}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get("access-control-allow-origin"),"https://www.localeatssa.co.za");
  const badOrigin=await fetch(base+"/health",{headers:{origin:"https://www.localeatssa.co.za.attacker.test"}});assert.equal(badOrigin.status,403);
  const result=await fetch(base+"/api/v1/orders/quote",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer fb-offline-test",origin:"https://www.localeatssa.co.za"},body:JSON.stringify({contract_version:"pickup-v1",idempotency_key:"11111111-1111-4111-8111-111111111111",shop_id:"s",items:[{menu_item_id:"m",quantity:2}],delivery_type:"collection",delivery_schedule_mode:"standard",payment_method:"cash",customer_details:{name:"Test",phone:"0712345678"},launch_location:{lat:-25.98,lng:28.2}})});
  assert.equal(result.status,200);assert.equal((await result.json()).quote.total_minor,6500);assert.equal(verified,1);assert.equal(reads,2);
  const writes=await fetch(base+"/api/v1/orders",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
  assert.equal(writes.status,503);assert.equal((await writes.json()).code,"PICKUP_WRITES_DISABLED");assert.equal(reads,2);
 } finally {
  authAdmin.verifyIdToken=originalVerify;supabaseAdmin.from=originalFrom;
  await new Promise<void>(resolve=>server.close(()=>resolve()));
 }
});
