import type {RequestHandler} from "express";
import {OrderContractError} from "../orders/orderContract.js";
export const pickupWriteGate:RequestHandler=(req,res,next)=>{
 const mutation=["POST","PUT","PATCH","DELETE"].includes(req.method);
 const path=req.path.replace(/\/+$/,"").toLowerCase();
 const creation=path==="/api/v1/orders";
 const oldAlias=/^\/api\/orders(?:\/|$)/.test(path);
 const generic=/^\/api\/v1\/(?:merchant\/)?orders\/[^/]+$/.test(path) && ["PUT","PATCH","DELETE"].includes(req.method);
 const pickupCommand=/^\/api\/v1\/(?:merchant\/)?orders\/[^/]+\/(?:payment-confirmation|confirm_payment|collect|collected|complete)$/.test(path);
 if(mutation && (creation || oldAlias || generic || pickupCommand)){
  res.status(503).set("Cache-Control","no-store").json({success:false,code:"PICKUP_WRITES_DISABLED",
   error:"New ordering, payment and collection are not enabled. No order or payment was saved."});return;
 }
 next();
};
export function assertPickupWritesDisabled(order:{delivery_type?:unknown;create_intent_hash?:unknown}):void {
 if(order.delivery_type==="collection" || order.create_intent_hash!=null)
  throw new OrderContractError(503,"PICKUP_WRITES_DISABLED","Pickup transitions require separately approved database activation.");
}
