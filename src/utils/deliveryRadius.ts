import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Calculates straight-line distance in kilometers between two GPS coordinates
 * using the Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number" ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return 0;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 100) / 100; // 2 decimal places
}

export interface RadiusValidationResult {
  isWithin: boolean;
  distanceKm: number;
  maxRadiusKm: number;
  enabled: boolean;
  message: string;
}

/**
 * Checks whether a customer location falls within a shop's delivery radius.
 */
export function validateDeliveryRadius(
  shopLat: number | undefined | null,
  shopLng: number | undefined | null,
  custLat: number | undefined | null,
  custLng: number | undefined | null,
  maxRadiusKm: number = 10,
  enabled: boolean = true
): RadiusValidationResult {
  if (!enabled) {
    return {
      isWithin: true,
      distanceKm: 0,
      maxRadiusKm,
      enabled: false,
      message: "Delivery radius check is disabled.",
    };
  }

  // Fallback defaults if coordinates are missing (e.g., Tembisa center)
  const defaultLat = -25.9984;
  const defaultLng = 28.2268;

  const sLat = shopLat && !isNaN(Number(shopLat)) ? Number(shopLat) : defaultLat;
  const sLng = shopLng && !isNaN(Number(shopLng)) ? Number(shopLng) : defaultLng;
  const cLat = custLat && !isNaN(Number(custLat)) ? Number(custLat) : defaultLat;
  const cLng = custLng && !isNaN(Number(custLng)) ? Number(custLng) : defaultLng;

  const distanceKm = calculateHaversineDistanceKm(sLat, sLng, cLat, cLng);
  const isWithin = distanceKm <= maxRadiusKm;

  const message = isWithin
    ? `Customer is within delivery radius (${distanceKm} km / ${maxRadiusKm} km max).`
    : `Customer location (${distanceKm} km away) exceeds shop maximum delivery radius of ${maxRadiusKm} km.`;

  return {
    isWithin,
    distanceKm,
    maxRadiusKm,
    enabled: true,
    message,
  };
}

/**
 * Executes server-side RPC validation via Supabase RPC function check_delivery_within_radius,
 * with client-side fallback if the database function is not yet provisioned.
 */
export async function checkDeliveryRadiusRPC(
  supabase: SupabaseClient,
  params: {
    shopLat: number;
    shopLng: number;
    custLat: number;
    custLng: number;
    maxRadiusKm: number;
  }
): Promise<{ isWithin: boolean; distanceKm: number }> {
  try {
    const { data, error } = await supabase.rpc("check_delivery_within_radius", {
      p_shop_lat: params.shopLat,
      p_shop_lng: params.shopLng,
      p_cust_lat: params.custLat,
      p_cust_lng: params.custLng,
      p_max_radius_km: params.maxRadiusKm,
    });

    if (!error && typeof data === "boolean") {
      const clientDist = calculateHaversineDistanceKm(
        params.shopLat,
        params.shopLng,
        params.custLat,
        params.custLng
      );
      return { isWithin: data, distanceKm: clientDist };
    }
  } catch {
    // RPC function not provisioned or network error -> fallback to client-side formula
  }

  const clientResult = validateDeliveryRadius(
    params.shopLat,
    params.shopLng,
    params.custLat,
    params.custLng,
    params.maxRadiusKm,
    true
  );

  return { isWithin: clientResult.isWithin, distanceKm: clientResult.distanceKm };
}

/**
 * SQL migration statement for creating the database function in Supabase SQL Editor.
 */
export const DELIVERY_RADIUS_RPC_SQL = `
-- Function to restrict deliveries based on maximum radius (KM) from shop
CREATE OR REPLACE FUNCTION public.check_delivery_within_radius(
  p_shop_lat double precision,
  p_shop_lng double precision,
  p_cust_lat double precision,
  p_cust_lng double precision,
  p_max_radius_km double precision
) RETURNS boolean AS $$
DECLARE
  dlat double precision;
  dlng double precision;
  a double precision;
  c double precision;
  dist_km double precision;
BEGIN
  IF p_shop_lat IS NULL OR p_shop_lng IS NULL OR p_cust_lat IS NULL OR p_cust_lng IS NULL THEN
    RETURN true; -- Allow if coordinates not provided
  END IF;

  dlat := radians(p_cust_lat - p_shop_lat);
  dlng := radians(p_cust_lng - p_shop_lng);

  a := sin(dlat / 2.0)^2 + cos(radians(p_shop_lat)) * cos(radians(p_cust_lat)) * sin(dlng / 2.0)^2;
  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  dist_km := 6371.0 * c;

  RETURN dist_km <= p_max_radius_km;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
`;
