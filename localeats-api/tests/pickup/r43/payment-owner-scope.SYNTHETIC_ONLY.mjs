/**
 * R4.3 isolated CONTRACT MODEL, not a deployed API and not wired into runtime.
 * The real future API must use Firebase Admin verified UID with revocation checks,
 * an authoritative ownership query, and a documented legacy bigint shop mapping.
 * Nothing here uses Firebase, Supabase, network or actual payment records.
 */
export class R43ScopeError extends Error {
  constructor(status, code) { super(code); this.status=status; this.code=code; }
}
const fail=(status,code)=>{throw new R43ScopeError(status,code);};
const canonicalBigint=(value)=>{
  if(typeof value!=="string" || !/^[1-9][0-9]*$/.test(value) || value.length>16)
    fail(409,"LEGACY_SHOP_MAPPING_NOT_VERIFIED");
  const numeric=Number(value);
  if(!Number.isSafeInteger(numeric)||numeric<=0||String(numeric)!==value)
    fail(409,"LEGACY_SHOP_MAPPING_NOT_VERIFIED");
  return numeric;
};
export function createSyntheticPaymentReader({verifyFirebase,activeOwnedShops,legacyPaymentsByShopId}) {
  if([verifyFirebase,activeOwnedShops,legacyPaymentsByShopId].some(fn=>typeof fn!=="function"))
    throw Error("R43_TEST_DEPENDENCY_MISSING");
  return async function read({authorization,query={}}={}) {
    // The caller cannot send any shop id, role, user id, limit or financial status.
    if(!query || Object.keys(query).length) fail(400,"CLIENT_PAYMENT_SCOPE_FORBIDDEN");
    if(typeof authorization!=="string"||!authorization.startsWith("Bearer fb-")
      ||authorization.length<13) fail(401,"FIREBASE_AUTH_REQUIRED");
    let principal;
    try {
      principal=await verifyFirebase(authorization.slice("Bearer fb-".length),true);
    } catch { fail(401,"FIREBASE_AUTH_REQUIRED"); }
    if(!principal||typeof principal.uid!=="string"||!principal.uid.trim()
      ||principal.isAnonymous) fail(401,"FIREBASE_AUTH_REQUIRED");
    let shops;
    try { shops=await activeOwnedShops(principal.uid); }
    catch { fail(503,"OWNER_LOOKUP_UNAVAILABLE"); }
    if(!Array.isArray(shops)) fail(503,"OWNER_LOOKUP_UNAVAILABLE");
    if(!shops.length) fail(403,"NO_ACTIVE_OWNED_SHOP");
    if(shops.length!==1) fail(409,"AMBIGUOUS_SHOP_OWNER");
    const shop=shops[0];
    if(!shop||shop.owner_id!==principal.uid||shop.archived_at!==null
      ||shop.approval_status!=="approved")
      fail(403,"UNVERIFIED_SHOP_OWNER");
    const legacyId=canonicalBigint(shop.id);
    let rows;
    try { rows=await legacyPaymentsByShopId(legacyId); }
    catch { fail(503,"PAYMENT_READ_UNAVAILABLE"); }
    if(!Array.isArray(rows)) fail(503,"PAYMENT_READ_UNAVAILABLE");
    const safe=[];
    for(const row of rows) {
      if(!row||String(row.shop_id)!==String(legacyId) ||
        typeof row.id!=="string" || typeof row.status!=="string" ||
        typeof row.payment_method!=="string" || !Number.isFinite(Number(row.amount))) {
        fail(503,"PAYMENT_SCOPE_INTEGRITY_FAILURE");
      }
      // Explicit allowlist: never leak internal rows, unrelated metadata or token data.
      safe.push({id:row.id,amount:row.amount,status:row.status,
        payment_method:row.payment_method,payment_date:row.payment_date??null});
    }
    return {success:true,payments:safe};
  };
}
