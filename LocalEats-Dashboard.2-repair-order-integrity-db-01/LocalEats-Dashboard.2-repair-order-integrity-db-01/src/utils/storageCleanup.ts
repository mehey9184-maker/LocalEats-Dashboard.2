// Storage Cleanup & Maintenance Utility
// Clears stale caches and temporary tokens while preserving critical user-specific shop settings and auth session tokens.

export interface StorageCleanupResult {
  clearedKeys: string[];
  preservedKeys: string[];
}

export const cleanLocalStorageCache = (): StorageCleanupResult => {
  if (typeof window === "undefined" || !window.localStorage) {
    return { clearedKeys: [], preservedKeys: [] };
  }

  const clearedKeys: string[] = [];
  const preservedKeys: string[] = [];

  // Critical prefixes and exact keys that MUST NEVER be cleared
  const keysToPreservePrefixes = [
    "localeats_manual_status_override_",
    "localeats_holiday_mode_",
    "localeats_diagnostic_errors_log",
    "sb-", // Supabase auth session tokens
    "supabase.auth.token",
    "localeats_user_role",
    "localeats_merchant_pin_",
    "localeats_preferred_theme",
    "localeats_shop_settings_",
    "localeats_active_shop_id",
  ];

  // Specific legacy or temporary keys that should be safely removed on app launch
  const staleKeyPrefixes = [
    "le_shops",
    "le_orders",
    "le_menu",
    "temp_checkout_draft",
    "stale_cart_cache",
    "localeats_temp_",
    "fallback_cache_v1_",
    "localeats_expired_token_",
  ];

  try {
    const keysToRemove: string[] = [];
    const totalKeys = localStorage.length;

    for (let i = 0; i < totalKeys; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const isPreserved = keysToPreservePrefixes.some((prefix) => key.startsWith(prefix));

      if (isPreserved) {
        preservedKeys.push(key);
      } else {
        const isStale = staleKeyPrefixes.some((prefix) => key.startsWith(prefix));
        
        // Also check if key has an expiration payload
        let isExpired = false;
        try {
          const itemVal = localStorage.getItem(key);
          if (itemVal && itemVal.startsWith("{") && itemVal.includes('"expiresAt"')) {
            const parsed = JSON.parse(itemVal);
            if (parsed.expiresAt && typeof parsed.expiresAt === "number" && Date.now() > parsed.expiresAt) {
              isExpired = true;
            }
          }
        } catch {
          // ignore
        }

        if (isStale || isExpired) {
          keysToRemove.push(key);
        }
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
      clearedKeys.push(key);
    }

    if (clearedKeys.length > 0) {
      console.log(`[StorageCleanup] Storage audit complete. Cleared ${clearedKeys.length} stale items, preserved ${preservedKeys.length} active settings.`);
    }
  } catch (err) {
    console.warn("[StorageCleanup] LocalStorage audit encountered non-fatal error:", err);
  }

  return { clearedKeys, preservedKeys };
};
