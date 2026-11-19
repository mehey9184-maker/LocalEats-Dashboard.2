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
export function menuWritesUnavailable():boolean {
 return true; // No authoritative merchant menu-write contract is deployed.
}
