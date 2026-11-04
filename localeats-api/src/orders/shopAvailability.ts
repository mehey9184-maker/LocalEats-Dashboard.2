// Only the database's shared effective-availability calculation may establish status.
export function effectiveShop<T extends Record<string, any>>(shop:T):T {
 if (typeof shop.effective_is_active !== "boolean" || shop.availability_revision == null || !Number.isSafeInteger(Number(shop.availability_revision)))
  throw new Error("AVAILABILITY_SCHEMA_UNAVAILABLE");
 return {...shop, stored_is_active:shop.is_active, is_active:shop.effective_is_active};
}
