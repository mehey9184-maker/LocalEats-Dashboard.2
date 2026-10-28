import test from "node:test";
import assert from "node:assert/strict";
import {pickupWriteGate,assertPickupWritesDisabled} from "./pickupWriteGate.js";
test("new/legacy order, payment and collection requests cannot reach any persistence handler",()=>{
 for(const [method,path] of [["POST","/api/v1/orders"],["POST","/api/orders"],["PATCH","/api/orders/old"],["PATCH","/api/v1/orders/old"],["POST","/api/v1/merchant/orders/id/payment-confirmation"],["POST","/api/v1/merchant/orders/id/collect"]]){
  let next=false,status=0,body:any;
  const res:any={status(n:number){status=n;return this;},set(){return this;},json(value:any){body=value;}};
  pickupWriteGate({method,path} as any,res,()=>{next=true;throw new Error("Persistence must be unreachable");});
  assert.equal(next,false);assert.equal(status,503);assert.equal(body.success,false);assert.equal(body.code,"PICKUP_WRITES_DISABLED");assert.equal(body.order,undefined);
 }
});
test("catalog, quote, history and Rider continuation paths retain routing",()=>{
 for(const [method,path] of [["GET","/api/v1/orders"],["POST","/api/v1/orders/quote"],["GET","/api/v1/catalog/pickup-shops"],["POST","/api/v1/rider/orders/id/complete"],["POST","/api/v1/merchant/orders/id/ready"]]){
  let next=false;pickupWriteGate({method,path} as any,{} as any,()=>{next=true;});assert.equal(next,true);
 }
 assert.doesNotThrow(()=>assertPickupWritesDisabled({delivery_type:"delivery"}));
 assert.throws(()=>assertPickupWritesDisabled({delivery_type:"collection"}));
 assert.throws(()=>assertPickupWritesDisabled({create_intent_hash:"managed"}));
});
