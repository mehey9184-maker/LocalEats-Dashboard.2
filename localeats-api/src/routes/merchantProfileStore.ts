import type {SupabaseClient} from "@supabase/supabase-js";
import type {MerchantAccountFields,MerchantShopFields} from "./merchantProfileContract.js";

export type MerchantAccountRow=MerchantAccountFields & {
 merchant_uid:string;shop_id:string;revision:number;
};
export type MerchantShopRow=MerchantShopFields & {
 id:string;owner_id:string;merchant_profile_revision:number;
};
export type OwnedMerchantShop={id:string;owner_id:string};

export interface MerchantProfileStore {
 ownedShop(uid:string):Promise<OwnedMerchantShop|null>;
 readAccount(uid:string):Promise<MerchantAccountRow|null>;
 writeAccount(uid:string,shopId:string,revision:number,changes:Partial<MerchantAccountFields>,create:boolean):Promise<MerchantAccountRow|null>;
 readShop(uid:string,shopId:string):Promise<MerchantShopRow|null>;
 writeShop(uid:string,shopId:string,revision:number,changes:Partial<MerchantShopFields>):Promise<MerchantShopRow|null>;
}

export const ACCOUNT_SELECT="merchant_uid,shop_id,revision,full_name,phone,avatar_url,marketing_opt_in,dark_mode";
export const SHOP_SELECT="id,owner_id,merchant_profile_revision,name,description,category,phone,logo_url,opening_time,closing_time";
export const initialAccount=(uid:string,shopId:string):MerchantAccountRow=>({
 merchant_uid:uid,shop_id:shopId,revision:0,
 full_name:"",phone:"",avatar_url:"",marketing_opt_in:true,dark_mode:false,
});

/**
 * Server-side service-role adapter ONLY. Firebase IDs cannot be used as Supabase
 * auth.uid(); ownership is rechecked explicitly on every API request.
 * The public browser must never import this file or possess the service key.
 */
export class SupabaseMerchantProfileStore implements MerchantProfileStore {
 constructor(private readonly db:Pick<SupabaseClient,"from">){}
 private normalizeShop(data:Record<string,unknown>):MerchantShopRow{
  const string=(value:unknown)=>typeof value==="string"?value:"";
  return {...data,id:String(data.id),owner_id:String(data.owner_id),
   description:string(data.description),phone:string(data.phone),logo_url:string(data.logo_url),
   opening_time:string(data.opening_time),closing_time:string(data.closing_time)} as MerchantShopRow;
 }
 async ownedShop(uid:string):Promise<OwnedMerchantShop|null>{
  const {data,error}=await this.db.from("shops").select("id,owner_id").eq("owner_id",uid).is("archived_at",null).limit(2);
  if(error)throw error;
  if(!Array.isArray(data))throw Error("SHOP_OWNERSHIP_UNAVAILABLE");
  if(data.length>1)throw Error("MULTIPLE_ACTIVE_SHOPS");
  const row=data[0];
  if(!row)return null;
  if(row.owner_id!==uid || row.id==null)throw Error("SHOP_OWNERSHIP_UNCONFIRMED");
  return {id:String(row.id),owner_id:uid};
 }
 async readAccount(uid:string):Promise<MerchantAccountRow|null>{
  const {data,error}=await this.db.from("merchant_profiles").select(ACCOUNT_SELECT).eq("merchant_uid",uid).maybeSingle();
  if(error)throw error;
  return data ? data as MerchantAccountRow : null;
 }
 async writeAccount(uid:string,shopId:string,revision:number,changes:Partial<MerchantAccountFields>,create:boolean):Promise<MerchantAccountRow|null>{
  const dataToWrite={...changes,revision:revision+1,updated_at:new Date().toISOString()};
  const query=create
   ? this.db.from("merchant_profiles").insert({merchant_uid:uid,shop_id:shopId,...dataToWrite})
   : this.db.from("merchant_profiles").update(dataToWrite).eq("merchant_uid",uid).eq("shop_id",shopId).eq("revision",revision);
  const {data,error}=await query.select(ACCOUNT_SELECT).maybeSingle();
  if(error){if(error.code==="23505")return null;throw error;}
  return data ? data as MerchantAccountRow : null;
 }
 async readShop(uid:string,shopId:string):Promise<MerchantShopRow|null>{
  const {data,error}=await this.db.from("shops").select(SHOP_SELECT)
   .eq("id",shopId).eq("owner_id",uid).is("archived_at",null).maybeSingle();
  if(error)throw error;
  return data ? this.normalizeShop(data) : null;
 }
 async writeShop(uid:string,shopId:string,revision:number,changes:Partial<MerchantShopFields>):Promise<MerchantShopRow|null>{
  const {data,error}=await this.db.from("shops")
   .update({...changes,merchant_profile_revision:revision+1})
   .eq("id",shopId).eq("owner_id",uid).eq("merchant_profile_revision",revision).is("archived_at",null)
   .select(SHOP_SELECT).maybeSingle();
  if(error)throw error;
  return data ? this.normalizeShop(data) : null;
 }
}
