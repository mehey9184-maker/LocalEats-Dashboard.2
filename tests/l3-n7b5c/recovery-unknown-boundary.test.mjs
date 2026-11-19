import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createMerchantPickupRecovery} from "../../src/services/merchantPickupRecovery.ts";
import {mapApiOrder} from "../../src/services/merchantPickupPolicy.ts";

const commandId="11111111-1111-4111-8111-111111111111";
const order={id:"isolated-order",shop_id:"owned-shop",delivery_type:"collection",status:"pending",
 payment_status:"unpaid",revision:0,total_price:25,
 items:[{name:"Kota",quantity:1,unit_price:25,line_total:25}]};
const command={path:"accept",body:{command_id:commandId,expected_revision:0}};
const storedKey="pickup-command:isolated-owner:isolated-order";

function harness(transport=async()=>({status:200,data:{success:true,order:{...order,status:"preparing",revision:1},
 command_receipt:{command_id:commandId,order_id:order.id,actor_uid:"isolated-owner",kind:"accepted",revision:1}}})) {
 let calls=0;
 const cache=new Map();
 const api=createMerchantPickupRecovery({
  identity:()=>"isolated-owner",enabled:()=>true,
  storage:{getItem:k=>cache.get(k)??null,setItem:(k,v)=>cache.set(k,v),removeItem:k=>cache.delete(k)},
  transport:async(...args)=>{calls++;return transport(...args);},
  mapOrder:mapApiOrder,timeoutMs:100
 });
 return {api,cache,get calls(){return calls;}};
}

test("unknown malformed cached commands never reach an HTTP transport",async()=>{
 const inputs=[
  null,42,"accept",[],{}, {path:"accept",body:[]},
  {path:"accept",body:{command_id:commandId,expected_revision:"0"}},
  {path:"accept",body:{command_id:commandId,expected_revision:0,owner_id:"other"}},
  {path:"payment-confirmation",body:{command_id:commandId,expected_revision:0,payment_method:{value:"cash"}}},
  {path:"../../orders",body:{command_id:commandId,expected_revision:0}}
 ];
 for(const invalid of inputs){
  const f=harness();
  f.cache.set(storedKey,JSON.stringify(invalid));
  await assert.rejects(f.api.retry(order),/saved action needs recovery/);
  assert.equal(f.calls,0);
 }
});

test("receipt must be a matching object, not a string or list, before clearing recovery",async()=>{
 for(const receipt of [null,[], "confirmed", {command_id:commandId,order_id:"foreign",actor_uid:"isolated-owner",kind:"accepted",revision:1}]){
  const f=harness(async()=>({status:200,data:{success:true,order:{...order,status:"preparing",revision:1},command_receipt:receipt}}));
  await assert.rejects(f.api.send(order,command),/did not confirm/);
  assert.equal(f.calls,1);
  assert.equal(f.cache.has(storedKey),true);
 }
});

test("authenticated typed recovery retains original successful command/receipt semantics",async()=>{
 const f=harness();
 const confirmed=await f.api.send(order,command);
 assert.equal(confirmed.status,"preparing");
 assert.equal(f.cache.size,0);
 assert.equal(f.calls,1);
});

test("legacy availability adapter props are absent while server authority remains",()=>{
 const overview=readFileSync(new URL("../../src/components/DashboardOverview.tsx",import.meta.url),"utf8");
 const helper=readFileSync(new URL("../../src/utils/availabilityChecker.ts",import.meta.url),"utf8");
 assert.doesNotMatch(overview,/supabase:\s*supabase as any|updateFirestoreShop/);
 assert.match(overview,/syncShopAvailability\(\{/);
 assert.match(helper,/MerchantApi\.setAvailability/);
 assert.doesNotMatch(helper,/await params\.supabase\?\.from/);
});
