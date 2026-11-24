import type {RequestHandler} from "express";
import {OrderContractError} from "../orders/orderContract.js";
import {pickupWritesEnabled} from "./pickupWriteGate.js";

// Separate server-only capability, default off. Pickup activation never enables delivery.
// No environment is authorized to enable this capability until a separate release review.
export const deliveryWritesEnabled=()=>process.env.DELIVERY_WRITES_ENABLED==="true";
export const assertDeliveryWritesEnabled=():void=>{
 if(!deliveryWritesEnabled())throw new OrderContractError(503,"DELIVERY_WRITES_DISABLED","Delivery and Rider changes are not enabled.");
};
export const launchCapabilityGate:RequestHandler=(req,res,next)=>{
 const method=req.method.toUpperCase(),path=req.path.toLowerCase().replace(/\/+$/,"");
 const mutation=["POST","PUT","PATCH","DELETE"].includes(method);
 if(!mutation){next();return;}
 const deferred=/^\/api\/v1\/(?:rider|merchant\/riders)(?:\/|$)/.test(path);
 const sharedCommand=method==="POST" && (/^\/api\/v1\/orders\/[^/]+\/cancel$/.test(path)||/^\/api\/v1\/merchant\/orders\/[^/]+\/(?:accept|ready)$/.test(path));
 const pickupOnly=method==="POST"&&/^\/api\/v1\/merchant\/orders\/[^/]+\/reject$/.test(path);
 const code=deferred&&!deliveryWritesEnabled()?"DELIVERY_WRITES_DISABLED":
   ((sharedCommand&&!deliveryWritesEnabled()&&!pickupWritesEnabled())||(pickupOnly&&!pickupWritesEnabled()))?"PICKUP_WRITES_DISABLED":null;
 if(!code){next();return;}
 res.status(503).set("Cache-Control","no-store").json({success:false,code,error:"This operation is not enabled. No changes were saved."});
};
