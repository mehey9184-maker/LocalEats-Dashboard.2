import { Router, type Response } from "express";
import { authenticateFirebase, type AuthenticatedRequest } from "../middleware/authenticateFirebase.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { object, onlyKeys, UUID } from "../orders/pickupService.js";
import { OrderContractError } from "../orders/orderContract.js";
import { drainPickupPush } from "../orders/pickupPush.js";
import {createMerchantPushTestService,sendMerchantTestPushToFirebase} from "../orders/merchantPushTest.js";
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
    // Exactly one active owner per FCM token. When a shared browser changes
    // accounts, revoke the old subscription before claiming this same device.
    // The database also has a unique fcm_token constraint for racing requests.
    const {error:priorError}=await supabaseAdmin.from("pickup_push_subscriptions")
      .update({revoked_at:new Date().toISOString(),fcm_token:null})
      .eq("fcm_token",body.fcm_token).neq("installation_id",installation);
    if(priorError) throw new OrderContractError(503,"DEVICE_TRANSFER_UNAVAILABLE","Device transfer could not be verified.");
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

/**
 * Human-triggered test notification, never an order or purchase.
 * Only the authenticated approved shop owner may send to their own
 * active, explicitly registered installation. No identifiers are echoed.
 */
const sendMerchantTestNotification=createMerchantPushTestService({
  hasApprovedShop:async uid=>{
    const {data,error}=await supabaseAdmin.from("shops")
      .select("id,approval_status")
      .eq("owner_id",uid).is("archived_at",null).limit(2);
    if(error)throw error;
    return Array.isArray(data)&&data.length===1&&data[0]?.approval_status==="approved";
  },
  findOwnedActiveDevice:async(uid,installationId)=>{
    const {data,error}=await supabaseAdmin.from("pickup_push_subscriptions")
      .select("fcm_token")
      .eq("user_id",uid).eq("installation_id",installationId)
      .is("revoked_at",null).maybeSingle();
    if(error)throw error;
    return typeof data?.fcm_token==="string" && data.fcm_token.length>=20 ? data.fcm_token:null;
  },
  send:sendMerchantTestPushToFirebase
});
pickupNotificationRoutes.post("/push-subscriptions/:installationId/test",
  authenticateFirebase,async(req:AuthenticatedRequest,res:Response)=>{
    res.set("Cache-Control","no-store");
    if(!req.body || typeof req.body!=="object" || Array.isArray(req.body) ||
       Object.keys(req.body).length>0){
      res.status(400).json({success:false,code:"TEST_INVALID_PAYLOAD"});return;
    }
    const result=await sendMerchantTestNotification(
      req.authUser!.uid,String(req.params.installationId||"")
    );
    res.status(result.status).json({
      success:result.status===202,
      code:result.code,
      ...(result.status===202?{message:"Firebase accepted the test message; device delivery is not yet verified."}:{})
    });
  }
);
