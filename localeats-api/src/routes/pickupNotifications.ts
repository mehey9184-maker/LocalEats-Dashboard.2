import { Router, type Response } from "express";
import { authenticateFirebase, type AuthenticatedRequest } from "../middleware/authenticateFirebase.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { object, onlyKeys, UUID } from "../orders/pickupService.js";
import { OrderContractError } from "../orders/orderContract.js";
import { drainPickupPush } from "../orders/pickupPush.js";
export const pickupNotificationRoutes=Router();
const errorResponse=(res:Response,error:unknown):void=>{
  const e=error instanceof OrderContractError ? error : new OrderContractError(503,"NOTIFICATION_SERVICE_UNAVAILABLE","Notifications unavailable.");
  res.status(e.status).json({success:false,code:e.code,error:e.message});
};
pickupNotificationRoutes.get("/notifications",authenticateFirebase,async(req:AuthenticatedRequest,res:Response)=>{
  try {
    const uid=req.authUser!.uid;
    // Stable descending keyset pagination; parameters are validated before constructing the filter.
    const before=req.query.before, id=req.query.before_id;
    let query=supabaseAdmin.from("pickup_order_events").select("id,order_id,kind,occurred_at")
      .eq("recipient_uid",uid).eq("kind","ready");
    if (before!==undefined || id!==undefined) {
      if (typeof before!=="string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+]00:00)$/.test(before) ||
        !Number.isFinite(Date.parse(before)) || typeof id!=="string" || !UUID.test(id)) throw new OrderContractError(400,"INVALID_CURSOR","Invalid cursor.");
      query=query.or(`occurred_at.lt.${before},and(occurred_at.eq.${before},id.lt.${id})`);
    }
    const {data,error}=await query.order("occurred_at",{ascending:false}).order("id",{ascending:false}).limit(50);
    if(error) throw error;
    await drainPickupPush(supabaseAdmin,uid);
    const events=data ?? [], last=events.at(-1);
    res.json({success:true,notifications:events,next_cursor:events.length===50 && last ? {before:last.occurred_at,before_id:last.id} : null});
  } catch(error) { errorResponse(res,error); }
});
pickupNotificationRoutes.put("/push-subscriptions/:installationId",authenticateFirebase,async(req:AuthenticatedRequest,res:Response)=>{
  try {
    const uid=req.authUser!.uid,installation=req.params.installationId;
    if(typeof installation!=="string" || !UUID.test(installation)) throw new OrderContractError(400,"INVALID_INSTALLATION","Invalid installation.");
    const body=object(req.body); onlyKeys(body,["fcm_token","permission_granted"]);
    if(body.permission_granted!==true || typeof body.fcm_token!=="string" || body.fcm_token.length<20 || body.fcm_token.length>4096 || /\s/.test(body.fcm_token))
      throw new OrderContractError(400,"PUSH_PERMISSION_REQUIRED","A permitted device token is required.");
    const {error}=await supabaseAdmin.from("pickup_push_subscriptions").upsert({user_id:uid,installation_id:installation,
      fcm_token:body.fcm_token,revoked_at:null},{onConflict:"user_id,installation_id"});
    if(error) throw new OrderContractError(error.code==="23505" ? 409 : 503,"SUBSCRIPTION_NOT_SAVED","Subscription not saved.");
    await drainPickupPush(supabaseAdmin,uid);
    res.json({success:true});
  } catch(error) { errorResponse(res,error); }
});
pickupNotificationRoutes.delete("/push-subscriptions/:installationId",authenticateFirebase,async(req:AuthenticatedRequest,res:Response)=>{
  try {
    const installation=req.params.installationId;
    if(typeof installation!=="string" || !UUID.test(installation)) throw new OrderContractError(400,"INVALID_INSTALLATION","Invalid installation.");
    const {error}=await supabaseAdmin.from("pickup_push_subscriptions").update({revoked_at:new Date().toISOString(),fcm_token:null})
      .eq("user_id",req.authUser!.uid).eq("installation_id",installation);
    if(error) throw error;
    res.json({success:true});
  } catch(error) { errorResponse(res,error); }
});
