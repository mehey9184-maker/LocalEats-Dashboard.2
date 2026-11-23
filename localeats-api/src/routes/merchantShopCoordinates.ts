/**
 * Merchant shop-location column compatibility.
 *
 * Main LocalEats shops historically has latitude/longitude AND lat/lng.
 * Separate LocalEats-Profile-Staging has latitude/longitude only, but
 * ALSO lacks the existing signup route's required phone/approval_reason and
 * generated shop ID. It is catalogue-only: DO NOT send merchant signup
 * requests there or assume selecting canonical-only makes it signup-ready.
 * Server-side mode defaults to legacy-dual, preserving current Production
 * inserts. A future merchant-capable schema may explicitly use canonical-only
 * only after complete schema/backup/authorization verification.
 *
 * This module is pure: no database access, logins, network, or configuration
 * mutations. Never infer a schema from a user-submitted field or public URL.
 */
export type MerchantCoordinateMode = "legacy-dual" | "canonical-only";

export function resolveMerchantCoordinateMode(
  configured: string | undefined,
): MerchantCoordinateMode {
  if (configured == null || configured === "") return "legacy-dual";
  if (configured === "legacy-dual" || configured === "canonical-only") {
    return configured;
  }
  throw new Error("MERCHANT_COORDINATE_MODE_INVALID");
}

export function createMerchantCoordinates(
  latitude: number,
  longitude: number,
  mode: MerchantCoordinateMode,
): { latitude: number; longitude: number; lat?: number; lng?: number } {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("MERCHANT_COORDINATES_INVALID");
  }
  if (mode === "legacy-dual") {
    return { latitude, longitude, lat: latitude, lng: longitude };
  }
  if (mode === "canonical-only") {
    return { latitude, longitude };
  }
  throw new Error("MERCHANT_COORDINATE_MODE_INVALID");
}

/**
 * Return aliases to the client when the canonical database omits the
 * physical legacy lat/lng columns. Only use values read back from the DB,
 * not unverified request arguments.
 */
export function normalizeVerifiedShopCoordinates<T extends Record<string, unknown>>(shop: T):
  T & { lat?: number; lng?: number } {
  const latitude = shop.latitude;
  const longitude = shop.longitude;
  const lat = shop.lat;
  const lng = shop.lng;
  if (typeof latitude !== "number" || !Number.isFinite(latitude) ||
      latitude < -90 || latitude > 90 ||
      typeof longitude !== "number" || !Number.isFinite(longitude) ||
      longitude < -180 || longitude > 180) {
    throw new Error("MERCHANT_PERSISTED_COORDINATES_UNVERIFIED");
  }
  if (lat != null && (typeof lat !== "number" || !Number.isFinite(lat) || lat !== latitude)) {
    throw new Error("MERCHANT_PERSISTED_COORDINATES_CONFLICT");
  }
  if (lng != null && (typeof lng !== "number" || !Number.isFinite(lng) || lng !== longitude)) {
    throw new Error("MERCHANT_PERSISTED_COORDINATES_CONFLICT");
  }
  return { ...shop, lat: latitude, lng: longitude };
}
