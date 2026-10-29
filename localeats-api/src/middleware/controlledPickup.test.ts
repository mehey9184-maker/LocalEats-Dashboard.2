import test from "node:test";
import assert from "node:assert/strict";
import {assertControlledPickup,CONTROLLED_PICKUP_SHOP} from "./controlledPickup.js";
const record={shop_id:CONTROLLED_PICKUP_SHOP,user_id:"fixture-customer"};
const env={PICKUP_WRITES_ENABLED:"true",PICKUP_TEST_CUSTOMER_UID:"fixture-customer"};
test("exact designated shop and configured customer pass",()=>assert.doesNotThrow(()=>assertControlledPickup(record,env)));
test("wrong shop/customer denied even with the global switch enabled",()=>{
 for(const order of [{...record,shop_id:"other"},{...record,user_id:"other"},{shop_id:CONTROLLED_PICKUP_SHOP}])assert.throws(()=>assertControlledPickup(order,env),(e:any)=>e.code==="PICKUP_TEST_NOT_ALLOWED");
});
test("missing or malformed test identity is default-deny and not disclosed",()=>{
 for(const uid of [undefined,""," ","fixture-customer ","a".repeat(129),"fixture\ncustomer"]){const config={...env,PICKUP_TEST_CUSTOMER_UID:uid};assert.throws(()=>assertControlledPickup(record,config),(e:any)=>e.code==="PICKUP_TEST_ALLOWLIST_REQUIRED" && !e.message.includes("fixture-customer"));}
});
test("global switch remains required",()=>{
 for(const flag of [undefined,"false","1","TRUE"])assert.throws(()=>assertControlledPickup(record,{...env,PICKUP_WRITES_ENABLED:flag}),(e:any)=>e.code==="PICKUP_WRITES_DISABLED");
});
