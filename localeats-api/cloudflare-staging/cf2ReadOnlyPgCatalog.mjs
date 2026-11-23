/**
 * CF2-B: Pure, dependency-injected, read-only PostgreSQL catalog boundary.
 *
 * SOURCE/CI ONLY. This file does not open PostgreSQL, import pg, access
 * Hyperdrive, read env vars or run in the deployed CF1 Worker. A future
 * approved non-exposed catalog_cf2 schema and role must be security-tested.
 *
 * Future views (NOT created): catalog_cf2.public_shops / public_menu.
 * Reader role must have scoped SELECT, NOBYPASSRLS and no DML grants.
 */
const SHOP_FIELDS = [
  "approval_status", "archived_at", "effective_is_active",
  "availability_revision", "availability_override_until", "id", "name",
  "description", "location", "category", "logo_url", "rating",
  "opening_time", "closing_time", "is_active", "latitude", "longitude",
  "lat", "lng", "story"
];
const MENU_FIELDS = [
  "id", "shop_id", "name", "price", "description", "image_url",
  "category", "is_available", "popularity_score", "customizations",
  "created_at"
];
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SHOP_LIMIT = 200;
const MENU_LIMIT = 400;
const BYTE_LIMIT = 196608;
function denied() { return new Error("CF2_READER_UNAVAILABLE"); }
function id(value) {
  if (typeof value !== "string" || !VALID_ID.test(value)) throw denied();
  return value;
}
function decimal(value, max, decimals = 2) {
  if (typeof value !== "number" && typeof value !== "string") throw denied();
  const str=String(value);
  const regex = decimals === 2
    ? /^(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?$/
    : /^(?:0|[1-9][0-9]{0,4})(?:\.[0-9]{1,8})?$/;
  if (!regex.test(str)) throw denied();
  const number=Number(str);
  if (!Number.isFinite(number) || number<0 || number>max) throw denied();
  return number;
}
function coordinate(value, limit) {
  if (value == null) return null;
  if (!/^-?(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{1,12})?$/.test(String(value))) throw denied();
  const n=Number(value);
  if (!Number.isFinite(n) || Math.abs(n)>limit) throw denied();
  return n;
}
function selected(row, keys) {
  const out={};
  for(const k of keys) if(Object.hasOwn(row,k)) out[k]=row[k];
  return out;
}
function shop(row) {
  if (!row || typeof row!=="object" || Array.isArray(row) ||
      row.approval_status!=="approved" || row.archived_at!==null ||
      typeof row.id!=="string" || !VALID_ID.test(row.id) ||
      typeof row.name!=="string" || !row.name.trim() ||
      typeof row.is_active!=="boolean" || typeof row.effective_is_active!=="boolean" ||
      row.availability_revision==null ||
      !/^(0|[1-9][0-9]{0,15})$/.test(String(row.availability_revision)) ||
      !Number.isSafeInteger(Number(row.availability_revision))) throw denied();
  const out=selected(row,SHOP_FIELDS);
  out.availability_revision=Number(row.availability_revision);
  for(const [key,limit] of [
    ["lat",90],["latitude",90],["lng",180],["longitude",180]
  ]) if(Object.hasOwn(out,key)) out[key]=coordinate(out[key],limit);
  if(Object.hasOwn(out,"rating") && out.rating!=null) out.rating=decimal(out.rating,5,8);
  return out;
}
function menu(row,shopId) {
  if (!row || typeof row!=="object" || Array.isArray(row) ||
      typeof row.id!=="string" || !VALID_ID.test(row.id) ||
      row.shop_id!==shopId || typeof row.name!=="string" || !row.name.trim() ||
      typeof row.is_available!=="boolean") throw denied();
  const out=selected(row,MENU_FIELDS);
  // PostgreSQL NUMERIC values commonly arrive as strings (e.g. 25.00).
  out.price=decimal(row.price,100000,2);
  if(Object.hasOwn(out,"popularity_score") && out.popularity_score!=null)
    out.popularity_score=decimal(out.popularity_score,100000,8);
  return out;
}

const SHOP_SELECT = SHOP_FIELDS.map(k=>'"'+k+'"').join(", ");
const MENU_SELECT = MENU_FIELDS.map(k=>'"'+k+'"').join(", ");
const QUERIES = Object.freeze({
  shops: "SELECT "+SHOP_SELECT+" FROM catalog_cf2.public_shops WHERE approval_status = 'approved' AND archived_at IS NULL ORDER BY id ASC LIMIT $1",
  oneShop: "SELECT "+SHOP_SELECT+" FROM catalog_cf2.public_shops WHERE id = $1 AND approval_status = 'approved' AND archived_at IS NULL ORDER BY id ASC LIMIT $2",
  menu: "SELECT "+MENU_SELECT+" FROM catalog_cf2.public_menu WHERE shop_id = $1 ORDER BY id ASC LIMIT $2"
});
async function rowsFrom(executeRead, sql, params, max) {
  let result;
  try { result=await executeRead(sql,params); } catch { throw denied(); }
  const rows=result?.rows;
  if(!Array.isArray(rows) || rows.length>max ||
     rows.some(row=>!row || typeof row!=="object" || Array.isArray(row))) throw denied();
  try {
    if(new TextEncoder().encode(JSON.stringify(rows)).byteLength>BYTE_LIMIT) throw denied();
  } catch { throw denied(); }
  return rows;
}

/**
 * executeRead(sql,params) is injected. It must eventually be backed by
 * a separately verified DB read-only role/transaction/Hyperdrive binding.
 */
export function createCF2PgCatalogRepository(executeRead) {
  if(typeof executeRead!=="function") throw denied();
  return Object.freeze({
    async getApprovedShops() {
      const rows=await rowsFrom(executeRead,QUERIES.shops,[SHOP_LIMIT+1],SHOP_LIMIT);
      return rows.map(shop);
    },
    async getApprovedShopById(shopId) {
      id(shopId);
      const rows=await rowsFrom(executeRead,QUERIES.oneShop,[shopId,2],1);
      if(!rows.length) return null;
      if(rows[0].id!==shopId) throw denied();
      return shop(rows[0]);
    },
    async getMenuByShopId(shopId) {
      id(shopId);
      const rows=await rowsFrom(executeRead,QUERIES.menu,[shopId,MENU_LIMIT+1],MENU_LIMIT);
      return rows.map(row=>menu(row,shopId));
    }
  });
}
