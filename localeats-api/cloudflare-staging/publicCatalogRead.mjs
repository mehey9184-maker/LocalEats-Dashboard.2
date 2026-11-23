/**
 * CF2 SOURCE-ONLY public catalog contract.
 *
 * No database/client credentials, network fetches or deployment. A repository
 * can be injected by local tests; the published CF1 Worker does NOT inject one.
 * The future real staging adapter MUST enforce database approval/archiving
 * and obtain server-computed effective availability from an isolated database.
 */
const PUBLIC_SHOP_FIELDS = [
  'id', 'name', 'description', 'location', 'category', 'logo_url', 'rating',
  'opening_time', 'closing_time', 'latitude', 'longitude', 'lat', 'lng', 'story',
  'availability_revision', 'availability_override_until'
];
const PUBLIC_MENU_FIELDS = [
  'id', 'shop_id', 'name', 'price', 'description', 'image_url', 'category',
  'is_available', 'popularity_score', 'customizations', 'created_at'
];
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const COORDINATE = /^-?\d+(?:\.\d+)?$/;

export function verifiedShop(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw Error('INVALID_SHOP');
  // Defense in depth. A future live repository must also filter in SQL.
  if (row.approval_status !== 'approved' || row.archived_at !== null) return null;
  if (typeof row.id !== 'string' || !VALID_ID.test(row.id) ||
      typeof row.name !== 'string' || !row.name.trim() ||
      typeof row.is_active !== 'boolean' ||
      typeof row.effective_is_active !== 'boolean' ||
      !Number.isSafeInteger(Number(row.availability_revision)) ||
      row.availability_revision == null) {
    throw Error('SHOP_AUTHORITY_UNVERIFIED');
  }
  const result = {};
  for (const field of PUBLIC_SHOP_FIELDS) {
    if (Object.hasOwn(row, field)) result[field] = row[field];
  }
  // Same authority rule as API's orders/shopAvailability.ts effectiveShop.
  result.stored_is_active = row.is_active;
  result.is_active = row.effective_is_active;
  return result;
}

export function verifiedMenuItem(row, shopId) {
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      typeof row.id !== 'string' || !row.id ||
      String(row.shop_id) !== String(shopId) ||
      typeof row.name !== 'string' || !row.name.trim() ||
      typeof row.price !== 'number' || !Number.isFinite(row.price) ||
      row.price < 0 || typeof row.is_available !== 'boolean') {
    throw Error('MENU_AUTHORITY_UNVERIFIED');
  }
  const result = {};
  for (const field of PUBLIC_MENU_FIELDS) {
    if (Object.hasOwn(row, field)) result[field] = row[field];
  }
  return result;
}

export function distanceKm(aLat, aLng, bLat, bLng) {
  const rad = (angle) => angle * Math.PI / 180;
  const deltaLat = rad(bLat - aLat), deltaLng = rad(bLng - aLng);
  const h = Math.sin(deltaLat/2)**2 +
    Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(deltaLng/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.max(0,h)), Math.sqrt(Math.max(0,1-h)));
}

function validatedGps(url) {
  const latitude = url.searchParams.getAll('lat');
  const longitude = url.searchParams.getAll('lng');
  if (latitude.length !== 1 || longitude.length !== 1 ||
      !COORDINATE.test(latitude[0]) || !COORDINATE.test(longitude[0])) return null;
  const lat=Number(latitude[0]), lng=Number(longitude[0]);
  if (!Number.isFinite(lat) || Math.abs(lat)>90 ||
      !Number.isFinite(lng) || Math.abs(lng)>180) return null;
  return {lat,lng};
}

function normalizeShops(rows) {
  if (!Array.isArray(rows) || rows.length > 5000) throw Error('CATALOG_UNAVAILABLE');
  const approved = [];
  for (const row of rows) {
    const verified = verifiedShop(row);
    if (verified) approved.push(verified);
  }
  return approved;
}

function status(code, body) { return {status:code,body}; }

/**
 * repository (test-only in CF2) interface:
 *  getApprovedShops(), getApprovedShopById(id), getMenuByShopId(id).
 * Test adapters return raw rows with approval_status, archived_at, and
 * server-computed effective_is_active + availability_revision for verification.
 *
 * The future DB adapter must be independent, permission-reviewed and
 * isolated from Production. Never use mock rows as true customer catalog data.
 */
export async function publicCatalogResponse(url, repository) {
  const path = url.pathname;
  if (!repository || typeof repository.getApprovedShops !== 'function' ||
      typeof repository.getApprovedShopById !== 'function' ||
      typeof repository.getMenuByShopId !== 'function') {
    return status(503,{success:false,code:'CLOUDFLARE_API_NOT_MIGRATED'});
  }

  try {
    if (path === '/api/v1/catalog/shops') {
      return status(200,{success:true,shops:normalizeShops(await repository.getApprovedShops())});
    }
    if (path === '/api/v1/catalog/pickup-shops') {
      const gps = validatedGps(url);
      if (!gps) return status(400,{success:false,code:'INVALID_COORDINATES',error:'Your real location is required.'});
      const shops = normalizeShops(await repository.getApprovedShops())
        .flatMap(shop => {
          const lat=shop.lat??shop.latitude,lng=shop.lng??shop.longitude;
          if (typeof lat !== 'number' || typeof lng !== 'number' ||
              !Number.isFinite(lat) || !Number.isFinite(lng) ||
              Math.abs(lat)>90 || Math.abs(lng)>180) return [];
          const distance_km=distanceKm(gps.lat,gps.lng,lat,lng);
          return distance_km<=4 ? [{...shop,distance_km}] : [];
        })
        .sort((a,b)=>a.distance_km-b.distance_km);
      return status(200,{success:true,shops});
    }
    const single = path.match(/^\/api\/v1\/catalog\/shops\/([A-Za-z0-9_-]{1,128})(\/menu)?$/);
    if (single) {
      const id=single[1], shop=verifiedShop(await repository.getApprovedShopById(id));
      if (!shop) return status(404,{success:false,error:'Shop not found'});
      if (!single[2]) return status(200,{success:true,shop});
      const rows=await repository.getMenuByShopId(id);
      if (!Array.isArray(rows) || rows.length > 2000) throw Error('MENU_UNAVAILABLE');
      // Entire response fails closed on invalid or cross-shop prices/ownership.
      return status(200,{success:true,menu_items:rows.map(row=>verifiedMenuItem(row,id))});
    }
    return null; // Not a public-catalog contract route.
  } catch {
    // No internal schema/DB errors or sensitive values in public responses.
    return status(503,{success:false,code:'PUBLIC_CATALOG_UNVERIFIED',error:'Verified shop/menu data is unavailable.'});
  }
}
