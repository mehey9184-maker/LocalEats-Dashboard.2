import { supabase } from "../lib/supabase";
import { Shop, User } from "../types";
import { MY_KOTA_SHOP, FALLBACK_SHOPS } from "../constants";

export const isValidUUID = (str: string | null | undefined): boolean => {
  if (!str) return false;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidRegex.test(str);
};

// State to hold the API-verified shop ID
let verifiedOwnedShopIds = new Set<string | number>();

export const registerVerifiedShopId = (shopId: string | number) => {
  verifiedOwnedShopIds.add(String(shopId));
  const numId = Number(shopId);
  if (!isNaN(numId)) {
    verifiedOwnedShopIds.add(numId);
  }
};

/**
 * Returns true ONLY if the API has explicitly verified this merchant owns the shop.
 * All client-side bypasses (localStorage, email matching, shop 18, user_metadata)
 * have been removed per Phase 3 security hardening.
 */
export const isShopOwnedByUser = (shop: Shop, user: User | null): boolean => {
  if (!shop || !user) return false;
  
  // Strict check against API-verified ownership state
  if (verifiedOwnedShopIds.has(String(shop.id))) {
    return true;
  }
  
  // NOTE: We no longer grant ownership based on localStorage, user_metadata, 
  // email matching, or hardcoded IDs like 18.
  return false;
};

/**
 * Temporarily returns "hint" shop IDs for UI and diagnostic rendering during migration.
 * These are NOT authoritative and will not pass isShopOwnedByUser() unless confirmed by API.
 */
export const getLegacyHintShopIds = (user: User | null): (number | string)[] => {
  if (!user) return [];
  const hints = new Set<number | string>();
  
  try {
    const v = localStorage.getItem("localeats_vendor_shop_id");
    if (v) hints.add(v);
    const m = localStorage.getItem("localeats_my_shop_id");
    if (m) hints.add(m);
    const l = localStorage.getItem("localeats_last_selected_shop_id");
    if (l) hints.add(l);
  } catch {
    // ignore
  }
  
  if (user.user_metadata?.vendor_shop_id) hints.add(user.user_metadata.vendor_shop_id);
  if (user.user_metadata?.shop_id) hints.add(user.user_metadata.shop_id);
  
  // Also include the legacy default just as a UI hint so the UI doesn't crash during transition
  hints.add(18);
  hints.add("18");
  
  // Deduplicate and expand
  const expanded = new Set<number | string>();
  hints.forEach(id => {
    expanded.add(id);
    const num = Number(id);
    if (!isNaN(num)) expanded.add(num);
  });
  
  return Array.from(expanded);
};

export const getOwnedShopIds = async (user: User | null, currentShops: Shop[]): Promise<(number | string)[]> => {
  if (!user) return [];
  
  // If we have API-verified shops, return them.
  if (verifiedOwnedShopIds.size > 0) {
    return Array.from(verifiedOwnedShopIds);
  }
  
  // Fallback to hint IDs during transition so the Firestore listeners don't break,
  // but note that these IDs are NOT granted authoritative ownership in isShopOwnedByUser.
  return getLegacyHintShopIds(user);
};

export const fetchShopById = async (
  shopId: number | string,
  existingShops: Shop[] = []
): Promise<Shop | null> => {
  if (!shopId) return null;
  const numId = typeof shopId === "number" ? shopId : Number(shopId);

  // 1. Attempt fetching shop from Supabase with detailed error handling
  try {
    const { data, error } = await supabase
      .from("shops")
      .select("*")
      .eq("id", shopId)
      .maybeSingle();

    if (!error && data) {
      return data as Shop;
    }
  } catch (err) {
    console.debug(`[Shop Discovery] Network error fetching shop ${shopId}:`, err);
  }

  // 2. Fallback to existing shops in React state
  const stateMatch = existingShops.find(
    (s) => String(s.id) === String(shopId) || (!isNaN(numId) && Number(s.id) === numId)
  );
  if (stateMatch) return stateMatch;

  // 3. Fallback to cached local storage shops
  try {
    const cachedStr = localStorage.getItem("localeats_cached_shops");
    if (cachedStr) {
      const cachedList: Shop[] = JSON.parse(cachedStr);
      if (Array.isArray(cachedList)) {
        const cachedMatch = cachedList.find(
          (s) => String(s.id) === String(shopId) || (!isNaN(numId) && Number(s.id) === numId)
        );
        if (cachedMatch) return cachedMatch;
      }
    }
  } catch {
    // ignore
  }

  // 4. Fallback for default MY_KOTA_SHOP
  if (String(shopId) === "18" || numId === 18) {
    return MY_KOTA_SHOP;
  }

  // 5. Fallback to first available shop in FALLBACK_SHOPS if matching
  if (FALLBACK_SHOPS.length > 0) {
    const fallbackMatch = FALLBACK_SHOPS.find(
      (s) => String(s.id) === String(shopId) || (!isNaN(numId) && Number(s.id) === numId)
    );
    if (fallbackMatch) return fallbackMatch;
  }

  return null;
};

