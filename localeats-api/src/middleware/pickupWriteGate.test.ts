import test from "node:test";
import assert from "node:assert/strict";
import type {Request,Response} from "express";
import {pickupWriteGate,assertPickupWritesDisabled} from "./pickupWriteGate.js";
test("new/legacy order, payment and collection requests cannot reach any persistence handler",()=>{
 for(const [method,path] of [["POST","/api/v1/orders"],["POST","/api/orders"],["PATCH","/api/orders/old"],["PATCH","/api/v1/orders/old"],["POST","/api/v1/merchant/orders/id/payment-confirmation"],["POST","/api/v1/merchant/orders/id/collect"]]){
  let next=false,status=0;let body:Record<string,unknown>={};
  const res={status(n:number){status=n;return this;},set(){return this;},json(value:Record<string,unknown>){body=value;return this;}} as unknown as Response;
  pickupWriteGate({method,path} as unknown as Request,res,()=>{next=true;throw new Error("Persistence must be unreachable");});
  assert.equal(next,false);assert.equal(status,503);assert.equal(body.success,false);assert.equal(body.code,"PICKUP_WRITES_DISABLED");assert.equal(body.order,undefined);
 }
});
test("catalog, quote, history and Rider continuation paths retain routing",()=>{
 for(const [method,path] of [["GET","/api/v1/orders"],["POST","/api/v1/orders/quote"],["GET","/api/v1/catalog/pickup-shops"],["POST","/api/v1/rider/orders/id/complete"],["POST","/api/v1/merchant/orders/id/ready"]]){
  let next=false;pickupWriteGate({method,path} as unknown as Request,{} as unknown as Response,()=>{next=true;});assert.equal(next,true);
 }
 assert.doesNotThrow(()=>assertPickupWritesDisabled({delivery_type:"delivery"}));
 assert.throws(()=>assertPickupWritesDisabled({delivery_type:"collection"}));
 assert.throws(()=>assertPickupWritesDisabled({create_intent_hash:"managed"}));
});

test("activation requires exact server opt-in; obsolete generic writes remain closed",()=>{
 const old=process.env.PICKUP_WRITES_ENABLED;
 try{
  for(const value of [undefined,"false","1","TRUE","true"]){
   if(value===undefined)delete process.env.PICKUP_WRITES_ENABLED;else process.env.PICKUP_WRITES_ENABLED=value;
   let reached=false;const res={status(){return this;},set(){return this;},json(){return this;}} as unknown as Response;
   pickupWriteGate({method:"POST",path:"/api/v1/orders"} as unknown as Request,res,()=>{reached=true;});assert.equal(reached,value==="true");
  }
  let reached=false;pickupWriteGate({method:"PATCH",path:"/api/v1/orders/id"} as unknown as Request,{status(){return this;},set(){return this;},json(){return this;}} as unknown as Response,()=>{reached=true;});assert.equal(reached,false);
 }finally{if(old===undefined)delete process.env.PICKUP_WRITES_ENABLED;else process.env.PICKUP_WRITES_ENABLED=old;}
});
