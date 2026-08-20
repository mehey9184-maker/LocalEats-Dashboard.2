import { supabase } from "../lib/supabase";
import { Shop, User } from "../types";
import { MY_KOTA_SHOP, FALLBACK_SHOPS } from "../constants";

export const isValidUUID = (str: string | null | undefined): boolean => {
  if (!str) return false;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidRegex.test(str);
};

export const isShopOwnedByUser = (shop: Shop, user: User | null): boolean => {
  if (!shop) return false;

  // 1. Permanent Vendor Identifier in Supabase Auth user_metadata (Highest Priority)
  if (user?.user_metadata?.vendor_shop_id && String(shop.id) === String(user.user_metadata.vendor_shop_id)) {
    return true;
  }
  if (user?.user_metadata?.shop_id && String(shop.id) === String(user.user_metadata.shop_id)) {
    return true;
  }

  // 2. Permanent Vendor Identifier in LocalStorage
  try {
    const vendorShopId = localStorage.getItem("localeats_vendor_shop_id");
    if (vendorShopId && String(shop.id) === String(vendorShopId)) return true;
  } catch {
    // ignore
  }

  // 3. Database direct owner matching
  if (user && shop.owner_id === user.id) return true;

  // 4. Vendor Email matching
  if (user?.email && shop.email && (shop as unknown as { email?: string }).email?.toLowerCase().trim() === user.email.toLowerCase().trim()) return true;

  // 5. Default single-vendor shop fallback ("My-Kota" / shop ID 18)
  if (user && (Number(shop.id) === 18 || (shop.name && shop.name.toLowerCase().includes("kota")))) return true;

  // 6. Local cache shop ID fallback
  try {
    const savedShopId = localStorage.getItem("localeats_my_shop_id");
    if (savedShopId && String(shop.id) === String(savedShopId)) return true;
    const lastShopId = localStorage.getItem("localeats_last_selected_shop_id");
    if (lastShopId && String(shop.id) === String(lastShopId)) return true;
  } catch {
    // ignore
  }

  return false;
};

export const getOwnedShopIds = async (user: User | null, currentShops: Shop[]): Promise<(number | string)[]> => {
  if (!user) return [];
  const idsSet = new Set<number | string>();

  // 1. Highest Priority: Permanent Identifiers in user_metadata & localStorage
  if (user.user_metadata?.vendor_shop_id) {
    idsSet.add(user.user_metadata.vendor_shop_id);
  }
  if (user.user_metadata?.shop_id) {
    idsSet.add(user.user_metadata.shop_id);
  }
  try {
    const vendorShopId = localStorage.getItem("localeats_vendor_shop_id");
    if (vendorShopId) idsSet.add(isNaN(Number(vendorShopId)) ? vendorShopId : Number(vendorShopId));
  } catch {
    // ignore
  }

  // 2. From current shops in React state
  currentShops.filter((s) => isShopOwnedByUser(s, user)).forEach((s) => idsSet.add(s.id));

  // 3. Query Supabase shops safely with table accessibility & column existence checks
  try {
    // Verify table accessibility before querying
    const { error: accessErr } = await supabase.from("shops").select("id").limit(1);
    if (!accessErr) {
      if (isValidUUID(user.id)) {
        let orQuery = `owner_id.eq.${user.id}`;
        if (user.email) {
          orQuery += `,email.ilike.${user.email.trim()}`;
        }
        const { data: ownedShops, error: queryErr } = await supabase
          .from("shops")
          .select("id, owner_id, email")
          .or(orQuery);

        if (!queryErr && ownedShops) {
          ownedShops.forEach((s) => idsSet.add(s.id));
        } else if (queryErr && (queryErr.code === "42703" || queryErr.message?.includes("column"))) {
          // Column owner_id or email might be missing in schema; fallback safely
          if (user.email) {
            const { data: ownedByEmail } = await supabase
              .from("shops")
              .select("id")
              .ilike("email", user.email.trim());
            ownedByEmail?.forEach((s) => idsSet.add(s.id));
          }
        }
      } else if (user.email) {
        const { data: ownedShops } = await supabase
          .from("shops")
          .select("id, email")
          .ilike("email", user.email.trim());
        ownedShops?.forEach((s) => idsSet.add(s.id));
      }
    } else {
      console.debug("[Shop Ownership Sync] Shops table inaccessible or unconfigured:", accessErr.message);
    }
  } catch (err) {
    console.debug("[Shop Ownership Sync] Exception during ownership query, falling back to cache:", err);
  }

  // 4. From cached shops in localStorage
  try {
    const cachedShops = JSON.parse(localStorage.getItem("localeats_cached_shops") || "[]");
    if (Array.isArray(cachedShops)) {
      cachedShops.filter((s: Shop) => isShopOwnedByUser(s, user)).forEach((s: Shop) => idsSet.add(s.id));
    }
  } catch {
    // ignore
  }

  // 5. From explicit local storage shop IDs
  try {
    const savedShopId = localStorage.getItem("localeats_my_shop_id");
    if (savedShopId && !isNaN(Number(savedShopId))) idsSet.add(Number(savedShopId));
    const lastShopId = localStorage.getItem("localeats_last_selected_shop_id");
    if (lastShopId && !isNaN(Number(lastShopId))) idsSet.add(Number(lastShopId));
  } catch {
    // ignore
  }

  // Expand both string and numeric types so Firestore / Supabase queries match seamlessly
  const expanded = new Set<number | string>();
  idsSet.forEach((id) => {
    expanded.add(id);
    const num = Number(id);
    if (!isNaN(num)) {
      expanded.add(num);
      expanded.add(String(num));
    }
  });

  // Default fallback if empty: include default shop 18 and current first shop
  if (expanded.size === 0) {
    expanded.add(18);
    expanded.add("18");
    if (currentShops.length > 0) {
      expanded.add(currentShops[0].id);
      expanded.add(String(currentShops[0].id));
    }
  }

  return Array.from(expanded);
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
    if (error) {
      console.debug(`[Shop Discovery] Notice fetching shop ${shopId}:`, error.message || error);
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
