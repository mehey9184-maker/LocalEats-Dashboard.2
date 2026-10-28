import {createHash} from "node:crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import {OrderContractError,parseCreateOrderInput,assertShopCanAcceptOrder,calculateAuthoritativePrice,calculateDistanceKm,
 type ShopForOrder,type MenuItemForOrder} from "./orderContract.js";

export const isPickupPilotShop=(location:unknown):boolean=>typeof location==="string" && /\b(?:tembisa|thembisa|ivory\s+park)\b/i.test(location);
const fail=(status:number,code:string):never=>{throw new OrderContractError(status,code,code);};
const object=(value:unknown):Record<string,unknown>=>{
 if(!value || typeof value!=="object" || Array.isArray(value))return fail(400,"INVALID_REQUEST");
 return value as Record<string,unknown>;
};
const onlyKeys=(body:Record<string,unknown>,keys:string[])=>{
 if(Object.keys(body).some(key=>!keys.includes(key)))fail(400,"UNSUPPORTED_INPUT");
};
// Identical canonical serialization to the tested pickup quote fingerprint; no creation/command code is imported.
const canonical=(value:unknown):string=>{
 if(value===null || typeof value==="string" || typeof value==="boolean")return JSON.stringify(value);
 if(typeof value==="number" && Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
 if(value && typeof value==="object" && Object.getPrototypeOf(value)===Object.prototype){
  const record=value as Record<string,unknown>;
  return `{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
 }
 return fail(400,"INVALID_CANONICAL_INPUT");
};
type PickupShop=ShopForOrder & {location:unknown;archived_at:unknown};
export interface PickupReadRepository {
 findShop(id:string):Promise<PickupShop|null>;
 findMenuItems(shop:string,ids:string[]):Promise<MenuItemForOrder[]>;
}
export class SupabasePickupReadRepository implements PickupReadRepository {
 constructor(private client:SupabaseClient){}
 async findShop(id:string):Promise<PickupShop|null>{
  const {data,error}=await this.client.from("shops").select("id,name,is_active,approval_status,archived_at,location,latitude,longitude,lat,lng").eq("id",id).maybeSingle();
  if(error)return fail(503,"DATABASE_UNAVAILABLE");return data as PickupShop|null;
 }
 async findMenuItems(shop:string,ids:string[]):Promise<MenuItemForOrder[]>{
  const {data,error}=await this.client.from("menu_items").select("id,shop_id,name,price,is_available").eq("shop_id",shop).in("id",ids);
  if(error)return fail(503,"DATABASE_UNAVAILABLE");return data ?? [];
 }
}
export async function pickupReadQuote(repository:PickupReadRepository,uid:string,raw:unknown){
 if(!uid)return fail(401,"UNAUTHORIZED");
 const body=object(raw);
 if(body.contract_version!=="pickup-v1")return fail(426,"PICKUP_CONTRACT_REQUIRED");
 onlyKeys(body,["contract_version","idempotency_key","shop_id","items","delivery_type","delivery_schedule_mode","tip_amount","payment_method","customer_details","launch_location"]);
 if(Array.isArray(body.items))for(const item of body.items)onlyKeys(object(item),["menu_item_id","quantity","notes"]);
 onlyKeys(object(body.customer_details),["name","phone","email","address","city","delivery_instructions"]);
 const input=parseCreateOrderInput(body);
 if(input.delivery_type!=="collection" || input.tip_amount!==0 || !["cash","card_machine"].includes(input.payment_method))return fail(422,"PICKUP_ONLY");
 if(!/^\+?[0-9 ()-]{9,20}$/.test(input.customer_details.phone))return fail(400,"INVALID_CUSTOMER_PHONE");
 const location=object(body.launch_location);onlyKeys(location,["lat","lng"]);
 if(typeof location.lat!=="number" || !Number.isFinite(location.lat) || Math.abs(location.lat)>90 || typeof location.lng!=="number" || !Number.isFinite(location.lng) || Math.abs(location.lng)>180)return fail(400,"INVALID_COORDINATES");
 const shop=await repository.findShop(input.shop_id);
 if(!shop)return fail(404,"SHOP_NOT_FOUND");
 if(shop.archived_at!==null)return fail(409,"SHOP_UNAVAILABLE");
 assertShopCanAcceptOrder(shop,input);
 if(!isPickupPilotShop(shop.location))return fail(422,"OUTSIDE_PICKUP_PILOT");
 const lat=shop.lat ?? shop.latitude,lng=shop.lng ?? shop.longitude;
 if(typeof lat!=="number" || !Number.isFinite(lat) || Math.abs(lat)>90 || typeof lng!=="number" || !Number.isFinite(lng) || Math.abs(lng)>180)return fail(409,"SHOP_LOCATION_UNAVAILABLE");
 if(calculateDistanceKm(lat,lng,location.lat,location.lng)>4)return fail(422,"OUTSIDE_PICKUP_RADIUS");
 const menu=await repository.findMenuItems(input.shop_id,input.items.map(line=>line.menu_item_id));
 for(const item of menu){
  if((typeof item.price!=="number" && typeof item.price!=="string") || String(item.price).trim()==="" ||
    !Number.isFinite(Number(item.price)) || Number(item.price)<0 || !Number.isSafeInteger(Math.round(Number(item.price)*100)))return fail(503,"INVALID_SERVER_PRICE");
 }
 const pricing=calculateAuthoritativePrice(input,menu);
 const quote={currency:"ZAR" as const,lines:pricing.lines.map(line=>({menu_item_id:line.menu_item_id,name:line.name,unit_minor:Math.round(line.unit_price*100),quantity:line.quantity,line_minor:Math.round(line.line_total*100)})),
  subtotal_minor:Math.round(pricing.subtotal*100),service_fee_minor:Math.round(pricing.service_fee*100),delivery_fee_minor:0,discount_minor:0,tip_minor:0,total_minor:Math.round(pricing.total_price*100)};
 if(!Number.isSafeInteger(quote.total_minor) || quote.total_minor<0)return fail(503,"INVALID_SERVER_PRICE");
 return {...quote,pricing_fingerprint:createHash("sha256").update(canonical(quote)).digest("hex")};
}
