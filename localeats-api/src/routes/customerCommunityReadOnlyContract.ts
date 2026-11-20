/**
 * L3-N8M — dormant read-only Customer community contract.
 *
 * NOT mounted by src/server.ts. There is no verified staging persistence
 * schema for reviews/follows/messages/orders, and no feature activation.
 * A future server-only store MUST independently verify Firebase UID, shop
 * approval and pickup order participants. Never trust a request UID/role.
 */
import {Router, type RequestHandler, type Response} from "express";
import {authenticateFirebase,type AuthenticatedRequest} from "../middleware/authenticateFirebase.js";

type Row=Record<string,unknown>;
export type ApprovedCommunityShop={id:string;approved:boolean;archived:boolean};
export type VerifiedPickupParticipants={
  id:string;delivery_type:"collection"|"delivery";
  customer_uid:string;verified_merchant_uid:string;
};
export interface CommunityReadOnlyStore {
  approvedShop(shopId:string):Promise<ApprovedCommunityShop|null>;
  publishedReviews(shopId:string,limit:number):Promise<Row[]>;
  followedApprovedShops(uid:string,limit:number):Promise<Row[]>;
  verifiedPickupParticipants(orderId:string):Promise<VerifiedPickupParticipants|null>;
  messagesForVerifiedOrder(orderId:string,limit:number):Promise<Row[]>;
}

const MAX_REVIEWS=25,MAX_FOLLOWS=50,MAX_MESSAGES=50;
const cleanId=(v:unknown):v is string=>
  typeof v==="string" && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
const readId=(v:string|string[]|undefined):string|null=>
  cleanId(v)?v:null;
const denyWrite=(res:Response)=>res.status(503).json({
  success:false,code:"COMMUNITY_WRITES_DISABLED",
  error:"This feature is not accepting changes. No review, follow or message was saved.",
});
const unavailable=(res:Response)=>res.status(503).json({
  success:false,code:"COMMUNITY_STORE_UNAVAILABLE",
  error:"Community information is not available. Try again later.",
});
const invalidStore=(rows:unknown,limit:number):rows is Row[]=>
  Array.isArray(rows) && rows.length<=limit && rows.every(x=>x&&typeof x==="object"&&!Array.isArray(x));
const text=(value:unknown,max:number):value is string=>
  typeof value==="string" && value.length>0 && value.length<=max;

function publicReview(row:Row,shopId:string):Row|null{
  if(row.shop_id!==shopId || row.published!==true ||
     !cleanId(row.id) || !Number.isInteger(row.rating) ||
     (row.rating as number)<1 || (row.rating as number)>5 ||
     !text(row.comment,1200) || !text(row.created_at,60))
    return null;
  // Never include user_id, email, phone, unmoderated username or private notes.
  return {id:row.id,shop_id:shopId,rating:row.rating,
    comment:row.comment,created_at:row.created_at};
}
function publicMessage(row:Row,order:VerifiedPickupParticipants):Row|null{
  if(!cleanId(row.id)||row.order_id!==order.id ||
     !text(row.message,2000)||!text(row.created_at,60))return null;
  if(row.sender_role==="customer" && row.sender_uid===order.customer_uid)
    return {id:row.id,order_id:order.id,sender_role:"customer",
      message:row.message,created_at:row.created_at};
  if(row.sender_role==="merchant" && row.sender_uid===order.verified_merchant_uid)
    return {id:row.id,order_id:order.id,sender_role:"merchant",
      message:row.message,created_at:row.created_at};
  return null;
}
export const customerCommunityWritesEnabled=()=>false as const;
export function makeCustomerCommunityReadOnlyRouter(
  store:CommunityReadOnlyStore,
  authenticate:RequestHandler=authenticateFirebase,
):Router {
  if(!store || typeof store.approvedShop!=="function" ||
     typeof store.publishedReviews!=="function" ||
     typeof store.followedApprovedShops!=="function" ||
     typeof store.verifiedPickupParticipants!=="function" ||
     typeof store.messagesForVerifiedOrder!=="function")
    throw Error("COMMUNITY_READ_STORE_UNCONFIGURED");
  const router=Router();
  router.use((_req,res,next)=>{res.setHeader("Cache-Control","no-store");next();});
  router.use(authenticate);
  router.use((req:AuthenticatedRequest,res,next)=>{
    if(!cleanId(req.authUser?.uid) || req.authUser?.isAnonymous===true){
      res.status(401).json({success:false,code:"REGISTERED_ACCOUNT_REQUIRED"});return;
    }
    next();
  });

  router.get("/shops/:shopId/reviews",async(req:AuthenticatedRequest,res:Response)=>{
    const shopId=readId(req.params.shopId);
    if(!shopId){res.status(404).json({success:false,code:"SHOP_NOT_FOUND"});return;}
    try{
      const shop=await store.approvedShop(shopId);
      if(!shop||shop.id!==shopId||shop.approved!==true||shop.archived!==false){
        res.status(404).json({success:false,code:"SHOP_NOT_FOUND"});return;
      }
      const rows=await store.publishedReviews(shopId,MAX_REVIEWS);
      if(!invalidStore(rows,MAX_REVIEWS)){unavailable(res);return;}
      const result:Row[]=[];
      for(const row of rows){
        const r=publicReview(row,shopId);
        // A privileged DB result may contain an unexpected owner/shop row;
        // do not silently make a potentially corrupted mixed read succeed.
        if(!r){unavailable(res);return;}
        result.push(r);
      }
      res.status(200).json({success:true,reviews:result});
    }catch{unavailable(res);}
  });

  router.get("/me/follows",async(req:AuthenticatedRequest,res:Response)=>{
    const uid=req.authUser!.uid;
    try{
      const rows=await store.followedApprovedShops(uid,MAX_FOLLOWS);
      if(!invalidStore(rows,MAX_FOLLOWS)){unavailable(res);return;}
      const shops:string[]=[];
      for(const row of rows){
        if(row.user_id!==uid||!cleanId(row.shop_id)||row.approved!==true){
          unavailable(res);return;
        }
        shops.push(row.shop_id);
      }
      res.status(200).json({success:true,shop_ids:[...new Set(shops)]});
    }catch{unavailable(res);}
  });

  router.get("/orders/:orderId/messages",async(req:AuthenticatedRequest,res:Response)=>{
    const orderId=readId(req.params.orderId);
    if(!orderId){res.status(404).json({success:false,code:"ORDER_NOT_FOUND"});return;}
    try{
      const order=await store.verifiedPickupParticipants(orderId);
      if(!order||order.id!==orderId||order.delivery_type!=="collection" ||
        !cleanId(order.customer_uid)||!cleanId(order.verified_merchant_uid) ||
        ![order.customer_uid,order.verified_merchant_uid].includes(req.authUser!.uid)){
        // Do not reveal whether another customer's order exists.
        res.status(404).json({success:false,code:"ORDER_NOT_FOUND"});return;
      }
      const rows=await store.messagesForVerifiedOrder(orderId,MAX_MESSAGES);
      if(!invalidStore(rows,MAX_MESSAGES)){unavailable(res);return;}
      const messages:Row[]=[];
      for(const row of rows){
        const m=publicMessage(row,order);
        if(!m){unavailable(res);return;}
        messages.push(m);
      }
      res.status(200).json({success:true,messages});
    }catch{unavailable(res);}
  });

  // Deliberate hard-off write contract; injected store has no write methods.
  router.post("/shops/:shopId/reviews",(_req,res)=>{denyWrite(res);});
  router.post("/me/follows",(_req,res)=>{denyWrite(res);});
  router.delete("/me/follows/:shopId",(_req,res)=>{denyWrite(res);});
  router.post("/orders/:orderId/messages",(_req,res)=>{denyWrite(res);});
  router.patch("/orders/:orderId/messages/read",(_req,res)=>{denyWrite(res);});
  return router;
}
