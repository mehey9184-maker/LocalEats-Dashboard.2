/**
 * L3-N8C — unmounted, server-verified Merchant ownership adapter.
 * Uses the same shops_with_availability scope as /api/v1/merchant/shop.
 * The Firebase UID must come from the N8B revoked-token-checked verifier.
 * Never use display metadata, client-supplied role/shop IDs or cached browser state.
 */
import type {SupabaseClient} from "@supabase/supabase-js";

export type MerchantShopOwnershipRecord = {
  id?: unknown;
  owner_id?: unknown;
  approval_status?: unknown;
  archived_at?: unknown;
};

export function createApprovedMerchantOwnershipLookup(
  findCurrentShops:(uid:string)=>Promise<unknown>,
): (uid:string)=>Promise<boolean> {
  if (typeof findCurrentShops !== "function") throw Error("MERCHANT_SHOP_LOOKUP_UNCONFIGURED");
  return async uid => {
    if (typeof uid !== "string" || !uid || uid.length > 128 ||
        [...uid].some(c => c === "/" || c === "\\" || c.charCodeAt(0)<32))
      throw Error("INVALID_OWNER_ID");
    const data=await findCurrentShops(uid);
    if (!Array.isArray(data)) throw Error("MERCHANT_OWNERSHIP_RESULT_INVALID");
    if (data.length === 0) return false;
    // Profile admission is an owner-level YES/NO, not selection of the
    // "current shop". An approved owner may legitimately own several shops.
    // Never infer permission to operate a particular shop from this result:
    // every shop mutation must independently check verified owner + shop ID.
    // The server-side adapter below filters to approved, nonarchived shops
    // and requests one qualifying row to avoid an unbounded profile read.
    return data.every(candidate => {
      const row=candidate as MerchantShopOwnershipRecord | null;
      if (!row || typeof row !== "object" || Array.isArray(row)) return false;
      return (typeof row.id === "string" && row.id.length > 0 ||
              typeof row.id === "number" && Number.isFinite(row.id)) &&
        row.owner_id === uid &&
        row.approval_status === "approved" &&
        row.archived_at === null;
    });
  };
}

/** Factory requires an injected API service-role client; never a browser key. */
export function createSupabaseMerchantOwnershipLookup(
  db:Pick<SupabaseClient, "from">,
): (uid:string)=>Promise<boolean> {
  if (!db || typeof db.from !== "function") throw Error("MERCHANT_SHOP_DB_UNCONFIGURED");
  return createApprovedMerchantOwnershipLookup(async uid => {
    const {data,error}=await db.from("shops_with_availability")
      .select("id,owner_id,approval_status,archived_at")
      .eq("owner_id",uid)
      .eq("approval_status","approved")
      .is("archived_at",null)
      .limit(1);
    if (error) throw Error("MERCHANT_OWNERSHIP_DB_UNAVAILABLE");
    return data;
  });
}
