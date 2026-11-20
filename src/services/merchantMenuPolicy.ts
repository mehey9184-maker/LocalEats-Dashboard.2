import type {MenuItem} from "../types";
// Keep the API's item type while validating the minimum server-owned menu
// facts and the exact merchant shop boundary. Never invent stock or prices.
export function validateMerchantMenu<T>(rows:T[],shopId:string|number):T[]{
 const items=new Map<string,T>();
 for(const raw of rows){
  if(!raw || typeof raw!=="object" || Array.isArray(raw))throw new Error("The API returned invalid menu data.");
  const row=raw as Record<string,unknown>;
  if(row.id==null || String(row.shop_id)!==String(shopId) || typeof row.name!=="string" ||
    typeof row.price!=="number" || !Number.isFinite(row.price) || row.price<0 ||
    typeof row.is_available!=="boolean")throw new Error("The API returned invalid menu data.");
  const key=String(row.id);
  if(items.has(key) && JSON.stringify(items.get(key))!==JSON.stringify(raw))throw new Error("The API returned conflicting menu items.");
  items.set(key,raw);
 }
 return [...items.values()];
}

// Convert an untrusted API menu to the typed Merchant presentation contract.
// Preserve server-owned ID/price/availability and all additional catalogue fields;
// a null/missing photo is represented as no image, never a fabricated product.
export function validateMerchantMenuForDisplay(rows:unknown[],shopId:string|number):MenuItem[]{
 const validated=validateMerchantMenu(rows,shopId);
 return validated.map(raw=>{
  if(raw===null || typeof raw!=="object" || Array.isArray(raw))
   throw new Error("The API returned invalid menu data.");
  const item=raw as Record<string,unknown>;
  if((typeof item.id!=="string" && typeof item.id!=="number") ||
     (typeof item.shop_id!=="string" && typeof item.shop_id!=="number") ||
     typeof item.name!=="string" || typeof item.price!=="number" ||
     typeof item.is_available!=="boolean" || typeof item.created_at!=="string" ||
     (item.image_url!=null && typeof item.image_url!=="string") ||
     (item.category!=null && typeof item.category!=="string") ||
     (item.description!=null && typeof item.description!=="string") ||
     (item.updated_at!=null && typeof item.updated_at!=="string") ||
     (item.stock_quantity!=null && (typeof item.stock_quantity!=="number" || !Number.isFinite(item.stock_quantity))) ||
     (item.is_unlimited!=null && typeof item.is_unlimited!=="boolean") ||
     (item.dietary_tags!=null && (!Array.isArray(item.dietary_tags) || !item.dietary_tags.every(tag=>typeof tag==="string"))))
   throw new Error("The API returned invalid menu data.");
  return {
   ...item,id:item.id,shop_id:item.shop_id,name:item.name,price:item.price,
   image_url:typeof item.image_url==="string"?item.image_url:"",
   is_available:item.is_available,created_at:item.created_at,
   category:typeof item.category==="string"?item.category:undefined,
   description:typeof item.description==="string"?item.description:undefined,
   updated_at:typeof item.updated_at==="string"?item.updated_at:undefined,
   stock_quantity:typeof item.stock_quantity==="number"?item.stock_quantity:null,
   is_unlimited:typeof item.is_unlimited==="boolean"?item.is_unlimited:undefined,
   dietary_tags:Array.isArray(item.dietary_tags)?item.dietary_tags as string[]:undefined
  };
 });
}

export function menuWritesUnavailable():boolean {
 return true; // No authoritative merchant menu-write contract is deployed.
}
