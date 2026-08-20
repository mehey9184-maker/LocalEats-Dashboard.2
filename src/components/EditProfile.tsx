import React, { useState, useRef } from "react";
import {
  ArrowLeft,
  MoreVertical,
  RefreshCw,
  Edit2,
  AlertCircle,
  Sparkles,
  Bell,
  Moon,
  Check,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Upload,
  User as UserIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { uploadImageToFirebaseStorage } from "../lib/firebase";
import { formatSAPhone } from "../utils";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { LeafletMap } from "./LeafletMap";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!validTypes.includes(file.type)) {
    return {
      isValid: false,
      error: "Invalid file type. Please upload a JPEG, PNG, WEBP, or GIF image.",
    };
  }
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: "File size exceeds 5MB limit. Please choose a smaller image.",
    };
  }
  return { isValid: true };
};

export interface ProfileData {
  fullName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  location: string;
  city?: string;
  address: string;
  lat?: number;
  lng?: number;
  operatingHours: { open: string; close: string };
  marketing?: boolean;
  darkMode?: boolean;
  avatarUrl?: string;
}

export interface EditProfileProps {
  onBack: () => void;
  onSave: (data: ProfileData) => void;
  initialData: ProfileData;
  userId: string;
  isSaving?: boolean;
  isSuccess?: boolean;
}

export const EditProfile: React.FC<EditProfileProps> = ({
  onBack,
  onSave,
  initialData,
  userId,
  isSaving = false,
  isSuccess = false,
}) => {
  const [formData, setFormData] = useState({
    fullName: initialData?.fullName || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    whatsapp: initialData?.whatsapp || "",
    location: initialData?.location || "",
    city: initialData?.city || "Tembisa",
    address: initialData?.address || "",
    lat: initialData?.lat || -25.9964,
    lng: initialData?.lng || 28.2268,
    avatarUrl: initialData?.avatarUrl || "",
  });

  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMapPinConfirm, setShowMapPinConfirm] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

          if (data && data.address) {
            const city =
              data.address.city ||
              data.address.town ||
              data.address.village ||
              data.address.suburb ||
              "";
            const state = data.address.state || "";
            const road = data.address.road || "";
            const houseNumber = data.address.house_number || "";

            const newLocation = [city, state].filter(Boolean).join(", ");
            const newAddress = [houseNumber, road].filter(Boolean).join(" ");

            setFormData((prev) => ({
              ...prev,
              location: newLocation || prev.location,
              address: newAddress || prev.address,
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

  const uploadShopPhoto = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || "Invalid image file");
      return;
    }

    try {
      setUploading(true);

      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);

      const fileExt = compressedFile.name.split(".").pop() || "jpg";
      const fileName = `${userId}-${Date.now()}.${fileExt}`;

      const publicUrl = await uploadImageToFirebaseStorage(compressedFile, "avatars", fileName);

      setFormData((prev) => ({ ...prev, avatarUrl: publicUrl }));

      toast.success("Photo uploaded successfully!");
    } catch (error: unknown) {
      console.error("Upload Error:", error);
      toast.error(
        "Failed to upload photo. Please check your storage connection.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadShopPhoto(file);
    e.target.value = "";
  };

  const [operatingHours, setOperatingHours] = useState({
    open: initialData?.operatingHours?.open || "08:00",
    close: initialData?.operatingHours?.close || "20:00",
  });

  const [preferences, setPreferences] = useState({
    marketing: initialData?.marketing ?? true,
    darkMode: initialData?.darkMode ?? false,
  });

  const handleSave = () => {
    const phoneCleaned = formData.phone.replace(/[\s-]/g, "");
    const whatsappCleaned = (formData.whatsapp || "").replace(/[\s-]/g, "");

    const saRegex = /^(?:\+27|0)[0-9]{9}$/;

    if (!saRegex.test(phoneCleaned)) {
      toast.error("Please enter a valid South African phone number for calls (e.g., +27 82 123 4567 or 082 123 4567).");
      return;
    }

    if (formData.whatsapp && !saRegex.test(whatsappCleaned)) {
      toast.error("Please enter a valid WhatsApp number (like 082 123 4567).");
      return;
    }

    onSave({ ...formData, ...preferences, operatingHours });
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface pb-24 selection:bg-primary/10 selection:text-primary">
      <header className="fixed top-0 w-full z-50 bg-surface/70 backdrop-blur-xl shadow-sm shadow-primary/5">
        <div className="flex items-center justify-between px-6 h-16 w-full max-w-screen-xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="active:scale-95 transition-transform duration-200 hover:opacity-80 p-2 rounded-full hover:bg-surface-container-low"
            >
              <ArrowLeft className="text-primary" size={24} />
            </button>
            <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">
              Edit Profile
            </h1>
          </div>
          <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-low transition-colors">
            <MoreVertical className="text-on-surface-variant" size={24} />
          </button>
        </div>
        <div className="bg-surface-container-low h-[1px] w-full absolute bottom-0 opacity-15"></div>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-10">
        <section className="flex flex-col items-center">
          <div
            className={cn(
              "relative group rounded-full p-1.5 transition-all duration-300",
              isDragOver ? "ring-4 ring-primary ring-offset-4 dark:ring-offset-zinc-950 scale-105 bg-primary/10" : ""
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                await uploadShopPhoto(file);
              }
            }}
          >
            <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-surface-container-lowest shadow-lg bg-surface-container-low flex items-center justify-center relative">
              {uploading ? (
                <RefreshCw className="animate-spin text-primary" size={32} />
              ) : formData.avatarUrl ? (
                <img
                  alt="Profile"
                  className="w-full h-full object-cover"
                  src={formData.avatarUrl}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center bg-primary"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 30%, #ff9d4d 0%, #f58220 100%)",
                  }}
                >
                  <UserIcon
                    size={64}
                    className="text-white drop-shadow-md"
                    strokeWidth={1.5}
                  />
                </div>
              )}
              {isDragOver && (
                <div className="absolute inset-0 bg-primary/80 flex flex-col items-center justify-center text-white text-[10px] font-bold text-center p-2 backdrop-blur-xs">
                  <Upload size={20} className="mb-1 animate-bounce" />
                  Drop to upload
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-1 right-1 bg-gradient-to-br from-primary to-primary-container p-2.5 rounded-full text-on-primary shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            >
              <Edit2 size={16} />
            </button>
          </div>
          <p className="mt-4 font-headline font-bold text-on-surface-variant tracking-tight text-xs flex items-center gap-1.5">
            {isDragOver ? "Drop image now" : "Change Photo (Drag & Drop or Click)"}
          </p>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
              Personal Details
            </h2>
            <span className="text-xs font-label text-primary font-bold tracking-widest uppercase px-2 py-1 bg-primary/10 rounded-full">
              Basic Info
            </span>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">
                Full Name
              </label>
              <input
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface"
                type="text"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">
                Email Address
              </label>
              <input
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm font-medium text-on-surface-variant px-1">
                <span>Phone Number</span>
                {!formData.phone && (
                  <span className="flex items-center gap-1 text-[10px] text-error font-bold uppercase animate-pulse">
                    <AlertCircle size={12} /> Required
                  </span>
                )}
              </label>
              <input
                className={cn(
                  "w-full border-none rounded-xl px-4 py-3.5 focus:ring-2 transition-all text-on-surface",
                  !formData.phone ? "bg-error/5 ring-1 ring-error/20" : "bg-surface-container-low focus:ring-primary/40 focus:bg-surface-container-lowest"
                )}
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  const result = formatSAPhone(e.target.value);
                  setFormData({ ...formData, phone: result.formatted });
                }}
                placeholder="e.g. +27 82 123 4567"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm font-medium text-on-surface-variant px-1">
                <span>WhatsApp Number (for Customers)</span>
                {!formData.whatsapp && (
                  <span className="flex items-center gap-1 text-[10px] text-error font-bold uppercase animate-pulse">
                    <AlertCircle size={12} /> Critical
                  </span>
                )}
              </label>
              <input
                className={cn(
                  "w-full border-none rounded-xl px-4 py-3.5 focus:ring-2 transition-all text-on-surface",
                  !formData.whatsapp ? "bg-error/5 ring-1 ring-error/20" : "bg-surface-container-low focus:ring-primary/40 focus:bg-surface-container-lowest"
                )}
                type="tel"
                value={formData.whatsapp}
                onChange={(e) => {
                  const result = formatSAPhone(e.target.value);
                  setFormData({ ...formData, whatsapp: result.formatted });
                }}
                placeholder="e.g. +27 82 123 4567"
              />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
              Home Location
            </h2>
            <span className="text-xs font-label text-primary font-bold tracking-widest uppercase px-2 py-1 bg-primary/10 rounded-full">
              Address
            </span>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">
                Primary Operating City
              </label>
              <select
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface font-bold"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
              >
                <option value="Tembisa">Tembisa</option>
                <option value="Kaalfontein">Kaalfontein</option>
                <option value="Ivory Park">Ivory Park</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">
                Search & Set Location
              </label>
              <AddressAutocomplete
                value={formData.address || formData.location}
                onChange={(val) => setFormData(prev => ({ ...prev, address: val, location: val }))}
                onSelect={(address, city, lat, lng) => {
                  setFormData(prev => ({ ...prev, lat, lng, address, location: address, city }));
                  toast.success("Location pinpointed!");
                }}
                placeholder="Search for your street or area..."
              />
            </div>
          </div>

          <div className="w-full h-48 rounded-xl overflow-hidden relative border border-outline-variant/20">
            <LeafletMap
              center={{ lat: formData.lat || -25.9964, lng: formData.lng || 28.2268 }}
              zoom={13}
              deliveryRadiusKm={10}
              deliveryRadiusEnabled={false}
              onLocationSelect={(lat, lng) => {
                setFormData(prev => ({ ...prev, lat, lng }));
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&email=aviwenotununu4@gmail.com`, { signal: controller.signal })
                  .then(r => {
                    clearTimeout(timeout);
                    return r.ok ? r.json() : null;
                  })
                  .then(data => {
                    if (data && data.address) {
                       const city = data.address.city || data.address.town || data.address.village || data.address.suburb || "";
                       const road = data.address.road || "";
                       const houseNumber = data.address.house_number || "";
                       const newLocation = [city, data.address.state].filter(Boolean).join(", ");
                       const newAddress = [houseNumber, road].filter(Boolean).join(" ");
                       setFormData(prev => ({ 
                         ...prev, 
                         location: newLocation || prev.location,
                         address: newAddress || prev.address
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
              className="absolute bottom-4 right-4 z-30 bg-surface-container-lowest/90 backdrop-blur-md px-4 py-2 rounded-full shadow-md hover:scale-105 hover:bg-surface-container-lowest transition-all cursor-pointer flex items-center gap-2 border border-outline-variant/20"
            >
              <Sparkles size={14} className="text-primary" />
              <span className="text-[10px] font-bold text-primary">
                AUTO-LOCATE
              </span>
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
              Operating Hours
            </h2>
            <span className="text-xs font-label text-primary font-bold tracking-widest uppercase px-2 py-1 bg-primary/10 rounded-full">
              Schedule
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">
                Opening Time
              </label>
              <input
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface"
                type="time"
                value={operatingHours.open}
                onChange={(e) =>
                  setOperatingHours({ ...operatingHours, open: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">
                Closing Time
              </label>
              <input
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface"
                type="time"
                value={operatingHours.close}
                onChange={(e) =>
                  setOperatingHours({
                    ...operatingHours,
                    close: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
            App Preferences
          </h2>
          <div className="bg-surface-container-low rounded-xl overflow-hidden divide-y divide-surface-container-high">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                  <Bell className="text-on-surface-variant" size={20} />
                </div>
                <div>
                  <p className="font-medium text-on-surface">
                    Marketing Notifications
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Deals, offers, and new arrivals
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={preferences.marketing}
                  onChange={() =>
                    setPreferences({
                      ...preferences,
                      marketing: !preferences.marketing,
                    })
                  }
                />
                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                  <Moon className="text-on-surface-variant" size={20} />
                </div>
                <div>
                  <p className="font-medium text-on-surface">Dark Mode</p>
                  <p className="text-xs text-on-surface-variant">
                    Reduce eye strain at night
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={preferences.darkMode}
                  onChange={() =>
                    setPreferences({
                      ...preferences,
                      darkMode: !preferences.darkMode,
                    })
                  }
                />
                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </section>

        <div className="pt-6 pb-12">
          <button
            onClick={handleSave}
            disabled={isSaving || isSuccess}
            className={cn(
              "w-full text-on-primary font-headline font-extrabold text-lg py-5 rounded-full shadow-lg transition-all flex items-center justify-center gap-3",
              isSuccess ? "bg-emerald-500 shadow-emerald-500/20 active:scale-[0.98]"
                : isSaving 
                  ? "bg-surface-container-highest cursor-not-allowed text-on-surface-variant shadow-none" 
                  : "bg-gradient-to-br from-primary to-primary-container shadow-primary/20 active:scale-[0.98]"
            )}
          >
            {isSuccess ? (
              <>
                <span>Saved Successfully!</span>
                <Check size={24} strokeWidth={3} />
              </>
            ) : isSaving ? (
              <>
                <span>Saving Changes...</span>
                <Loader2 className="animate-spin" size={24} />
              </>
            ) : (
              <>
                <span>Save Changes</span>
                <CheckCircle2 size={24} />
              </>
            )}
          </button>
        </div>
      </main>

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
                <ArrowRight size={32} />
              </div>
              <h3 className="text-2xl font-headline font-bold text-on-surface text-center mb-3">
                Update Location?
              </h3>
              <p className="text-on-surface-variant text-center mb-8 leading-relaxed">
                This will request your device's current location and
                automatically update your shop's City/Region and Street Address.
                Are you sure you want to proceed?
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
