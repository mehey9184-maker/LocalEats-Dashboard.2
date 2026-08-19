import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Shop } from "../types";
import { parseAndNormalizeZAAddress } from "../utils";
import { calculateHaversineDistanceKm } from "../utils/deliveryRadius";
import { supabase } from "../lib/supabase";
import { updateFirestoreShop } from "../lib/firebase";
import { toast } from "sonner";

export interface RegionalHub {
  name: string;
  lat: number;
  lng: number;
  province: string;
  defaultRadiusKm: number;
  aliases: string[];
}

export const SA_REGIONAL_HUBS: RegionalHub[] = [
  {
    name: "Tembisa",
    lat: -25.9964,
    lng: 28.2268,
    province: "Gauteng",
    defaultRadiusKm: 10,
    aliases: ["tembisa", "thembisa", "hospital view", "winnie mandela", "esangweni", "oakmoor", "phomolong", "sethokga", "rabasotho", "makhulong"],
  },
  {
    name: "Kaalfontein",
    lat: -26.0125,
    lng: 28.1883,
    province: "Gauteng",
    defaultRadiusKm: 8,
    aliases: ["kaalfontein", "kalfontein", "kaalfontein ext"],
  },
  {
    name: "Ebony Park",
    lat: -26.008,
    lng: 28.175,
    province: "Gauteng",
    defaultRadiusKm: 8,
    aliases: ["ebony park", "eboni park", "ebony"],
  },
  {
    name: "Ivory Park",
    lat: -26.018,
    lng: 28.172,
    province: "Gauteng",
    defaultRadiusKm: 8,
    aliases: ["ivory park", "kopanong", "ivory park ext"],
  },
  {
    name: "Clayville",
    lat: -25.965,
    lng: 28.235,
    province: "Gauteng",
    defaultRadiusKm: 10,
    aliases: ["clayville", "olifantsfontein", "clayville industrial"],
  },
  {
    name: "Rabie Ridge",
    lat: -26.035,
    lng: 28.165,
    province: "Gauteng",
    defaultRadiusKm: 8,
    aliases: ["rabie ridge", "rabie"],
  },
  {
    name: "Midrand",
    lat: -25.998,
    lng: 28.126,
    province: "Gauteng",
    defaultRadiusKm: 15,
    aliases: ["midrand", "vorna valley", "halfway house", "waterfall", "allandale"],
  },
  {
    name: "Kempton Park",
    lat: -26.1,
    lng: 28.23,
    province: "Gauteng",
    defaultRadiusKm: 15,
    aliases: ["kempton park", "birch acres", "chloorkop", "edleen", "van riebeeck park"],
  },
  {
    name: "Johannesburg",
    lat: -26.2041,
    lng: 28.0473,
    province: "Gauteng",
    defaultRadiusKm: 20,
    aliases: ["johannesburg", "joburg", "braamfontein", "sandton", "alexandra", "rosebank"],
  },
  {
    name: "Pretoria",
    lat: -25.7479,
    lng: 28.2293,
    province: "Gauteng",
    defaultRadiusKm: 20,
    aliases: ["pretoria", "tshwane", "centurion", "hatfield", "menlyn"],
  },
  {
    name: "Cape Town",
    lat: -33.9249,
    lng: 18.4241,
    province: "Western Cape",
    defaultRadiusKm: 25,
    aliases: ["cape town", "khayelitsha", "mitchells plain", "bellville"],
  },
];

export type LocationSyncStatus = "synced" | "overlap" | "mismatch" | "unverified";

export interface LocationSyncAnalysis {
  status: LocationSyncStatus;
  isExactMatch: boolean;
  distanceFromHubKm: number;
  closestHubName: string;
  detectedCity: string;
  storedCity: string;
  coveredTownships: string[];
  message: string;
  recommendation: string | null;
}

export interface ShopLocationState {
  address: string;
  city: string;
  lat: number;
  lng: number;
  deliveryRadiusKm: number;
  deliveryRadiusEnabled: boolean;
}

export interface UseShopLocationOptions {
  shop?: Shop | null;
  onLocationSaved?: (updatedShop: Partial<Shop>) => void;
}

/**
 * Finds the closest regional hub given coordinates.
 */
export function findClosestRegionalHub(lat: number, lng: number): { hub: RegionalHub; distanceKm: number } {
  let minDistance = Infinity;
  let closest = SA_REGIONAL_HUBS[0];

  for (const hub of SA_REGIONAL_HUBS) {
    const dist = calculateHaversineDistanceKm(lat, lng, hub.lat, hub.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = hub;
    }
  }

  return { hub: closest, distanceKm: minDistance };
}

/**
 * Evaluates which regional hubs fall within the active delivery radius of given coordinates.
 */
export function getCoveredTownshipsInRadius(lat: number, lng: number, radiusKm: number): string[] {
  const covered: string[] = [];
  for (const hub of SA_REGIONAL_HUBS) {
    const dist = calculateHaversineDistanceKm(lat, lng, hub.lat, hub.lng);
    if (dist <= radiusKm) {
      covered.push(hub.name);
    }
  }
  return covered.length > 0 ? covered : ["Local Zone"];
}

/**
 * Analyzes whether shop coordinates match the stored city / township area filter.
 */
export function analyzeLocationSync(
  lat: number,
  lng: number,
  storedCity: string,
  radiusKm: number = 10,
  radiusEnabled: boolean = true
): LocationSyncAnalysis {
  const { hub, distanceKm } = findClosestRegionalHub(lat, lng);
  const normalizedStored = (storedCity || "Tembisa").trim().toLowerCase();
  const normalizedHub = hub.name.toLowerCase();

  const isExactMatch =
    normalizedStored === normalizedHub ||
    hub.aliases.some((alias) => normalizedStored.includes(alias) || alias.includes(normalizedStored));

  const covered = radiusEnabled
    ? getCoveredTownshipsInRadius(lat, lng, radiusKm)
    : [hub.name];

  let status: LocationSyncStatus = "synced";
  let message = "";
  let recommendation: string | null = null;

  if (isExactMatch && distanceKm <= 5) {
    status = "synced";
    message = `Coordinates [${lat.toFixed(4)}, ${lng.toFixed(4)}] precisely match the stored area (${storedCity}). Location is ${distanceKm.toFixed(1)} km from ${hub.name} center.`;
  } else if (isExactMatch && distanceKm > 5 && distanceKm <= (radiusEnabled ? radiusKm : 12)) {
    status = "synced";
    message = `Coordinates are in the ${hub.name} region (${distanceKm.toFixed(1)} km from center). Area filter is active.`;
  } else if (!isExactMatch && distanceKm <= (radiusEnabled ? radiusKm : 10)) {
    status = "overlap";
    message = `Coordinates point to ${hub.name} (${distanceKm.toFixed(1)} km), while area filter is set to "${storedCity}". Due to your ${radiusKm} KM delivery radius, both areas are within range.`;
    recommendation = `Consider auto-aligning your shop city filter to "${hub.name}" for cleaner storefront indexing.`;
  } else {
    status = "mismatch";
    message = `Coordinates [${lat.toFixed(4)}, ${lng.toFixed(4)}] are located in ${hub.name} (${distanceKm.toFixed(1)} km away), but stored area filter is "${storedCity}".`;
    recommendation = `Update shop area filter to "${hub.name}" so customer searches and rider dispatch match your real pin.`;
  }

  return {
    status,
    isExactMatch,
    distanceFromHubKm: distanceKm,
    closestHubName: hub.name,
    detectedCity: hub.name,
    storedCity: storedCity || "Tembisa",
    coveredTownships: covered,
    message,
    recommendation,
  };
}

/**
 * Centralized Unified Hook for Shop Geolocation & Client-Side Area Syncing.
 * Strictly avoids recursive re-renders by performing deep/primitive equality checks.
 */
export function useShopLocation({ shop, onLocationSaved }: UseShopLocationOptions = {}) {
  const [locationState, setLocationState] = useState<ShopLocationState>(() => {
    const lat = shop?.lat ?? -25.9964;
    const lng = shop?.lng ?? 28.2268;
    const address = shop?.location ?? "";
    const parsed = parseAndNormalizeZAAddress(address || "Tembisa");
    const city = shop?.city || parsed.city || "Tembisa";
    const deliveryRadiusKm = shop?.delivery_radius_km ?? 10;
    const deliveryRadiusEnabled = shop?.delivery_radius_enabled ?? true;

    return {
      address,
      city,
      lat,
      lng,
      deliveryRadiusKm,
      deliveryRadiusEnabled,
    };
  });

  const [isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const prevShopRef = useRef<{
    id?: string | number;
    lat?: number;
    lng?: number;
    location?: string;
    city?: string;
    delivery_radius_km?: number;
    delivery_radius_enabled?: boolean;
  }>({});

  // Sync with incoming shop changes ONLY if primitive values actually differ
  useEffect(() => {
    if (!shop) return;

    const prev = prevShopRef.current;
    const hasChanged =
      prev.id !== shop.id ||
      prev.lat !== shop.lat ||
      prev.lng !== shop.lng ||
      prev.location !== shop.location ||
      prev.city !== shop.city ||
      prev.delivery_radius_km !== shop.delivery_radius_km ||
      prev.delivery_radius_enabled !== shop.delivery_radius_enabled;

    if (hasChanged) {
      prevShopRef.current = {
        id: shop.id,
        lat: shop.lat,
        lng: shop.lng,
        location: shop.location,
        city: shop.city,
        delivery_radius_km: shop.delivery_radius_km,
        delivery_radius_enabled: shop.delivery_radius_enabled,
      };

      setLocationState((current) => {
        const nextLat = shop.lat ?? current.lat ?? -25.9964;
        const nextLng = shop.lng ?? current.lng ?? 28.2268;
        const nextAddress = shop.location ?? current.address ?? "";
        const nextCity = shop.city || parseAndNormalizeZAAddress(nextAddress || "Tembisa").city || current.city;
        const nextRadius = shop.delivery_radius_km ?? current.deliveryRadiusKm ?? 10;
        const nextEnabled = shop.delivery_radius_enabled ?? current.deliveryRadiusEnabled ?? true;

        if (
          current.lat === nextLat &&
          current.lng === nextLng &&
          current.address === nextAddress &&
          current.city === nextCity &&
          current.deliveryRadiusKm === nextRadius &&
          current.deliveryRadiusEnabled === nextEnabled
        ) {
          return current;
        }

        return {
          lat: nextLat,
          lng: nextLng,
          address: nextAddress,
          city: nextCity,
          deliveryRadiusKm: nextRadius,
          deliveryRadiusEnabled: nextEnabled,
        };
      });
    }
  }, [
    shop?.id,
    shop?.lat,
    shop?.lng,
    shop?.location,
    shop?.city,
    shop?.delivery_radius_km,
    shop?.delivery_radius_enabled,
  ]);

  // Derived synchronization diagnostic analysis
  const syncAnalysis = useMemo(() => {
    return analyzeLocationSync(
      locationState.lat,
      locationState.lng,
      locationState.city,
      locationState.deliveryRadiusKm,
      locationState.deliveryRadiusEnabled
    );
  }, [
    locationState.lat,
    locationState.lng,
    locationState.city,
    locationState.deliveryRadiusKm,
    locationState.deliveryRadiusEnabled,
  ]);

  // Update coordinates with float threshold equality check
  const setCoordinates = useCallback((lat: number, lng: number, autoDetectAddress = true) => {
    setLocationState((prev) => {
      const latDiff = Math.abs(prev.lat - lat);
      const lngDiff = Math.abs(prev.lng - lng);
      if (latDiff < 0.00001 && lngDiff < 0.00001) {
        return prev;
      }
      return { ...prev, lat, lng };
    });

    if (autoDetectAddress) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&email=aviwenotununu4@gmail.com`,
        { signal: controller.signal }
      )
        .then((r) => {
          clearTimeout(timeout);
          return r.ok ? r.json() : null;
        })
        .then((data) => {
          if (data && (data.address || data.display_name)) {
            const raw =
              data.display_name ||
              [data.address?.house_number, data.address?.road, data.address?.city, data.address?.state]
                .filter(Boolean)
                .join(", ");
            const { formattedAddress, city: detectedCity } = parseAndNormalizeZAAddress(raw);

            setLocationState((prev) => ({
              ...prev,
              address: formattedAddress || prev.address,
              city: detectedCity || prev.city,
            }));
          }
        })
        .catch(() => {});
    }
  }, []);

  // Update address string and auto-derive city
  const setAddress = useCallback((address: string, syncCity = true) => {
    setLocationState((prev) => {
      if (prev.address === address) return prev;
      const parsed = parseAndNormalizeZAAddress(address);
      return {
        ...prev,
        address,
        city: syncCity && parsed.city ? parsed.city : prev.city,
      };
    });
  }, []);

  // Update city string
  const setCity = useCallback((city: string) => {
    setLocationState((prev) => {
      if (prev.city === city) return prev;
      return { ...prev, city };
    });
  }, []);

  // Update delivery radius settings
  const setDeliveryRadius = useCallback((radiusKm: number, enabled?: boolean) => {
    setLocationState((prev) => {
      const nextKm = Math.max(1, radiusKm);
      const nextEnabled = enabled !== undefined ? enabled : prev.deliveryRadiusEnabled;
      if (prev.deliveryRadiusKm === nextKm && prev.deliveryRadiusEnabled === nextEnabled) {
        return prev;
      }
      return {
        ...prev,
        deliveryRadiusKm: nextKm,
        deliveryRadiusEnabled: nextEnabled,
      };
    });
  }, []);

  // Auto-align shop city with the detected GPS township
  const autoAlignWithCoordinates = useCallback(() => {
    const { hub } = findClosestRegionalHub(locationState.lat, locationState.lng);
    setCity(hub.name);
    toast.success(`Area filter aligned to ${hub.name} based on GPS coordinates!`);
  }, [locationState.lat, locationState.lng, setCity]);

  // Real-time GPS Detection with browser navigator
  const detectCurrentGPS = useCallback(async (): Promise<{ lat: number; lng: number; address: string; city: string } | null> => {
    setIsLocating(true);

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      setIsLocating(false);
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            let formattedAddress = "";
            let detectedCity = "Tembisa";

            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 3500);
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&email=aviwenotununu4@gmail.com`,
                { signal: controller.signal }
              );
              clearTimeout(timeout);

              if (response.ok) {
                const data = await response.json();
                if (data && (data.address || data.display_name)) {
                  const raw =
                    data.display_name ||
                    [data.address?.house_number, data.address?.road, data.address?.city, data.address?.state]
                      .filter(Boolean)
                      .join(", ");
                  const parsed = parseAndNormalizeZAAddress(raw);
                  formattedAddress = parsed.formattedAddress;
                  detectedCity = parsed.city;
                }
              }
            } catch {
              // Ignore geocoding failure, fallback to coordinates
            }

            if (!detectedCity || detectedCity === "Tembisa") {
              const { hub } = findClosestRegionalHub(latitude, longitude);
              detectedCity = hub.name;
            }

            setLocationState((prev) => ({
              ...prev,
              lat: latitude,
              lng: longitude,
              address: formattedAddress || prev.address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              city: detectedCity || prev.city,
            }));

            toast.success(`GPS detected: ${detectedCity} [${latitude.toFixed(4)}, ${longitude.toFixed(4)}]`);
            resolve({ lat: latitude, lng: longitude, address: formattedAddress, city: detectedCity });
          } catch {
            toast.error("Failed to parse GPS location.");
            resolve(null);
          } finally {
            setIsLocating(false);
          }
        },
        (error) => {
          console.warn("GPS detection warning:", error);
          toast.error(`GPS access failed: ${error.message || "Please allow location permissions"}`);
          setIsLocating(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  }, []);

  // Save location to Firestore, Supabase, and localStorage simultaneously
  const saveLocation = useCallback(
    async (targetShopId?: string | number): Promise<boolean> => {
      const activeShopId = targetShopId || shop?.id;
      if (!activeShopId) {
        toast.error("No active shop selected to save location.");
        return false;
      }

      setIsSaving(true);
      const nowISO = new Date().toISOString();

      try {
        const payload = {
          lat: locationState.lat,
          lng: locationState.lng,
          location: locationState.address,
          city: locationState.city,
          delivery_radius_km: locationState.deliveryRadiusKm,
          delivery_radius_enabled: locationState.deliveryRadiusEnabled,
          updated_at: nowISO,
        };

        // 1. Update Firestore
        try {
          await updateFirestoreShop(activeShopId, payload);
        } catch (fsErr) {
          console.warn("[useShopLocation] Firestore update warning:", fsErr);
        }

        // 2. Update Supabase
        const { error: sbError } = await supabase
          .from("shops")
          .update(payload)
          .eq("id", activeShopId);

        if (sbError && sbError.code !== "42703") {
          console.warn("[useShopLocation] Supabase update warning:", sbError.message);
        }

        // 3. Update localStorage cached shops
        try {
          const rawCached = localStorage.getItem("localeats_cached_shops");
          if (rawCached) {
            const cachedShops: Shop[] = JSON.parse(rawCached);
            const updated = cachedShops.map((s) => (String(s.id) === String(activeShopId) ? { ...s, ...payload } : s));
            localStorage.setItem("localeats_cached_shops", JSON.stringify(updated));
          }
        } catch {
          // ignore
        }

        setLastSyncedAt(nowISO);
        onLocationSaved?.(payload);
        toast.success(`Shop location & area filter saved! (${locationState.city} • ${locationState.deliveryRadiusKm} KM radius)`);
        return true;
      } catch (err: unknown) {
        const e = err as Error;
        toast.error(`Failed to save location: ${e.message}`);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      shop?.id,
      locationState.lat,
      locationState.lng,
      locationState.address,
      locationState.city,
      locationState.deliveryRadiusKm,
      locationState.deliveryRadiusEnabled,
      onLocationSaved,
    ]
  );

  return {
    locationState,
    syncAnalysis,
    isLocating,
    isSaving,
    lastSyncedAt,
    setCoordinates,
    setAddress,
    setCity,
    setDeliveryRadius,
    detectCurrentGPS,
    autoAlignWithCoordinates,
    saveLocation,
  };
}
