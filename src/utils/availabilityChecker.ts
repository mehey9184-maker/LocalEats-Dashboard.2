import {MerchantApi,MerchantApiError} from "../services/MerchantApi";
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

  return shop.is_active === true;
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

  const parts = new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Johannesburg",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const hours = parts.find(p=>p.type==="hour")!.value;
  const minutes = parts.find(p=>p.type==="minute")!.value;
  const currentTime = `${hours}:${minutes}`;

  const { open, close } = operatingHours;
  let isOpen = false;

  if (open === close) return {inHours:false,reason:"Opening and closing times are equal"};
  if (open < close) {
    isOpen = currentTime >= open && currentTime < close;
  } else {
    // Overnight window (e.g. 18:00 - 02:00)
    isOpen = currentTime >= open || currentTime < close;
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

  const isActive = shop.is_active === true;

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
  try {
    let shop;
    try {shop=await MerchantApi.setAvailability(params.shopId,params.isOpen);}
    catch(error){
      if(!(error instanceof MerchantApiError) || error.code!=="OUTSIDE_HOURS_CONFIRMATION_REQUIRED") throw error;
      if(!window.confirm("Open outside scheduled hours for 1 hour? You can close early. Your normal hours will stay unchanged.")) return {success:false,error:"Opening cancelled. Shop status was not changed."};
      shop=await MerchantApi.setAvailability(params.shopId,params.isOpen,true,(error as any).expectedRevision);
    }
    // Clean old browser-only authority only after confirmed server persistence.
    try {
      localStorage.removeItem(`localeats_manual_status_override_${params.shopId}`);
      localStorage.removeItem(`localeats_holiday_mode_${params.shopId}`);
    } catch { /* Cache cleanup cannot change a confirmed server result. */ }
    const freshShop=shop as Shop;
    window.dispatchEvent(new CustomEvent("localeats:availability-confirmed",{detail:freshShop}));
    params.onSuccess?.(freshShop);
    return {success:true,freshShop};
  }catch(error){const message=error instanceof Error?error.message:"Availability was not saved.";params.onError?.(message);return {success:false,error:message};}

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
