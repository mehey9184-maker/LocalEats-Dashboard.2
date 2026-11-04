import React, { useEffect, useState } from "react";
import { Check, Crosshair, Info, MapPin, RotateCcw, Store } from "lucide-react";
import { toast } from "sonner";
import type { Shop } from "../types";
import { LeafletMap } from "./LeafletMap";

interface PreviewPin {
  lat: number;
  lng: number;
}

const isPin = (value: unknown): value is PreviewPin => {
  if (!value || typeof value !== "object") return false;
  const pin = value as Record<string, unknown>;
  return typeof pin.lat === "number" && typeof pin.lng === "number" &&
    Number.isFinite(pin.lat) && Number.isFinite(pin.lng) &&
    pin.lat >= -90 && pin.lat <= 90 && pin.lng >= -180 && pin.lng <= 180;
};

const safeStoredPin = (key: string): PreviewPin | null => {
  try {
    const raw = sessionStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isPin(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Storefront and test-location Preview. The original ShopProfile editor has
 * direct database writes and MUST NOT be mounted on read-only Preview.
 * No API calls, database writes or updates to shop records occur here.
 */
export function MerchantStorefrontPreview({ shop }: { shop: Shop | null }) {
  const shopKey = String(shop?.id ?? "unverified");
  const storageKey = `localeats_preview_test_pin_${shopKey}`;
  const [testPin, setTestPin] = useState<PreviewPin | null>(() => safeStoredPin(storageKey));
  const [storedPin, setStoredPin] = useState<PreviewPin | null>(() => safeStoredPin(storageKey));
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    const restored = safeStoredPin(storageKey);
    setTestPin(restored);
    setStoredPin(restored);
    setLocationError("");
  }, [storageKey]);

  const registeredPin: PreviewPin | null = (() => {
    const lat = shop?.lat ?? shop?.latitude;
    const lng = shop?.lng ?? shop?.longitude;
    return isPin({ lat, lng }) ? { lat: lat as number, lng: lng as number } : null;
  })();

  const visiblePin = testPin ?? registeredPin;
  const testChanged = Boolean(testPin && (!registeredPin ||
    Math.abs(testPin.lat - registeredPin.lat) > 0.000001 ||
    Math.abs(testPin.lng - registeredPin.lng) > 0.000001));

  const storeForTab = () => {
    if (!testPin) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(testPin));
      setStoredPin(testPin);
      toast.success("Test map pin saved in this tab only. The real shop is unchanged.");
    } catch {
      setLocationError("Your browser could not store the test pin. No shop details were changed.");
    }
  };

  const resetTestPin = () => {
    try { sessionStorage.removeItem(storageKey); } catch { /* test-only cache */ }
    setTestPin(null);
    setStoredPin(null);
    setLocationError("");
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location services are unavailable in this browser.");
      return;
    }
    setLocationError("");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      result => {
        setLocating(false);
        const next = { lat: result.coords.latitude, lng: result.coords.longitude };
        if (isPin(next)) setTestPin(next);
        else setLocationError("Your device did not return usable coordinates.");
      },
      () => {
        setLocating(false);
        setLocationError("Location permission was denied or timed out. You can place the test pin manually on the map.");
      },
      { enableHighAccuracy: false, timeout: 8500, maximumAge: 180000 },
    );
  };

  return (
    <div className="space-y-5" aria-label="Storefront read-only Preview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-primary">Storefront</p>
          <h1 className="font-headline text-2xl md:text-3xl font-bold text-on-surface">Shop Profile & Location</h1>
          <p className="text-sm text-on-surface-variant mt-1">See the registered shop details and inspect the familiar location map.</p>
        </div>
        <span className="rounded-full bg-surface-container-high px-3 py-1.5 text-xs font-bold text-on-surface-variant border border-outline-variant/15">Read-only Preview</span>
      </div>

      {!shop ? (
        <div role="status" className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5">
          Shop details are not verified. Sign in with your merchant shop to inspect Storefront.
        </div>
      ) : (
        <>
          <section className="bg-surface-container-lowest rounded-2xl md:rounded-[2rem] border border-outline-variant/15 p-5 md:p-7 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Store size={19} />
              <h2 className="font-headline font-bold text-base">Basic information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><p className="text-xs text-on-surface-variant">Shop name</p><p className="font-bold text-on-surface">{shop.name}</p></div>
              <div><p className="text-xs text-on-surface-variant">Category</p><p className="font-bold text-on-surface">{shop.category || "Not recorded"}</p></div>
              <div><p className="text-xs text-on-surface-variant">Registered city / township</p><p className="font-bold text-on-surface">{shop.city || "Not recorded"}</p></div>
              <div><p className="text-xs text-on-surface-variant">Contact phone</p><p className="font-bold text-on-surface">{shop.phone || "Not recorded"}</p></div>
              <div className="sm:col-span-2"><p className="text-xs text-on-surface-variant">Registered address</p>
                <p className="font-bold text-on-surface break-words">{shop.location || shop.address || "No verified street address available"}</p>
              </div>
              {shop.description && <div className="sm:col-span-2"><p className="text-xs text-on-surface-variant">Description</p>
                <p className="text-sm text-on-surface">{shop.description}</p>
              </div>}
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-2xl md:rounded-[2rem] border border-outline-variant/15 p-5 md:p-7 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <MapPin size={20} className="shrink-0 text-primary mt-1" />
              <div>
                <h2 className="font-headline font-bold text-lg text-on-surface">Location & map</h2>
                <p className="text-xs text-on-surface-variant mt-1">The registered location is unchanged. Click the map or drag its pin to inspect a temporary test position.</p>
              </div>
            </div>
            <p role="status" className="flex items-start gap-2 rounded-xl bg-amber-500/10 text-amber-800 dark:text-amber-300 p-3 text-xs leading-relaxed border border-amber-500/20">
              <Info size={16} className="shrink-0" />
              Test pin only: this is not the shop's real address, live pickup area, delivery radius, or Customer App discovery location. No server, shop record or customer order is changed.
            </p>

            {visiblePin ? (
              <div className="h-56 sm:h-72 rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container-low" aria-label="Preview map; place a temporary test pin">
                <LeafletMap
                  center={visiblePin}
                  zoom={13}
                  deliveryRadiusEnabled={false}
                  onLocationSelect={(lat, lng) => {
                    const next = { lat, lng };
                    if (isPin(next)) { setTestPin(next); setLocationError(""); }
                  }}
                />
              </div>
            ) : (
              <div className="rounded-2xl bg-surface-container-low p-5 text-sm text-on-surface-variant">
                The shop record has no verified map coordinates. Use your device location to place a temporary test pin.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-surface-container-low rounded-xl p-3">
                <p className="text-xs font-bold text-on-surface-variant">Registered shop pin</p>
                <p className="font-mono text-xs mt-1 text-on-surface">{registeredPin ? `${registeredPin.lat.toFixed(5)}, ${registeredPin.lng.toFixed(5)}` : "Coordinates not verified"}</p>
              </div>
              <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
                <p className="text-xs font-bold text-on-surface-variant">Test-only map pin</p>
                <p className="font-mono text-xs mt-1 text-on-surface">{testPin ? `${testPin.lat.toFixed(5)}, ${testPin.lng.toFixed(5)}` : "Using registered view"}</p>
                {testPin && <p className="text-xs text-on-surface-variant mt-1">{storedPin && storedPin.lat === testPin.lat && storedPin.lng === testPin.lng ? "Saved in this browser tab" : "Not saved in this browser tab"}</p>}
              </div>
            </div>

            {locationError && <p role="alert" className="text-xs font-medium text-error">{locationError}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={useDeviceLocation} disabled={locating}
                className="merchant-tap-feedback inline-flex items-center gap-2 rounded-xl border border-outline-variant/25 bg-surface-container-low px-4 py-2.5 text-xs font-bold text-on-surface disabled:opacity-50">
                <Crosshair size={15} /> {locating ? "Locating…" : "Use my device location for test"}
              </button>
              <button type="button" onClick={storeForTab} disabled={!testChanged}
                className="merchant-tap-feedback inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary disabled:opacity-40">
                <Check size={15} /> Save test pin in this tab
              </button>
              <button type="button" onClick={resetTestPin} disabled={!testPin}
                className="merchant-tap-feedback inline-flex items-center gap-2 rounded-xl border border-outline-variant/25 px-4 py-2.5 text-xs font-bold text-on-surface-variant disabled:opacity-40">
                <RotateCcw size={15} /> Reset test pin
              </button>
            </div>

            {String(shop.id) === "shop-my-kota-ivory-park" && (
              <div className="rounded-xl bg-surface-container-low border border-outline-variant/15 p-4 space-y-2">
                <p className="text-sm font-bold text-on-surface">Test the shop in the Customer App</p>
                <p className="text-xs text-on-surface-variant">The approved My-Kota Customer P7 Preview offers a separately validated virtual listing for testing outside the 4 km area. This map pin is not transferred to that app.</p>
                <a href="https://project-x7cvt-142fx1ku5-mehey9184-makers-projects.vercel.app"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/15">
                  Open My-Kota Customer test Preview
                </a>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
