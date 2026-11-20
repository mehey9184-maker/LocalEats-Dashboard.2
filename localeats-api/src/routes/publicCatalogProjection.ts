/**
 * L3-N8L — explicit public-data projection at the API response boundary.
 *
 * The Supabase service-role reader can see more fields than public clients.
 * A .select(...) allowlist prevents most accidental reads, but a mock,
 * view change or injected repository must NEVER leak extra columns via
 * {...shop} or raw menu item responses.
 *
 * Only flat user-facing primitive facts are exposed. Browser clients do
 * not receive owner IDs, owner contacts, approval state, revision internals,
 * private tokens, full user profiles, secrets, or arbitrary nested metadata.
 */
const SHOP_FIELDS = [
  "id","name","description","location","category","logo_url",
  "rating","opening_time","closing_time","is_active",
  "latitude","longitude","lat","lng","story",
] as const;
const MENU_FIELDS = [
  "id","shop_id","name","price","description","image_url",
  "category","is_available",
] as const;

type PlainRecord=Record<string,unknown>;
const flat = (source:PlainRecord, fields:readonly string[]):PlainRecord => {
  const result:PlainRecord=Object.create(null) as PlainRecord;
  for(const field of fields){
    const value=source[field];
    if(typeof value==="string" && value.length<=8192)result[field]=value;
    else if(typeof value==="number" && Number.isFinite(value))result[field]=value;
    else if(typeof value==="boolean")result[field]=value;
  }
  return result;
};

export const projectPublicCatalogShop=(record:PlainRecord):PlainRecord =>
  flat(record,SHOP_FIELDS);

export const projectPublicCatalogMenuItem=(record:PlainRecord):PlainRecord =>
  flat(record,MENU_FIELDS);

export const publicCatalogShopFields=Object.freeze([...SHOP_FIELDS]);
export const publicCatalogMenuFields=Object.freeze([...MENU_FIELDS]);
