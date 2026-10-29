import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {once} from "node:events";
import {request} from "node:http";
import type {AddressInfo} from "node:net";
import {legacyOrderGuard} from "./legacyOrderGuard.js";

test("obsolete aliases and generic mutations cannot reach a writer; pickup and Rider routes pass through",async()=>{
 const app=express();let calls=0;app.use(legacyOrderGuard);
 app.use((_req,res)=>{calls++;res.json({success:true});});
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");
 const call=(method:string,path:string):Promise<{status:number;body:any}>=>(new Promise((resolve,reject)=>{
  const req=request({host:"127.0.0.1",port:(server.address() as AddressInfo).port,method,path},res=>{
   let data="";res.on("data",chunk=>data+=chunk);res.on("end",()=>resolve({status:res.statusCode!,body:JSON.parse(data)}));
  });req.on("error",reject);req.end();
 }));
 try{
  for(const [method,path] of [["POST","/api/orders"],["PATCH","/api/orders/id"],["POST","/api/v1/orders/id/accept"],
   ["PATCH","/api/v1/orders/id"],["PUT","/api/v1/merchant/orders/id"],["DELETE","/api/v1/merchant/orders/id"]]){
   const result=await call(method!,path!);assert.equal(result.status,426);assert.equal(result.body.code,"PICKUP_CONTRACT_REQUIRED");
   assert.equal(result.body.success,false);assert.equal(result.body.order,undefined);
  }
  assert.equal(calls,0);
  for(const [method,path] of [["GET","/api/v1/orders"],["POST","/api/v1/orders"],["POST","/api/v1/orders/quote"],
   ["POST","/api/v1/merchant/orders/id/accept"],["POST","/api/v1/merchant/orders/id/ready"],
   ["POST","/api/v1/merchant/orders/id/payment-confirmation"],["POST","/api/v1/merchant/orders/id/collect"],
   ["POST","/api/v1/orders/id/cancel"],["POST","/api/v1/rider/orders/id/complete"],["GET","/api/v1/rider/orders/history"]])
    assert.equal((await call(method!,path!)).status,200);
 }finally{server.close();await once(server,"close");}
});
