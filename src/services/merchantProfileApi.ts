import {auth} from "../lib/firebase";
import {getApiAuthHeaders} from "../lib/apiAuth";

export type MerchantAccountProfile={
 merchant_uid:string;shop_id:string;revision:number;
 full_name:string;phone:string;avatar_url:string;marketing_opt_in:boolean;dark_mode:boolean;
};
export type MerchantShopProfile={
 id:string;owner_id:string;merchant_profile_revision:number;
 name:string;description:string;category:string;phone:string;logo_url:string;
 opening_time:string;closing_time:string;
};
export type MerchantAccountChange=Pick<MerchantAccountProfile,"full_name"|"phone"|"avatar_url"|"marketing_opt_in"|"dark_mode">;
export type MerchantShopChange=Pick<MerchantShopProfile,"name"|"description"|"category"|"phone"|"logo_url"|"opening_time"|"closing_time">;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const integer=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
const endpoint=()=>{
 const url=import.meta.env.VITE_LOCALEATS_API_URL;
 if(!url)throw Error("Merchant profile API is not configured.");
 return url+"/api/v1/merchant";
};
const request=async(path:string,method:"GET"|"PATCH",data?:Record<string,unknown>)=>{
 const uid=auth.currentUser?.uid;
 if(!uid)throw Error("Sign in to save merchant profile changes.");
 const headers=await getApiAuthHeaders();
 const response=await fetch(endpoint()+path,{method,headers,cache:"no-store",
  ...(data?{body:JSON.stringify(data)}:{})});
 if(auth.currentUser?.uid!==uid)throw Error("Your account changed. Refresh before editing.");
 const body:unknown=await response.json().catch(()=>null);
 if(!object(body))throw Error("Merchant service returned an invalid profile response.");
 if(!response.ok || body.success!==true){
  const code=typeof body.code==="string"?body.code:"MERCHANT_PROFILE_UNAVAILABLE";
  if(code==="MERCHANT_PROFILE_CHANGED"||code==="MERCHANT_SHOP_PROFILE_CHANGED")throw Error("Profile changed in another session. Refresh before saving.");
  if(code==="MERCHANT_ACCOUNT_WRITES_DISABLED"||code==="MERCHANT_SHOP_WRITES_DISABLED")throw Error("Profile saving is not activated yet. No changes were saved.");
  throw Error("Merchant profile could not be verified or saved ("+code+"). No changes were confirmed.");
 }
 return {uid,body};
};
const account=(v:unknown,uid:string):MerchantAccountProfile=>{
 if(!object(v)||v.merchant_uid!==uid||typeof v.shop_id!=="string"||!integer(v.revision)||
  typeof v.full_name!=="string"||typeof v.phone!=="string"||typeof v.avatar_url!=="string"||
  typeof v.marketing_opt_in!=="boolean"||typeof v.dark_mode!=="boolean")
  throw Error("The API could not verify your account profile.");
 return v as MerchantAccountProfile;
};
const shop=(v:unknown,uid:string,expectedShopId?:string):MerchantShopProfile=>{
 if(!object(v)||v.owner_id!==uid||String(v.id)!==String(expectedShopId??v.id)||
   !integer(v.merchant_profile_revision)||
   typeof v.name!=="string"||typeof v.description!=="string"||typeof v.category!=="string"||
   typeof v.phone!=="string"||typeof v.logo_url!=="string"||
   typeof v.opening_time!=="string"||typeof v.closing_time!=="string")
   throw Error("The API could not verify your storefront profile.");
 return {...v,id:String(v.id)} as MerchantShopProfile;
};
export const MerchantProfileApi={
 async getAccount():Promise<MerchantAccountProfile>{
  const {uid,body}=await request("/profile","GET");
  return account(body.profile,uid);
 },
 async saveAccount(fields:MerchantAccountChange,expected_revision:number):Promise<MerchantAccountProfile>{
  if(!integer(expected_revision))throw Error("Account profile must be loaded before saving.");
  const {uid,body}=await request("/profile","PATCH",{...fields,expected_revision});
  const profile=account(body.profile,uid);
  if(profile.revision!==expected_revision+1 ||
   Object.entries(fields).some(([key,value])=>(profile as unknown as Record<string,unknown>)[key]!==value))
   throw Error("Profile save was not independently confirmed.");
  return profile;
 },
 async getShop(expectedShopId:string|number):Promise<MerchantShopProfile>{
  const {uid,body}=await request("/shop/profile","GET");
  return shop(body.shop,uid,String(expectedShopId));
 },
 async saveShop(fields:MerchantShopChange,shopId:string|number,expected_revision:number):Promise<MerchantShopProfile>{
  if(!integer(expected_revision))throw Error("Storefront profile must be loaded before saving.");
  const {uid,body}=await request("/shop/profile","PATCH",{...fields,shop_id:String(shopId),expected_revision});
  const persisted=shop(body.shop,uid,String(shopId));
  if(persisted.merchant_profile_revision!==expected_revision+1 ||
   Object.entries(fields).some(([key,value])=>(persisted as unknown as Record<string,unknown>)[key]!==value))
   throw Error("Storefront save was not independently confirmed.");
  return persisted;
 },
};
