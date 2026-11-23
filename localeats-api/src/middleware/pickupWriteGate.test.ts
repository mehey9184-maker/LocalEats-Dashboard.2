import test from "node:test";
import assert from "node:assert/strict";
import type {Request,Response} from "express";
import {pickupWriteGate,assertPickupWritesDisabled} from "./pickupWriteGate.js";

// This intentionally incomplete in-memory Express facade never reaches a database.
const fixtureRequest=(method:string,path:string):Request=>({method,path} as Request);
const fixtureResponse=(onJson?:(body:Record<string,unknown>)=>void,onStatus?:(code:number)=>void):Response=>{
 const result={
  status(code:number){onStatus?.(code);return this;},
  set(){return this;},
  json(body:Record<string,unknown>){onJson?.(body);return this;}
 };
 return result as unknown as Response;
};
test("new/legacy order, payment and collection requests cannot reach any persistence handler",()=>{
 for(const [method,path] of [["POST","/api/v1/orders"],["POST","/api/orders"],["PATCH","/api/orders/old"],["PATCH","/api/v1/orders/old"],["POST","/api/v1/merchant/orders/id/payment-confirmation"],["POST","/api/v1/merchant/orders/id/collect"]]){
  let next=false,status=0,body:Record<string,unknown>={};
  const res=fixtureResponse(value=>{body=value;},code=>{status=code;});
  pickupWriteGate(fixtureRequest(method,path),res,()=>{next=true;throw new Error("Persistence must be unreachable");});
  assert.equal(next,false);assert.equal(status,503);assert.equal(body.success,false);assert.equal(body.code,"PICKUP_WRITES_DISABLED");assert.equal(body.order,undefined);
 }
});
test("catalog, quote, history and Rider continuation paths retain routing",()=>{
 for(const [method,path] of [["GET","/api/v1/orders"],["POST","/api/v1/orders/quote"],["GET","/api/v1/catalog/pickup-shops"],["POST","/api/v1/rider/orders/id/complete"],["POST","/api/v1/merchant/orders/id/ready"]]){
  let next=false;pickupWriteGate(fixtureRequest(method,path),fixtureResponse(),()=>{next=true;});assert.equal(next,true);
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
   let reached=false;pickupWriteGate(fixtureRequest("POST","/api/v1/orders"),fixtureResponse(),()=>{reached=true;});assert.equal(reached,value==="true");
  }
  let reached=false;pickupWriteGate(fixtureRequest("PATCH","/api/v1/orders/id"),fixtureResponse(),()=>{reached=true;});assert.equal(reached,false);
 }finally{if(old===undefined)delete process.env.PICKUP_WRITES_ENABLED;else process.env.PICKUP_WRITES_ENABLED=old;}
});
