import { Shop } from "../types";
/**
 * Availability Checker Utility for LocalEats
 * 
 * Provides centralized, bulletproof availability checks for:
 * 1. Rider Online & Active status (simple, reliable online/offline verification)
 * 2. Shop Open / Closed / Operating status (dual-sync with Supabase and Firestore)
 */

export interface RiderStatusInfo {
  isOnline: boolean;
  isActive: boolean;
  status: 'online' | 'busy' | 'paused' | 'offline';
  badgeText: string;
  badgeColor: 'emerald' | 'amber' | 'blue' | 'zinc';
}

export interface ShopAvailabilityInfo {
  isOpen: boolean;
  isReceivingOrders: boolean;
  status: 'open' | 'closed' | 'busy';
  badgeText: string;
  badgeColor: 'emerald' | 'rose' | 'amber';
  reason: string;
  hasOnlineRiders: boolean;
  onlineRiderCount: number;
  canDeliver: boolean;
  canPickup: boolean;
}

export interface OperatingHoursConfig {
  open?: string; // e.g. "08:00"
  close?: string; // e.g. "22:00"
}

export interface HolidayScheduleConfig {
  start?: string; // ISO date or "YYYY-MM-DD"
  end?: string;   // ISO date or "YYYY-MM-DD"
}

export interface RiderLike {
  is_online?: boolean | null;
  status?: string | null;
  connection_code?: string | null;
  verification_status?: string | null;
}

export interface ShopLike {
  id?: number | string;
  is_active?: boolean | null;
  opening_time?: string | null;
  closing_time?: string | null;
}

/**
 * Checks if a courier / rider is online.
 * Only checks if the rider is online or not, supporting standard status flags.
 */
export function isRiderOnline(rider: RiderLike | null | undefined): boolean {
  if (!rider) return false;

  // 1. Explicit boolean flag takes priority
  if (typeof rider.is_online === "boolean") {
    return rider.is_online;
  }

  // 2. Fallback to status string
  if (rider.status && typeof rider.status === "string") {
    const s = rider.status.toLowerCase().trim();
    if (s === "offline" || s === "inactive" || s === "off_duty") {
      return false;
    }
    if (s === "online" || s === "active" || s === "busy" || s === "ready") {
      return true;
    }
  }

  // 3. In-house fleet default
  if (rider.connection_code === "IN-HOUSE") {
    return true;
  }

  return false;
}

/**
 * Checks if a rider is active and available for dispatches.
 */
export function isRiderActive(rider: RiderLike | null | undefined): boolean {
  if (!rider) return false;
  if (!isRiderOnline(rider)) return false;
  
  if (rider.status === "paused" || rider.status === "offline") {
    return false;
  }
  if (rider.verification_status === "rejected") {
    return false;
  }
  return true;
}

/**
 * Returns structured status info for a rider (badge, color, text).
 */
export function checkRiderAvailability(rider: RiderLike | null | undefined): RiderStatusInfo {
  const online = isRiderOnline(rider);
  const active = isRiderActive(rider);
  const statusStr = (typeof rider?.status === "string" ? rider.status : "").toLowerCase().trim();

  if (!online || !active) {
    if (statusStr === 'paused') {
      return {
        isOnline: true,
        isActive: false,
        status: 'paused',
        badgeText: 'Paused',
        badgeColor: 'blue',
      };
    }
    return {
      isOnline: false,
      isActive: false,
      status: 'offline',
      badgeText: 'Offline',
      badgeColor: 'zinc',
    };
  }

  if (statusStr === 'busy') {
    return {
      isOnline: true,
      isActive: true,
      status: 'busy',
      badgeText: 'On Delivery',
      badgeColor: 'amber',
    };
  }

  return {
    isOnline: true,
    isActive: true,
    status: 'online',
    badgeText: 'Online & Ready',
    badgeColor: 'emerald',
  };
}

/**
 * Filters a list of riders to only those who are online.
 */
export function filterOnlineRiders<T extends RiderLike>(
  riders: T[] | null | undefined
): T[] {
  if (!Array.isArray(riders)) return [];
  return riders.filter((r) => isRiderOnline(r));
}

/**
 * Counts how many riders in the roster are currently online.
 */
export function getOnlineRidersCount(riders: RiderLike[] | null | undefined): number {
  if (!Array.isArray(riders)) return 0;
  return riders.filter((r) => isRiderOnline(r)).length;
}

/**
 * Checks whether a shop is currently open and accepting orders.
 */
export function isShopOpen(shop: ShopLike | null | undefined): boolean {
  if (!shop) return false;

  const shopId = shop.id;
  if (shopId !== undefined && shopId !== null) {
    // Check manual override in local cache if present
    try {
      const overrideData = localStorage.getItem(`localeats_manual_status_override_${shopId}`);
      if (overrideData) {
        const { status, timestamp } = JSON.parse(overrideData);
        if (Date.now() - timestamp < 12 * 60 * 60 * 1000) {
          return Boolean(status);
        }
      }

      const holiday = localStorage.getItem(`localeats_holiday_mode_${shopId}`);
      if (holiday === "true") {
        return false;
      }
    } catch {
      // ignore
    }
  }

  return Boolean(shop.is_active ?? true);
}

/**
 * Evaluates current time against operating hours (HH:MM strings)
 */
export function isWithinOperatingHours(
  operatingHours?: OperatingHoursConfig | null,
  holidaySchedule?: HolidayScheduleConfig | null
): { inHours: boolean; reason?: string } {
  const now = new Date();

  // 1. Check holiday range
  if (holidaySchedule?.start && holidaySchedule?.end) {
    const startDate = new Date(holidaySchedule.start);
    const endDate = new Date(holidaySchedule.end);
    endDate.setHours(23, 59, 59, 999);
    if (now >= startDate && now <= endDate) {
      return { inHours: false, reason: "Store is currently on scheduled holiday" };
    }
  }

  // 2. Check open / close time
  if (!operatingHours?.open || !operatingHours?.close) {
    return { inHours: true }; // No hours restriction defined
  }

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const currentTime = `${hours}:${minutes}`;

  const { open, close } = operatingHours;
  let isOpen = false;

  if (open <= close) {
    isOpen = currentTime >= open && currentTime <= close;
  } else {
    // Overnight window (e.g. 18:00 - 02:00)
    isOpen = currentTime >= open || currentTime <= close;
  }

  return {
    inHours: isOpen,
    reason: isOpen ? undefined : `Outside operating hours (${open} - ${close})`,
  };
}

/**
 * Comprehensive Shop Availability Evaluation
 */
export function checkShopAvailability(
  shop: ShopLike | null | undefined,
  options?: {
    autoSchedule?: boolean;
    operatingHours?: OperatingHoursConfig | null;
    holidaySchedule?: HolidayScheduleConfig | null;
    riders?: RiderLike[];
  }
): ShopAvailabilityInfo {
  if (!shop) {
    return {
      isOpen: false,
      isReceivingOrders: false,
      status: 'closed',
      badgeText: 'Store Unavailable',
      badgeColor: 'rose',
      reason: 'Shop data not loaded',
      hasOnlineRiders: false,
      onlineRiderCount: 0,
      canDeliver: false,
      canPickup: false,
    };
  }

  const shopId = shop.id;
  let isActive = Boolean(shop.is_active ?? true);

  // Check manual overrides
  if (shopId !== undefined && shopId !== null) {
    try {
      const overrideData = localStorage.getItem(`localeats_manual_status_override_${shopId}`);
      if (overrideData) {
        const { status, timestamp } = JSON.parse(overrideData);
        if (Date.now() - timestamp < 12 * 60 * 60 * 1000) {
          isActive = Boolean(status);
        }
      }

      const holiday = localStorage.getItem(`localeats_holiday_mode_${shopId}`);
      if (holiday === "true") {
        isActive = false;
      }
    } catch {
      // ignore
    }
  }

  // Check schedule if auto schedule is enabled
  if (options?.autoSchedule && (options.operatingHours || options.holidaySchedule)) {
    const hoursResult = isWithinOperatingHours(options.operatingHours, options.holidaySchedule);
    if (!hoursResult.inHours) {
      isActive = false;
    }
  }

  const onlineRiderCount = getOnlineRidersCount(options?.riders);
  const hasOnlineRiders = onlineRiderCount > 0;

  if (!isActive) {
    return {
      isOpen: false,
      isReceivingOrders: false,
      status: 'closed',
      badgeText: 'Closed & Offline',
      badgeColor: 'rose',
      reason: 'Shop is currently marked as closed / offline',
      hasOnlineRiders,
      onlineRiderCount,
      canDeliver: false,
      canPickup: false,
    };
  }

  return {
    isOpen: true,
    isReceivingOrders: true,
    status: 'open',
    badgeText: 'Open & Live',
    badgeColor: 'emerald',
    reason: 'Shop is open and actively accepting customer orders',
    hasOnlineRiders,
    onlineRiderCount,
    canDeliver: true,
    canPickup: true,
  };
}

export interface SupabaseClientLike {
  from: (table: string) => {
    update: (data: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };
}

/**
 * Synchronizes shop status (is_active: boolean) to BOTH Supabase and Firestore
 * to guarantee that client storefronts and merchant apps are perfectly in sync.
 */
export async function syncShopAvailability(params: {
  shopId: number | string;
  isOpen: boolean;
  supabase?: SupabaseClientLike | null;
  updateFirestoreShop?: (shopId: string | number, updates: Record<string, unknown>) => Promise<{ error: Error | null }>;
  getFirestoreShopById?: (shopId: string | number) => Promise<Shop | null>;
  onSuccess?: (freshShop?: Shop | null) => void;
  onError?: (err: unknown) => void;
}): Promise<{ success: boolean; error?: string; freshShop?: Shop | null }> {
  const { shopId, isOpen, supabase, updateFirestoreShop, getFirestoreShopById } = params;
  const numId = Number(shopId);

  console.log(`[Diagnostic] syncShopAvailability initiated: toggling shopId ${shopId} to is_active=${isOpen}`);

  // 1. Update local storage caches immediately for zero-latency UI
  try {
    localStorage.setItem(
      `localeats_manual_status_override_${shopId}`,
      JSON.stringify({ status: isOpen, timestamp: Date.now() })
    );
    if (isOpen) {
      localStorage.removeItem(`localeats_holiday_mode_${shopId}`);
    } else {
      localStorage.setItem(`localeats_holiday_mode_${shopId}`, "true");
    }

    // Update cached shops
    const cached = localStorage.getItem("localeats_cached_shops");
    if (cached) {
      const list = JSON.parse(cached);
      if (Array.isArray(list)) {
        const updated = list.map((s: { id?: string | number; [key: string]: unknown }) =>
          String(s.id) === String(shopId) || (!isNaN(numId) && s.id === numId)
            ? { ...s, is_active: isOpen }
            : s
        );
        localStorage.setItem("localeats_cached_shops", JSON.stringify(updated));
      }
    }
  } catch (e) {
    console.warn("[Availability Sync] Local storage update warning:", e);
  }

  let firestoreError: Error | null = null;
  let supabaseError: { message: string } | null = null;

  // 2. Synchronize to Firestore
  if (updateFirestoreShop) {
    try {
      const res = await updateFirestoreShop(shopId, {
        is_active: isOpen,
        updated_at: new Date().toISOString(),
      });
      if (res?.error) firestoreError = res.error;
    } catch (e: unknown) {
      firestoreError = e instanceof Error ? e : new Error(String(e));
    }
  }

  // 3. Synchronize to Supabase `shops` table (Ensuring client app sees updated status)
  if (supabase) {
    try {
      const { error } = await supabase
        .from("shops")
        .update({
          is_active: isOpen,
          updated_at: new Date().toISOString(),
        })
        .eq("id", isNaN(numId) ? shopId : numId);

      if (error) {
        // Fallback without updated_at if column mismatch
        const fallback = await supabase
          .from("shops")
          .update({ is_active: isOpen })
          .eq("id", isNaN(numId) ? shopId : numId);
        if (fallback.error) supabaseError = fallback.error;
      }
    } catch (e: unknown) {
      supabaseError = e instanceof Error ? { message: e.message } : { message: String(e) };
    }
  }

  if (firestoreError && supabaseError) {
    const msg = supabaseError?.message || firestoreError?.message || "Failed to sync shop status";
    console.error(`[Diagnostic] syncShopAvailability FAILED for shopId ${shopId}:`, msg);
    params.onError?.(msg);
    return { success: false, error: msg };
  }

  // 4. Immediately re-fetch the shop's status from the database to ensure state certainty
  let freshShop: Shop | null = null;
  if (getFirestoreShopById) {
    try {
      freshShop = await getFirestoreShopById(shopId);
      if (freshShop) {
        console.log(`[Diagnostic] syncShopAvailability fresh shop fetched from Firestore:`, {
          shopId,
          is_active: freshShop.is_active,
        });
        // Update cached shops with latest verified database record
        try {
          const cached = localStorage.getItem("localeats_cached_shops");
          if (cached) {
            const list = JSON.parse(cached);
            if (Array.isArray(list)) {
              const updated = list.map((s: { id?: string | number; [key: string]: unknown }) =>
                String(s.id) === String(shopId) || (!isNaN(numId) && s.id === numId)
                  ? { ...s, ...freshShop, is_active: freshShop?.is_active ?? isOpen }
                  : s
              );
              localStorage.setItem("localeats_cached_shops", JSON.stringify(updated));
            }
          }
        } catch {
          // ignore cache error
        }
      }
    } catch (fetchErr) {
      console.warn("[Availability Sync] Error re-fetching shop status after update:", fetchErr);
    }
  }

  console.log(`[Diagnostic] syncShopAvailability SUCCESS for shopId ${shopId}. is_active is now ${isOpen}`);
  params.onSuccess?.(freshShop);
  return { success: true, freshShop };
}

/**
 * 1-Click Repair / Ensure Open helper
 * Immediately opens the shop across Supabase, Firestore, and LocalStorage.
 */
export async function forceOpenShop(params: {
  shopId: number | string;
  supabase?: SupabaseClientLike | null;
  updateFirestoreShop?: (shopId: string | number, updates: Record<string, unknown>) => Promise<{ error: Error | null }>;
}): Promise<{ success: boolean; message: string }> {
  const res = await syncShopAvailability({
    ...params,
    isOpen: true,
  });

  if (res.success) {
    return { success: true, message: "Shop is now Open and Live across all apps!" };
  }
  return { success: false, message: res.error || "Failed to force shop open" };
}
