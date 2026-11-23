import {Router,type RequestHandler,type Response} from "express";
import {authenticateFirebase,type AuthenticatedRequest} from "../middleware/authenticateFirebase.js";
import {supabaseAdmin} from "../lib/supabaseAdmin.js";
import {initialAccount,SupabaseMerchantProfileStore,type MerchantProfileStore,type MerchantAccountRow,type MerchantShopRow} from "./merchantProfileStore.js";
import {MerchantProfileInputError,parseMerchantAccountPatch,parseMerchantShopPatch,profileRevision} from "./merchantProfileContract.js";

export const merchantAccountWritesEnabled=()=>process.env.MERCHANT_ACCOUNT_PROFILE_WRITES_ENABLED==="true";
export const merchantShopWritesEnabled=()=>process.env.MERCHANT_SHOP_PROFILE_WRITES_ENABLED==="true";
type Options={store:MerchantProfileStore;authenticate?:RequestHandler;accountWrites?:()=>boolean;shopWrites?:()=>boolean};
const output=(res:Response,status:number,code:string)=>res.status(status).json({success:false,code,error:code});
const equalChanges=(row:Record<string,unknown>,changes:Record<string,unknown>)=>
 Object.entries(changes).every(([key,value])=>row[key]===value);
const validAccount=(value:MerchantAccountRow|null,uid:string,shopId:string):value is MerchantAccountRow=>
 !!value && value.merchant_uid===uid && value.shop_id===shopId && profileRevision(value.revision) &&
 typeof value.full_name==="string" && typeof value.phone==="string" && typeof value.avatar_url==="string" &&
 typeof value.marketing_opt_in==="boolean" && typeof value.dark_mode==="boolean";
const validShop=(value:MerchantShopRow|null,uid:string,shopId:string):value is MerchantShopRow=>
 !!value && value.owner_id===uid && String(value.id)===shopId &&
 profileRevision(value.merchant_profile_revision) &&
 typeof value.name==="string" && typeof value.description==="string" && typeof value.category==="string" &&
 typeof value.phone==="string" && typeof value.logo_url==="string" &&
 typeof value.opening_time==="string" && typeof value.closing_time==="string";

export function makeMerchantProfilesRouter(options:Options):Router{
 const router=Router();
 const authenticate=options.authenticate??authenticateFirebase;
 router.use((_,res,next)=>{res.set("Cache-Control","no-store");next();});
 router.use(authenticate);
 const owner=async(req:AuthenticatedRequest,res:Response)=>{
  const uid=req.authUser?.uid;
  if(!uid || req.authUser?.isAnonymous) {output(res,401,"MERCHANT_AUTH_REQUIRED");return null;}
  const shop=await options.store.ownedShop(uid);
  if(!shop){output(res,404,"MERCHANT_SHOP_NOT_MAPPED");return null;}
  if(shop.owner_id!==uid){output(res,403,"MERCHANT_OWNER_UNVERIFIED");return null;}
  return {uid,shopId:String(shop.id)};
 };
 const unexpected=(res:Response,e:unknown)=>{
  if(e instanceof MerchantProfileInputError){output(res,400,e.code);return;}
  if(e instanceof Error && e.message==="MULTIPLE_ACTIVE_SHOPS"){output(res,409,"MULTIPLE_ACTIVE_SHOPS");return;}
  output(res,503,"MERCHANT_PROFILE_UNAVAILABLE");
 };
 router.get("/profile",async(req:AuthenticatedRequest,res:Response):Promise<void>=>{
  try{
   const context=await owner(req,res);if(!context)return;
   const stored=await options.store.readAccount(context.uid);
   if(stored && !validAccount(stored,context.uid,context.shopId)){output(res,503,"MERCHANT_PROFILE_UNCONFIRMED");return;}
   res.json({success:true,profile:stored??initialAccount(context.uid,context.shopId)});
  }catch(e){unexpected(res,e);}
 });
 router.patch("/profile",async(req:AuthenticatedRequest,res:Response):Promise<void>=>{
  if(!(options.accountWrites??merchantAccountWritesEnabled)()){output(res,503,"MERCHANT_ACCOUNT_WRITES_DISABLED");return;}
  try{
   const context=await owner(req,res);if(!context)return;
   const input=parseMerchantAccountPatch(req.body);
   const before=await options.store.readAccount(context.uid);
   if(before && !validAccount(before,context.uid,context.shopId)){output(res,503,"MERCHANT_PROFILE_UNCONFIRMED");return;}
   if((before?.revision??0)!==input.expected_revision){output(res,409,"MERCHANT_PROFILE_CHANGED");return;}
   const saved=await options.store.writeAccount(context.uid,context.shopId,input.expected_revision,input.changes,!before);
   const confirmed=await options.store.readAccount(context.uid);
   if(!validAccount(saved,context.uid,context.shopId) ||
      !validAccount(confirmed,context.uid,context.shopId) ||
      saved.revision!==input.expected_revision+1 || confirmed.revision!==saved.revision ||
      !equalChanges(saved,input.changes) || !equalChanges(confirmed,input.changes)){
    output(res,saved?503:409,saved?"MERCHANT_PROFILE_SAVE_UNCONFIRMED":"MERCHANT_PROFILE_CHANGED");return;
   }
   res.json({success:true,profile:confirmed});
  }catch(e){unexpected(res,e);}
 });
 router.get("/shop/profile",async(req:AuthenticatedRequest,res:Response):Promise<void>=>{
  try{
   const context=await owner(req,res);if(!context)return;
   const shop=await options.store.readShop(context.uid,context.shopId);
   if(!validShop(shop,context.uid,context.shopId)){output(res,503,"MERCHANT_SHOP_PROFILE_UNAVAILABLE");return;}
   res.json({success:true,shop});
  }catch(e){unexpected(res,e);}
 });
 router.patch("/shop/profile",async(req:AuthenticatedRequest,res:Response):Promise<void>=>{
  if(!(options.shopWrites??merchantShopWritesEnabled)()){output(res,503,"MERCHANT_SHOP_WRITES_DISABLED");return;}
  try{
   const context=await owner(req,res);if(!context)return;
   const input=parseMerchantShopPatch(req.body);
   if(input.shop_id!==context.shopId){output(res,403,"MERCHANT_SHOP_FORBIDDEN");return;}
   const before=await options.store.readShop(context.uid,context.shopId);
   if(!validShop(before,context.uid,context.shopId)){output(res,503,"MERCHANT_SHOP_PROFILE_UNAVAILABLE");return;}
   if(before.merchant_profile_revision!==input.expected_revision){output(res,409,"MERCHANT_SHOP_PROFILE_CHANGED");return;}
   const saved=await options.store.writeShop(context.uid,context.shopId,input.expected_revision,input.changes);
   const confirmed=await options.store.readShop(context.uid,context.shopId);
   if(!validShop(saved,context.uid,context.shopId) ||
      !validShop(confirmed,context.uid,context.shopId) ||
      saved.merchant_profile_revision!==input.expected_revision+1 ||
      confirmed.merchant_profile_revision!==saved.merchant_profile_revision ||
      !equalChanges(saved,input.changes) || !equalChanges(confirmed,input.changes)){
     output(res,saved?503:409,saved?"MERCHANT_SHOP_SAVE_UNCONFIRMED":"MERCHANT_SHOP_PROFILE_CHANGED");return;
   }
   res.json({success:true,shop:confirmed});
  }catch(e){unexpected(res,e);}
 });
 return router;
}
export const merchantProfilesRouter=makeMerchantProfilesRouter({store:new SupabaseMerchantProfileStore(supabaseAdmin)});
