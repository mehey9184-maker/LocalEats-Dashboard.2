import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Store,
  MapPin,
  Phone,
  Instagram,
  Facebook,
  Upload,
  CheckCircle2,
  AlertCircle,
  Check,
  MessageCircle,
  ImageIcon,
  RefreshCw,
  Loader2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "../lib/supabase";
import { updateFirestoreShop } from "../lib/firebase";
import { Shop, User } from "../types";
import { LeafletMap } from "./LeafletMap";
import { LocationSyncIndicator } from "./LocationSyncIndicator";
import {
  parseAndNormalizeZAAddress,
  formatSAPhone,
} from "../utils";
import { analyzeLocationSync } from "../hooks/useShopLocation";
import { handleCentralizedError } from "../utils/errorHandler";
import { DEFAULT_SHOP_LOGO, isPlaceholderImage } from "../constants";
import imageCompression from "browser-image-compression";
import { uploadImageToFirebaseStorage } from "../lib/firebase";
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export interface ShopProfileProps {
  shop: Shop;
  onRefresh: () => void;
  user: User | null;
  setIsSaving: (val: boolean) => void;
  setIsSaveSuccess: (val: boolean) => void;
  isSaving?: boolean;
  isSuccess?: boolean;
  onFinished?: () => void;
}

export const ShopProfile: React.FC<ShopProfileProps> = ({
  shop,
  onRefresh,
  user,
  setIsSaving,
  setIsSaveSuccess,
  isSaving = false,
  isSuccess = false,
  onFinished,
}: {
  shop: Shop;
  onRefresh: () => void;
  user: User | null;
  setIsSaving: (val: boolean) => void;
  setIsSaveSuccess: (val: boolean) => void;
  isSaving?: boolean;
  isSuccess?: boolean;
  onFinished?: () => void;
}) => {
  const [uploadingType, setUploadingType] = useState<"logo" | null>(null);
  const [showMapPinConfirm, setShowMapPinConfirm] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [operatingHours, setOperatingHours] = useState({
    open: shop.operating_hours?.open || "08:00",
    close: shop.operating_hours?.close || "20:00",
  });
  const [formData, setFormData] = useState({
    name: shop.name || "",
    description: shop.description || "",
    location: shop.location || "",
    city: shop.city || parseAndNormalizeZAAddress(shop.location || "Tembisa").city,
    category: shop.category || "Restaurant",
    phone: shop.phone || "",
    email: shop.email || "",
    instagram: shop.instagram || "",
    facebook: shop.facebook || "",
    whatsapp: shop.whatsapp || "",
    logo_url: shop.logo_url || "",
    lat: shop.lat || -25.9964,
    lng: shop.lng || 28.2268,
  });

  const prevShopRef = useRef<{
    id?: string | number;
    name?: string;
    description?: string;
    location?: string;
    city?: string;
    category?: string;
    phone?: string;
    email?: string;
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
    logo_url?: string;
    lat?: number;
    lng?: number;
    operating_hours?: { open: string; close: string };
  }>({});

  // Keep formData in sync when the parent shop updates without triggering infinite loops
  useEffect(() => {
    if (!shop) return;
    const prev = prevShopRef.current;
    const hasChanged =
      prev.id !== shop.id ||
      prev.name !== shop.name ||
      prev.description !== shop.description ||
      prev.location !== shop.location ||
      prev.city !== shop.city ||
      prev.category !== shop.category ||
      prev.phone !== shop.phone ||
      prev.email !== shop.email ||
      prev.instagram !== shop.instagram ||
      prev.facebook !== shop.facebook ||
      prev.whatsapp !== shop.whatsapp ||
      prev.logo_url !== shop.logo_url ||
      prev.lat !== shop.lat ||
      prev.lng !== shop.lng ||
      prev.operating_hours?.open !== shop.operating_hours?.open ||
      prev.operating_hours?.close !== shop.operating_hours?.close;

    if (hasChanged) {
      prevShopRef.current = {
        id: shop.id,
        name: shop.name,
        description: shop.description,
        location: shop.location,
        city: shop.city,
        category: shop.category,
        phone: shop.phone,
        email: shop.email,
        instagram: shop.instagram,
        facebook: shop.facebook,
        whatsapp: shop.whatsapp,
        logo_url: shop.logo_url,
        lat: shop.lat,
        lng: shop.lng,
        operating_hours: shop.operating_hours,
      };

      setOperatingHours({
        open: shop.operating_hours?.open || "08:00",
        close: shop.operating_hours?.close || "20:00",
      });

      setFormData({
        name: shop.name || "",
        description: shop.description || "",
        location: shop.location || "",
        city: shop.city || parseAndNormalizeZAAddress(shop.location || "Tembisa").city,
        category: shop.category || "Restaurant",
        phone: shop.phone || "",
        email: shop.email || "",
        instagram: shop.instagram || "",
        facebook: shop.facebook || "",
        whatsapp: shop.whatsapp || "",
        logo_url: shop.logo_url || "",
        lat: shop.lat || -25.9964,
        lng: shop.lng || 28.2268,
      });
    }
  }, [
    shop?.id,
    shop?.name,
    shop?.description,
    shop?.location,
    shop?.city,
    shop?.category,
    shop?.phone,
    shop?.email,
    shop?.instagram,
    shop?.facebook,
    shop?.whatsapp,
    shop?.logo_url,
    shop?.lat,
    shop?.lng,
    shop?.operating_hours,
  ]);

  const syncAnalysis = useMemo(() => {
    return analyzeLocationSync(
      formData.lat || -25.9964,
      formData.lng || 28.2268,
      formData.city || "Tembisa",
      shop?.delivery_radius_km || 10,
      shop?.delivery_radius_enabled ?? true
    );
  }, [formData.lat, formData.lng, formData.city, shop?.delivery_radius_km, shop?.delivery_radius_enabled]);

  const handleUpdateLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      setIsLocating(false);
      setShowMapPinConfirm(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          let data = null;
          let retryCount = 0;
          const maxRetries = 2;

          while (retryCount <= maxRetries) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 3000);
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&email=aviwenotununu4@gmail.com`,
                { signal: controller.signal }
              );
              clearTimeout(timeout);
              if (response.ok) {
                data = await response.json();
                break;
              }
              retryCount++;
            } catch {
              retryCount++;
              if (retryCount > maxRetries) break;
              await new Promise((r) => setTimeout(r, 600));
            }
          }

          if (data && (data.address || data.display_name)) {
            const raw = data.display_name || [data.address?.house_number, data.address?.road, data.address?.city, data.address?.state].filter(Boolean).join(", ");
            const { formattedAddress, city } = parseAndNormalizeZAAddress(raw);

            setFormData((prev) => ({
              ...prev,
              location: formattedAddress,
              city: city,
              lat: latitude,
              lng: longitude,
            }));
            toast.success("Location updated successfully!");
          } else {
            toast.error("Could not determine address from coordinates.");
          }
        } catch {
          toast.error("Failed to get address details.");
        } finally {
          setIsLocating(false);
          setShowMapPinConfirm(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error(
          `Location access failed: ${error.message || "Please check permissions"}`,
        );
        setIsLocating(false);
        setShowMapPinConfirm(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 },
    );
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    const phoneCleaned = formData.phone.replace(/[\s-]/g, "");
    const whatsappCleaned = (formData.whatsapp || "").replace(/[\s-]/g, "");
    const saRegex = /^(?:\+27|0)[0-9]{9}$/;

    if (!saRegex.test(phoneCleaned)) {
      toast.error("Please enter a valid phone number (like 082 123 4567)");
      return;
    }
    if (formData.whatsapp && !saRegex.test(whatsappCleaned)) {
      toast.error("Please enter a valid WhatsApp number (like 082 123 4567)");
      return;
    }

    setIsSaving(true);
    setIsSaveSuccess(false);

    // Versioning & updated_at check to prevent overwriting cloud state with stale local state
    try {
      const { data: remoteShop } = await supabase
        .from("shops")
        .select("updated_at")
        .eq("id", shop.id)
        .maybeSingle();

      const remoteShopData = remoteShop as { updated_at?: string } | null;
      if (remoteShopData?.updated_at && shop.updated_at) {
        const remoteTime = new Date(remoteShopData.updated_at).getTime();
        const localTime = new Date(shop.updated_at).getTime();
        if (remoteTime > localTime + 2000) {
          toast.error("Cloud shop profile updated in another session. Syncing latest state to prevent overwrite.", {
            description: `Remote version (${new Date(remoteShopData.updated_at).toLocaleTimeString()}) is newer than local state.`,
            duration: 5000,
          });
          setIsSaving(false);
          onRefresh();
          return;
        }
      }
    } catch (versionErr) {
      console.warn("Versioning check skipped due to network or schema cache warning:", versionErr);
    }

    const finalCity = formData.city || parseAndNormalizeZAAddress(formData.location || "Tembisa").city;
    const nowISO = new Date().toISOString();

    const payload: Record<string, unknown> = {
      ...formData,
      operating_hours: operatingHours,
      city: finalCity,
      updated_at: nowISO,
    };

    // 1. Update Firestore Shop document immediately so client app and subscriptions sync in real time
    try {
      await updateFirestoreShop(shop.id, {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        address: formData.location,
        city: finalCity,
        category: formData.category,
        phone: formData.phone,
        email: formData.email,
        instagram: formData.instagram,
        facebook: formData.facebook,
        whatsapp: formData.whatsapp,
        logo_url: formData.logo_url,
        lat: formData.lat,
        lng: formData.lng,
        operating_hours: operatingHours,
        updated_at: nowISO,
      });
    } catch (fsErr) {
      console.warn("Firestore shop update warning:", fsErr);
    }

    // 2. Update local cached shops storage
    try {
      const cached = localStorage.getItem("localeats_cached_shops");
      if (cached) {
        const parsed: Shop[] = JSON.parse(cached);
        const updated = parsed.map((s) =>
          s.id === shop.id
            ? {
                ...s,
                ...formData,
                operating_hours: operatingHours,
                address: formData.location,
                city: finalCity,
                updated_at: nowISO,
              }
            : s
        );
        localStorage.setItem("localeats_cached_shops", JSON.stringify(updated));
      }
    } catch {
      // ignore
    }

    try {
      // First attempt on Supabase
      let { error } = await supabase
        .from("shops")
        .update(payload)
        .eq("id", shop.id);

      // If it's a "column does not exist" error or schema cache error, try to heal
      const errObj = error as { code?: string; message?: string } | null;
      if (errObj && (errObj.code === "42703" || errObj.message?.includes("column") || errObj.message?.includes("schema cache"))) {
        console.warn("Some columns do not exist in the shops table. Attempting to strip unknown columns...", errObj.message);
        // List of columns that might not exist in an older schema
        const optionalCols = ["city", "whatsapp", "instagram", "facebook", "lat", "lng", "location_details", "email", "updated_at"];
        optionalCols.forEach((col) => delete payload[col]);

        // Try again with safe payload
        let retry = await supabase
          .from("shops")
          .update(payload)
          .eq("id", shop.id);

        if (retry.error) {
          // Fallback to essential baseline columns only
          const fallbackPayload = {
            name: formData.name,
            description: formData.description,
            location: formData.location,
            phone: formData.phone,
            category: formData.category,
            logo_url: formData.logo_url,
          };
          retry = await supabase
            .from("shops")
            .update(fallbackPayload)
            .eq("id", shop.id);
        }

        error = retry.error as unknown as typeof error;
      }

      if (error) throw error;

      // Sync back to user metadata so phone numbers and locations are consistent throughout the app
      if (user && (formData.phone || formData.whatsapp || formData.location)) {
        try {
          await supabase.auth.updateUser({
            data: {
              phone: formData.phone,
              whatsapp: formData.whatsapp,
              location: formData.location,
              address: formData.location,
              city: finalCity,
            }
          });
        } catch (authErr) {
          console.warn("User auth metadata update skipped:", authErr);
        }

        // Also sync to rider profile if it exists
        try {
          await supabase
            .from("rider_profiles")
            .update({
              phone: formData.phone,
              city: finalCity,
              updated_at: new Date().toISOString()
            })
            .eq("id", user.id);
        } catch (riderErr) {
          console.warn("Rider profile update skipped:", riderErr);
        }
      }

      setIsSaving(false);
      setIsSaveSuccess(true);

      setTimeout(() => {
        setIsSaveSuccess(false);
        toast.success("Shop profile updated successfully!");
        onRefresh();
        if (onFinished) onFinished();
      }, 1200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setIsSaving(false);
      setIsSaveSuccess(false);
      handleCentralizedError(err, "Shop Profile Update", "Failed to update profile");
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo",
  ) => {
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingType(type);
    try {
      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);

      const fileExt = compressedFile.name.split(".").pop() || "jpg";
      const fileName = `${shop.id}-${type}-${Date.now()}.${fileExt}`;

      const publicUrl = await uploadImageToFirebaseStorage(compressedFile, "shop-assets", fileName);

      setFormData((prev) => ({
        ...prev,
        logo_url: publicUrl,
      }));

      toast.success("Logo uploaded! Save to apply changes.");
    } catch (err: unknown) {
      toast.error(
        `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setUploadingType(null);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-24 md:pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight">
            Storefront Profile
          </h2>
          <p className="text-xs md:text-sm text-on-surface-variant font-medium">
            Customize how your shop appears to customers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "px-3 md:px-4 py-1.5 md:py-2 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-widest flex items-center gap-2",
              shop.is_active
? "bg-emerald-100 text-emerald-600"
                : "bg-error/10 text-error",
            )}
          >
            <div
              className={cn(
                "w-1.5 md:w-2 h-1.5 md:h-2 rounded-full",
                shop.is_active ? "bg-emerald-500 animate-pulse" : "bg-error",
              )}
            />
            {shop.is_active ? "Live on App" : "Hidden"}
          </div>
        </div>
      </header>

      <form
        onSubmit={handleUpdate}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8"
      >
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-surface-container-lowest p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-outline-variant/10 shadow-sm space-y-6">
            <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
              <Store size={18} className="text-primary md:w-5 md:h-5" />
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Primary Location (City / Township)
                </label>
                <select
                  className="w-full h-10 md:h-12 px-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all text-sm md:text-base font-bold text-on-surface"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                >
                  <option value="Tembisa">Tembisa</option>
                  <option value="Kaalfontein">Kaalfontein</option>
                  <option value="Ivory Park">Ivory Park</option>
                  <option value="Ebony Park">Ebony Park</option>
                  <option value="Clayville">Clayville</option>
                  <option value="Rabie Ridge">Rabie Ridge</option>
                  <option value="Midrand">Midrand</option>
                  <option value="Kempton Park">Kempton Park</option>
                  <option value="Johannesburg">Johannesburg</option>
                  <option value="Pretoria">Pretoria</option>
                  <option value="Cape Town">Cape Town</option>
                  {formData.city && !["Tembisa", "Kaalfontein", "Ivory Park", "Ebony Park", "Clayville", "Rabie Ridge", "Midrand", "Kempton Park", "Johannesburg", "Pretoria", "Cape Town"].includes(formData.city) && (
                    <option value={formData.city}>{formData.city}</option>
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Shop Name
                </label>
                <input
                  className="w-full h-10 md:h-12 px-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all text-sm md:text-base font-bold text-on-surface"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Category
                </label>
                <select
                  className="w-full h-10 md:h-12 px-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all text-sm md:text-base"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                >
                  <option>Restaurant</option>
                  <option>Bakery</option>
                  <option>Cafe</option>
                  <option>Street Food</option>
                  <option>Home Kitchen</option>
                </select>
              </div>
              <div className="space-y-2 opacity-50 grayscale pointer-events-none">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Unique Shop ID
                </label>
                <div className="w-full h-10 md:h-12 px-4 rounded-xl bg-surface-container-low flex items-center text-xs font-mono">
                  #LE-SHP-{shop.id}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                Description
              </label>
              <textarea
                className="w-full p-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all min-h-[80px] md:min-h-[100px] text-sm md:text-base"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Location Address
                </label>
                <button
                  type="button"
                  onClick={() => setShowMapPinConfirm(true)}
                  className="text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
                >
                  <MapPin size={12} />
                  Update Map Pin
                </button>
              </div>
              <div className="relative">
                <MapPin
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 md:w-[18px] md:h-[18px]"
                />
                <input
                  className="w-full h-10 md:h-12 pl-10 md:pl-12 pr-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all text-sm md:text-base"
                  value={formData.location}
                  onChange={(e) => {
                    const val = e.target.value;
                    const parsed = parseAndNormalizeZAAddress(val);
                    setFormData({
                      ...formData,
                      location: val,
                      city: parsed.city || formData.city,
                    });
                  }}
                  placeholder="Enter your shop address..."
                />
              </div>
              <div className="mt-4 rounded-2xl overflow-hidden border border-outline-variant/10 h-48 md:h-64 bg-surface-container-low relative group z-0">
                <LeafletMap
                  center={{ lat: formData.lat || -25.9964, lng: formData.lng || 28.2268 }}
                  zoom={13}
                  deliveryRadiusKm={shop?.delivery_radius_km || 10}
                  deliveryRadiusEnabled={shop?.delivery_radius_enabled ?? true}
                  onLocationSelect={(lat, lng) => {
                    setFormData((prev) => ({ ...prev, lat, lng }));
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 3000);
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
                          const raw = data.display_name || [data.address?.house_number, data.address?.road, data.address?.city, data.address?.state].filter(Boolean).join(", ");
                          const { formattedAddress, city: detectedCity } = parseAndNormalizeZAAddress(raw);
                          setFormData((prev) => ({
                            ...prev,
                            location: formattedAddress || prev.location,
                            city: detectedCity || prev.city,
                          }));
                        }
                      })
                      .catch(() => {});
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMapPinConfirm(true);
                  }}
                  className="absolute bottom-4 right-4 z-[40] bg-surface-container-lowest/90 backdrop-blur-md px-4 py-2 rounded-full shadow-md hover:scale-105 hover:bg-surface-container-lowest transition-all cursor-pointer flex items-center gap-2 border border-outline-variant/20"
                >
                  <MapPin size={14} className="text-primary" />
                  <span className="text-[10px] font-bold text-primary">
                    AUTO-LOCATE
                  </span>
                </button>
              </div>

              {/* Real-time Location Sync Status Indicator */}
              <div className="pt-2">
                <LocationSyncIndicator
                  locationState={{
                    lat: formData.lat || -25.9964,
                    lng: formData.lng || 28.2268,
                    address: formData.location || "",
                    city: formData.city || "Tembisa",
                    deliveryRadiusKm: shop?.delivery_radius_km || 10,
                    deliveryRadiusEnabled: shop?.delivery_radius_enabled ?? true,
                  }}
                  syncAnalysis={syncAnalysis}
                  isLocating={isLocating}
                  onDetectGPS={handleUpdateLocation}
                  onAutoAlign={() => {
                    setFormData((prev) => ({
                      ...prev,
                      city: syncAnalysis.closestHubName,
                    }));
                    toast.success(`Area filter updated to ${syncAnalysis.closestHubName}!`);
                  }}
                />
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-outline-variant/10 shadow-sm space-y-6">
            <h3 className="text-base md:text-lg font-bold flex items-center gap-2">
              <Phone size={18} className="text-primary md:w-5 md:h-5" />
              Contact & Socials
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="flex items-center justify-between text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  <span>Phone Number</span>
                  {!formData.phone && (
                    <span className="flex items-center gap-1 text-[10px] text-error animate-pulse">
                      <AlertCircle size={10} /> Missing
                    </span>
                  )}
                </label>
                <input
                  className={cn(
                    "w-full h-10 md:h-12 px-4 rounded-xl border-none focus:ring-2 transition-all text-sm md:text-base font-bold text-on-surface",
                    !formData.phone ? "bg-error/5 ring-1 ring-error/20" : "bg-surface-container-low focus:ring-primary/40"
                  )}
                  value={formData.phone}
                  onChange={(e) => {
                    const result = formatSAPhone(e.target.value);
                    setFormData({ ...formData, phone: result.formatted });
                  }}
                  placeholder="e.g. +27 82 123 4567"
                />
                <p className="text-[10px] text-on-surface-variant/60 ml-1 italic font-medium">Used for direct customer calls.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Email Address
                </label>
                <input
                  className="w-full h-10 md:h-12 px-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all text-sm md:text-base font-bold text-on-surface"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
                <p className="text-[10px] text-on-surface-variant/60 ml-1 italic font-medium">Used for order receipts & business updates.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1 flex items-center gap-1">
                  <Instagram size={12} /> Instagram
                </label>
                <input
                  placeholder="@username"
                  className="w-full h-10 px-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all text-sm font-bold text-on-surface"
                  value={formData.instagram}
                  onChange={(e) =>
                    setFormData({ ...formData, instagram: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1 flex items-center gap-1">
                  <Facebook size={12} /> Facebook
                </label>
                <input
                  placeholder="page name"
                  className="w-full h-10 px-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary/40 transition-all text-sm font-bold text-on-surface"
                  value={formData.facebook}
                  onChange={(e) =>
                    setFormData({ ...formData, facebook: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between text-[10px] md:text-xs font-primary ml-1 font-black uppercase">
                  <span className="flex items-center gap-1 text-primary"><MessageCircle size={12} /> WhatsApp (Critical)</span>
                  {!formData.whatsapp && (
                    <span className="flex items-center gap-1 text-[10px] text-error animate-pulse">
                      <AlertCircle size={10} /> Required
                    </span>
                  )}
                </label>
                <input
                  placeholder="WhatsApp number"
                  className={cn(
                    "w-full h-10 px-4 rounded-xl border focus:ring-2 transition-all text-sm font-black text-on-surface",
                    !formData.whatsapp ? "bg-error/5 border-error/50 ring-error/20" : "bg-primary/5 border-primary/20 focus:ring-primary/40"
                  )}
                  value={formData.whatsapp}
                  onChange={(e) => {
                    const result = formatSAPhone(e.target.value);
                    setFormData({ ...formData, whatsapp: result.formatted });
                  }}
                />
                <p className="text-[10px] text-primary/60 ml-1 italic font-bold">This is how customers will contact you on WhatsApp.</p>
              </div>
            </div>
          </section>

          {/* Operating Hours Section */}
          <section className="bg-surface-container-lowest p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-outline-variant/10 shadow-sm space-y-6">
            <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
              <Clock size={18} className="text-primary md:w-5 md:h-5" />
              Operating Hours
            </h3>
            <p className="text-xs text-on-surface-variant">
              Set when your store is open for receiving and preparing customer orders.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Opening Time
                </label>
                <input
                  type="time"
                  className="w-full h-10 px-4 rounded-xl bg-surface-container-low border border-outline-variant/20 focus:border-primary/40 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-bold text-on-surface cursor-pointer"
                  value={operatingHours.open}
                  onChange={(e) =>
                    setOperatingHours({ ...operatingHours, open: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Closing Time
                </label>
                <input
                  type="time"
                  className="w-full h-10 px-4 rounded-xl bg-surface-container-low border border-outline-variant/20 focus:border-primary/40 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-bold text-on-surface cursor-pointer"
                  value={operatingHours.close}
                  onChange={(e) =>
                    setOperatingHours({ ...operatingHours, close: e.target.value })
                  }
                />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {/* Live Preview Card */}
          <div className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/10 shadow-sm overflow-hidden hidden lg:block">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-4 ml-1">
              Live App Preview
            </h3>
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-surface-container-low mb-4 shadow-inner">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-primary/10" />
              <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
                <div className="w-12 h-12 rounded-xl bg-white shadow-lg shrink-0 overflow-hidden flex items-center justify-center">
                  {!isPlaceholderImage(formData.logo_url) ? (
                    <img
                      src={formData.logo_url!}
                      className="w-full h-full object-cover"
                      alt="Logo"
                    />
                  ) : (
                    <img
                      src={DEFAULT_SHOP_LOGO}
                      className="w-full h-full object-cover opacity-80"
                      alt="Default Logo"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold text-lg leading-tight truncate">
                    {formData.name || "Shop Name"}
                  </h4>
                  <div className="flex items-center gap-1 text-white/70 text-[10px] truncate">
                    <MapPin size={10} />
                    {formData.location || "Location"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from("shop_followers")
                        .insert({ shop_id: shop.id, user_id: user?.id });
                      if (error) throw error;
                      toast.success("You are now following this shop! (Test)");
                      onRefresh();
                    } catch {
                      toast.error("Failed to follow shop. (Test)");
                    }
                  }}
                  className="px-3 py-1 bg-primary text-white text-[10px] font-bold rounded-full shadow-lg hover:bg-primary/90 transition-colors"
                >
                  Follow
                </button>
              </div>
            </div>
            <p className="text-[10px] text-on-surface-variant text-center italic leading-tight">
              This is how your shop card appears to customers in the LocalEats
              app.
            </p>
          </div>

          <section className="bg-surface-container-lowest p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-outline-variant/10 shadow-sm space-y-6">
            <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
              <ImageIcon size={18} className="text-primary md:w-5 md:h-5" />
              Visuals
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold uppercase text-on-surface-variant/60 ml-1">
                  Shop Logo
                </label>
                <div className="relative group">
                  <div className="w-16 md:w-24 h-16 md:h-24 rounded-2xl bg-surface-container-low overflow-hidden border-2 border-dashed border-outline-variant/20 flex items-center justify-center">
                    {uploadingType === "logo" ? (
                      <RefreshCw
                        className="animate-spin text-primary"
                        size={24}
                      />
                    ) : !isPlaceholderImage(formData.logo_url) ? (
                      <img
                        src={formData.logo_url!}
                        className="w-full h-full object-cover"
                        alt="Logo"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{
                          background:
                            "linear-gradient(135deg, #ff9d42 0%, #f58220 100%)",
                        }}
                      >
                        <Store
                          size={32}
                          className="text-white drop-shadow-md"
                          strokeWidth={1.5}
                        />
                      </div>
                    )}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl cursor-pointer">
                    <Upload size={18} className="md:w-5 md:h-5" />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, "logo")}
                      disabled={!!uploadingType}
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={isSaving || isSuccess}
            className={cn(
              "w-full py-3 md:py-4 text-on-primary font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2",
              isSuccess
                ? "bg-emerald-500 shadow-emerald-500/20 hover:scale-[0.98] active:scale-95"
                : isSaving 
                  ? "bg-surface-container-highest cursor-not-allowed text-on-surface-variant shadow-none" 
                  : "bg-primary shadow-primary/20 hover:scale-[0.98] active:scale-95"
            )}
          >
            {isSuccess ? (
              <>
                <Check size={18} strokeWidth={3} />
                Saved Successfully!
              </>
            ) : isSaving ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Saving Changes...
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>

      <AnimatePresence>
        {showMapPinConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-outline-variant/20"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6 mx-auto">
                <MapPin size={32} />
              </div>
              <h3 className="text-2xl font-headline font-bold text-on-surface text-center mb-3">
                Update Location?
              </h3>
              <p className="text-on-surface-variant text-center mb-8 leading-relaxed">
                This will request your device's current location and
                automatically update your shop's address. Are you sure you want
                to proceed?
              </p>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowMapPinConfirm(false)}
                  disabled={isLocating}
                  className="flex-1 py-3.5 px-4 rounded-2xl font-bold text-on-surface-variant bg-surface-container-high hover:bg-surface-container-highest transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateLocation}
                  disabled={isLocating}
                  className="flex-1 py-3.5 px-4 rounded-2xl font-bold text-on-primary bg-primary hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLocating ? (
                    <>
                      <RefreshCw className="animate-spin" size={18} />
                      <span>Locating...</span>
                    </>
                  ) : (
                    <span>Yes, Update</span>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

