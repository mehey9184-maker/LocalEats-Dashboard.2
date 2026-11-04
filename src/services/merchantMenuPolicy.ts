export function validateMerchantMenu(rows: unknown[], shopId: string | number): Record<string,unknown>[] {
 const items = new Map<string, Record<string,unknown>>();
 for (const candidate of rows) {
  if(!candidate || typeof candidate!=="object" || Array.isArray(candidate))
   throw new Error("The API returned invalid menu data.");
  const row=candidate as Record<string,unknown>;
  if(row.id == null || String(row.shop_id) !== String(shopId) || typeof row.name !== "string" ||
    typeof row.price !== "number" || !Number.isFinite(row.price) || row.price < 0 ||
    typeof row.is_available !== "boolean") throw new Error("The API returned invalid menu data.");
  const key = String(row.id);
  if (items.has(key) && JSON.stringify(items.get(key)) !== JSON.stringify(row)) throw new Error("The API returned conflicting menu items.");
  items.set(key, row);
 }
 return [...items.values()];
}
export function menuWritesUnavailable(): boolean {
 return true; // No authoritative merchant menu-write contract is deployed.
}

/** Menu catalog reads do not currently include authoritative stock quantities.
 * Unknown/null values must not be presented as unlimited or out of stock.
 */
export function merchantMenuStockKnown(stock:unknown):stock is number {
 return typeof stock==="number" && Number.isSafeInteger(stock) && (stock===-1 || stock>=0);
}
export function merchantMenuStockLabel(stock:unknown):string {
 if(!merchantMenuStockKnown(stock))return "Stock tracking unavailable";
 return stock===-1 ? "Stock: Unlimited" : `Stock: ${stock}`;
}
export function merchantMenuLowStock(stock:unknown):boolean {
 return merchantMenuStockKnown(stock) && stock>=0 && stock<5;
}
export function merchantMenuOutOfStock(stock:unknown):boolean {
 return merchantMenuStockKnown(stock) && stock===0;
}


/** Only advertise categories actually present in the verified shop menu. */
export function merchantMenuCategoryName(value:unknown):string {
 return typeof value==="string" && value.trim() ? value.trim() : "General";
}
export function merchantMenuCategories(rows:readonly {category?:unknown}[]):string[] {
 const found=new Map<string,string>();
 for(const row of rows) {
  const category=merchantMenuCategoryName(row?.category);
  const key=category.toLocaleLowerCase("en-ZA");
  if(key!=="all" && !found.has(key))found.set(key,category);
 }
 return ["All",...Array.from(found.values()).sort((a,b)=>a.localeCompare(b,"en-ZA",{sensitivity:"base"}))];
}
export function merchantMenuMatchesCategory(category:unknown,selected:string):boolean {
 return selected==="All" || merchantMenuCategoryName(category).toLocaleLowerCase("en-ZA")===selected.toLocaleLowerCase("en-ZA");
}
export function merchantMenuFiltersActive(query:string,category:string):boolean {
 return query.trim().length>0 || category!=="All";
}

/** A bounded step keeps the original card grid usable for large menus. */
export const MERCHANT_MENU_PAGE_SIZE=24;
export function merchantMenuNextVisibleCount(current:number,total:number):number {
 const max=Number.isSafeInteger(total) && total>0 ? total : 0;
 const shown=Number.isSafeInteger(current) && current>0 ? current : 0;
 return Math.min(max,shown+MERCHANT_MENU_PAGE_SIZE);
}
