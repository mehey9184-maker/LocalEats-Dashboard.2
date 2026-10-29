export function validateMerchantMenu(rows: any[], shopId: string | number): any[] {
 const items = new Map<string, any>();
 for (const row of rows) {
  if (!row || row.id == null || String(row.shop_id) !== String(shopId) || typeof row.name !== "string" || typeof row.price !== "number" || !Number.isFinite(row.price) || row.price < 0 || typeof row.is_available !== "boolean") throw new Error("The API returned invalid menu data.");
  const key = String(row.id);
  if (items.has(key) && JSON.stringify(items.get(key)) !== JSON.stringify(row)) throw new Error("The API returned conflicting menu items.");
  items.set(key, row);
 }
 return [...items.values()];
}
export function menuWritesUnavailable(): boolean {
 return true; // No authoritative merchant menu-write contract is deployed.
}
