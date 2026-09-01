import { supabase } from "../lib/supabase";
import { Shop, User } from "../types";

export const isValidUUID = (str: string | null | undefined): boolean => {
  if (!str) return false;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidRegex.test(str);
};

// State to hold the API-verified shop ID tied to a specific Firebase UID
type VerifiedOwnershipState = {
  firebaseUid: string | null;
  shopIds: Set<string | number>;
};

let verifiedState: VerifiedOwnershipState = {
  firebaseUid: null,
  shopIds: new Set<string | number>(),
};

export const registerVerifiedShopId = (firebaseUid: string, shopId: string | number) => {
  if (verifiedState.firebaseUid !== firebaseUid) {
    // Reset state if registering for a new user
    verifiedState = {
      firebaseUid,
      shopIds: new Set<string | number>(),
    };
  }
  verifiedState.shopIds.add(String(shopId));
  const numId = Number(shopId);
  if (!isNaN(numId)) {
    verifiedState.shopIds.add(numId);
  }
};

export const clearVerifiedShopOwnership = () => {
  verifiedState = {
    firebaseUid: null,
    shopIds: new Set<string | number>(),
  };
};

/**
 * Returns true ONLY if the API has explicitly verified this merchant owns the shop.
 * All client-side bypasses (localStorage, email matching, shop 18, user_metadata)
 * have been removed per Phase 3 security hardening.
 */
export const isShopOwnedByUser = (shop: Shop, user: User | null): boolean => {
  if (!shop || !user) return false;
  
  // Strict check against API-verified ownership state scoped to the user
  if (verifiedState.firebaseUid === user.id && verifiedState.shopIds.has(String(shop.id))) {
    return true;
  }
  
  // NOTE: We no longer grant ownership based on localStorage, user_metadata, 
  // email matching, or hardcoded IDs like 18.
  return false;
};

export const getOwnedShopIds = async (user: User | null, _currentShops: Shop[]): Promise<(number | string)[]> => {
  if (!user) return [];
  
  // If we have API-verified shops for this user, return them.
  if (verifiedState.firebaseUid === user.id && verifiedState.shopIds.size > 0) {
    return Array.from(verifiedState.shopIds);
  }
  
  // Operational shop selection must fail closed when the API has not verified ownership.
  return [];
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

  return null;
};
