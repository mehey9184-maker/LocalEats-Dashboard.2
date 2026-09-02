import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ImagePlus,
  Loader2,
  LocateFixed,
  LogOut,
  MapPin,
  ShieldCheck,
  Store,
} from "lucide-react";
import { uploadImageToCloudinary } from "../lib/cloudinary";
import {
  MerchantApi,
  MerchantApiError,
  MerchantShopCreateInput,
} from "../services/MerchantApi";
import { Shop } from "../types";
import { LeafletMap } from "./LeafletMap";

interface CreateShopOnboardingProps {
  onCreated: (shop: Shop) => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
}

type OnboardingStep = 1 | 2 | 3;
type FieldErrors = Partial<Record<"name" | "category" | "phone" | "location" | "coordinates" | "hours" | "image", string>>;

const categoryOptions = [
  "Fast Food & Takeaway",
  "Restaurant",
  "Kota / Street Food",
  "Bakery",
  "Café",
  "Home Kitchen",
  "Catering",
  "Food Truck / Mobile Vendor",
  "Grocery / Convenience",
  "Butchery",
  "Desserts & Sweets",
  "Other",
] as const;

const hourPresets = [
  { id: "08-20", label: "08:00 – 20:00", opening: "08:00", closing: "20:00" },
  { id: "09-21", label: "09:00 – 21:00", opening: "09:00", closing: "21:00" },
  { id: "10-22", label: "10:00 – 22:00", opening: "10:00", closing: "22:00" },
] as const;

const defaultMapCenter = { lat: -33.9249, lng: 18.4241 };

const initialForm = {
  name: "",
  description: "",
  phone: "",
  location: "",
  latitude: "",
  longitude: "",
  opening_time: "08:00",
  closing_time: "20:00",
  story: "",
};

const formatSouthAfricanPhoneInput = (value: string): string => {
  const usesInternationalFormat = value.trimStart().startsWith("+");
  const digits = value.replace(/\D/g, "");

  if (usesInternationalFormat) {
    const limitedDigits = digits.slice(0, 11);
    if (limitedDigits.length <= 2) return `+${limitedDigits}`;

    const countryCode = limitedDigits.slice(0, 2);
    const nationalNumber = limitedDigits.slice(2);
    const groups = [
      nationalNumber.slice(0, 2),
      nationalNumber.slice(2, 5),
      nationalNumber.slice(5, 9),
    ].filter(Boolean);
    return `+${countryCode} ${groups.join(" ")}`;
  }

  const limitedDigits = digits.slice(0, 10);
  return [
    limitedDigits.slice(0, 3),
    limitedDigits.slice(3, 6),
    limitedDigits.slice(6, 10),
  ].filter(Boolean).join(" ");
};

const normalizeSouthAfricanPhone = (value: string): string | null => {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^0\d{9}$/.test(compact)) return `+27${compact.slice(1)}`;
  if (/^\+27\d{9}$/.test(compact)) return compact;
  return null;
};

type ReverseGeocodeResponse = {
  display_name?: unknown;
  address?: Record<string, unknown>;
};

// Public Nominatim is a low-volume onboarding aid for the current launch. Keep
// this helper isolated so a managed provider can replace it without UI changes.
const reverseGeocodeAddress = async (latitude: number, longitude: number): Promise<string | null> => {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Address lookup failed");

  const data = await response.json() as ReverseGeocodeResponse;
  const address = data.address;
  if (address && typeof address === "object") {
    const readPart = (key: string): string => typeof address[key] === "string" ? address[key] as string : "";
    const street = [readPart("house_number"), readPart("road")].filter(Boolean).join(" ");
    const area = readPart("suburb") || readPart("neighbourhood");
    const place = readPart("town") || readPart("city") || readPart("village") || readPart("municipality");
    const conciseAddress = Array.from(new Set([
      street,
      area,
      place,
      readPart("province"),
      readPart("postcode"),
    ].filter(Boolean))).join(", ");
    if (conciseAddress) return conciseAddress;
  }

  return typeof data.display_name === "string" && data.display_name.trim()
    ? data.display_name.trim()
    : null;
};

export const CreateShopOnboarding: React.FC<CreateShopOnboardingProps> = ({
  onCreated,
  onSignOut,
}) => {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [form, setForm] = useState(initialForm);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [hoursPreset, setHoursPreset] = useState("08-20");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [locationNotice, setLocationNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const addressEditVersionRef = useRef(0);
  const locationRequestRef = useRef(0);

  const category = selectedCategory === "Other" ? customCategory.trim() : selectedCategory;
  const normalizedPhone = useMemo(() => normalizeSouthAfricanPhone(form.phone), [form.phone]);
  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);
  const hasConfirmedLocation = form.latitude !== ""
    && form.longitude !== ""
    && Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90
    && Number.isFinite(longitude)
    && longitude >= -180
    && longitude <= 180;
  const mapCenter = hasConfirmedLocation ? { lat: latitude, lng: longitude } : defaultMapCenter;

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(logoFile);
    setLogoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [logoFile]);

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateField = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const getBusinessErrors = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!form.name.trim()) errors.name = "Enter your shop name.";
    if (!category) errors.category = "Choose what best describes your business.";
    if (!normalizedPhone) {
      errors.phone = "Enter a valid South African phone number, for example 082 123 4567.";
    }
    return errors;
  };

  const getLocationErrors = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!form.location.trim()) errors.location = "Enter your shop address.";
    if (!hasConfirmedLocation) {
      errors.coordinates = "Confirm your shop location using GPS or the map.";
    }
    return errors;
  };

  const continueFromBusiness = () => {
    const errors = getBusinessErrors();
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) {
      setErrorMessage("");
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const continueFromLocation = () => {
    if (isResolvingAddress) return;
    const errors = getLocationErrors();
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) {
      setErrorMessage("");
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goBack = () => {
    setFieldErrors({});
    setErrorMessage("");
    setStep((current) => (current === 3 ? 2 : 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmCoordinates = (nextLatitude: number, nextLongitude: number) => {
    setForm((current) => ({
      ...current,
      latitude: nextLatitude.toFixed(6),
      longitude: nextLongitude.toFixed(6),
    }));
    clearFieldError("coordinates");
    setErrorMessage("");
  };

  const confirmLocationAndAddress = async (nextLatitude: number, nextLongitude: number) => {
    const requestId = ++locationRequestRef.current;
    const addressEditVersion = addressEditVersionRef.current;
    confirmCoordinates(nextLatitude, nextLongitude);
    clearFieldError("location");
    setLocationNotice("");
    setIsResolvingAddress(true);

    try {
      const address = await reverseGeocodeAddress(nextLatitude, nextLongitude);
      if (requestId !== locationRequestRef.current) return;

      if (address && addressEditVersion === addressEditVersionRef.current) {
        setForm((current) => ({ ...current, location: address }));
        clearFieldError("location");
      } else if (!address) {
        setLocationNotice("Location found. Add the shop address so customers can recognize it.");
      }
    } catch {
      if (requestId === locationRequestRef.current) {
        setLocationNotice("Location found. Add the shop address so customers can recognize it.");
      }
    } finally {
      if (requestId === locationRequestRef.current) {
        setIsResolvingAddress(false);
      }
    }
  };

  const useCurrentLocation = () => {
    clearFieldError("coordinates");
    setErrorMessage("");
    if (!navigator.geolocation) {
      setFieldErrors((current) => ({
        ...current,
        coordinates: "We couldn't get your location automatically. Choose your shop location on the map.",
      }));
      setShowMap(true);
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await confirmLocationAndAddress(coords.latitude, coords.longitude);
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setFieldErrors((current) => ({
          ...current,
          coordinates: "We couldn't get your location automatically. Choose your shop location on the map.",
        }));
        setShowMap(true);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const selectHoursPreset = (preset: typeof hourPresets[number]) => {
    setHoursPreset(preset.id);
    clearFieldError("hours");
    setForm((current) => ({
      ...current,
      opening_time: preset.opening,
      closing_time: preset.closing,
    }));
  };

  const getCreateErrorMessage = (error: unknown): string => {
    if (error instanceof MerchantApiError) {
      if (error.status === 400) return "Please review the shop details and try again.";
      if (error.status === 401 || error.status === 403) {
        return "Your session could not be verified. Please sign out and sign in again.";
      }
      if (error.status === 409) {
        return "A shop is already linked to this account, but it could not be refreshed. Please try again.";
      }
    }
    return "We couldn't create your shop right now. Your details are still here, so you can try again.";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreating) return;
    if (step === 1) {
      continueFromBusiness();
      return;
    }
    if (step === 2) {
      continueFromLocation();
      return;
    }

    const businessErrors = getBusinessErrors();
    if (Object.keys(businessErrors).length > 0) {
      setFieldErrors(businessErrors);
      setStep(1);
      return;
    }

    const locationErrors = getLocationErrors();
    if (Object.keys(locationErrors).length > 0) {
      setFieldErrors(locationErrors);
      setStep(2);
      return;
    }

    if (!form.opening_time || !form.closing_time) {
      setFieldErrors({ hours: "Choose your opening and closing times." });
      return;
    }

    if (!logoFile) {
      setFieldErrors({ image: "Add a shop photo or logo." });
      return;
    }

    setFieldErrors({});
    setErrorMessage("");
    setIsCreating(true);
    try {
      const logoUrl = await uploadImageToCloudinary(logoFile);
      const payload: MerchantShopCreateInput = {
        name: form.name.trim(),
        category,
        description: form.description.trim(),
        phone: normalizedPhone as string,
        location: form.location.trim(),
        latitude,
        longitude,
        opening_time: form.opening_time,
        closing_time: form.closing_time,
        logo_url: logoUrl,
        story: form.story.trim(),
      };

      const createdShop = await MerchantApi.createShop(payload);
      await onCreated(createdShop as Shop);
    } catch (error) {
      if (error instanceof MerchantApiError && error.status === 409) {
        try {
          const existingShop = await MerchantApi.getMerchantShop();
          if (existingShop) {
            await onCreated(existingShop as Shop);
            return;
          }
        } catch (recoveryError) {
          setErrorMessage(getCreateErrorMessage(recoveryError));
          return;
        }
      }
      setErrorMessage(getCreateErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  };

  const inputClass =
    "min-h-12 w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-base text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
  const sectionClass =
    "rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm md:p-7";

  return (
    <div className="min-h-screen bg-surface px-4 py-6 text-on-surface md:px-8 md:py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/20 sm:h-14 sm:w-14">
              <Store size={26} />
            </div>
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary sm:text-xs">
                <ShieldCheck size={14} /> Merchant setup
              </p>
              <h1 className="font-headline text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">Create Your Shop</h1>
              <p className="mt-1 text-sm font-medium text-on-surface-variant">Set up your shop profile to continue.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            disabled={isCreating}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-outline-variant/30 px-3 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container disabled:opacity-50 sm:px-4"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
          <div className="mb-3 flex items-center justify-between text-xs font-black uppercase tracking-[0.12em]">
            <span className="text-primary">Step {step} of 3</span>
            <span className="text-on-surface-variant">
              {step === 1 ? "Business" : step === 2 ? "Location" : "Finish"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2" aria-hidden="true">
            {[1, 2, 3].map((progressStep) => (
              <div key={progressStep} className={`h-2 rounded-full ${progressStep <= step ? "bg-primary" : "bg-surface-container-high"}`} />
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <section className={sectionClass}>
              <div className="mb-6">
                <h2 className="font-headline text-2xl font-black">Tell us about your shop</h2>
                <p className="mt-2 text-sm text-on-surface-variant">A few basics will help customers recognize your business.</p>
              </div>

              <div className="space-y-6">
                <label className="block space-y-2 text-sm font-bold">
                  Shop name
                  <input maxLength={100} value={form.name} onChange={(event) => { updateField("name", event.target.value); clearFieldError("name"); }} className={inputClass} aria-invalid={Boolean(fieldErrors.name)} />
                  {fieldErrors.name && <span className="block text-xs font-bold text-error">{fieldErrors.name}</span>}
                </label>

                <fieldset>
                  <legend className="mb-3 text-sm font-bold">What do you sell?</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {categoryOptions.map((option) => (
                      <button key={option} type="button" onClick={() => { setSelectedCategory(option); clearFieldError("category"); }} className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${selectedCategory === option ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/10" : "border-outline-variant/25 bg-surface hover:border-primary/50"}`} aria-pressed={selectedCategory === option}>
                        {option}
                      </button>
                    ))}
                  </div>
                  {selectedCategory === "Other" && (
                    <label className="mt-4 block space-y-2 text-sm font-bold">
                      What best describes your business?
                      <input maxLength={100} value={customCategory} onChange={(event) => { setCustomCategory(event.target.value); clearFieldError("category"); }} className={inputClass} />
                    </label>
                  )}
                  {fieldErrors.category && <span className="mt-2 block text-xs font-bold text-error">{fieldErrors.category}</span>}
                </fieldset>

                <label className="block space-y-2 text-sm font-bold">
                  Short description <span className="font-medium text-on-surface-variant">(optional)</span>
                  <span className="block text-xs font-medium leading-5 text-on-surface-variant">One sentence about what customers can order from you.</span>
                  <textarea maxLength={500} rows={3} value={form.description} onChange={(event) => updateField("description", event.target.value)} className={inputClass} placeholder="Fresh kota, burgers and chips made to order." />
                </label>

                <label className="block space-y-2 text-sm font-bold">
                  Business phone number
                  <span className="block text-xs font-medium leading-5 text-on-surface-variant">We'll use this number for important shop and order communication.</span>
                  <input type="tel" inputMode="tel" maxLength={24} value={form.phone} onChange={(event) => { updateField("phone", formatSouthAfricanPhoneInput(event.target.value)); clearFieldError("phone"); }} className={inputClass} placeholder="082 123 4567" aria-invalid={Boolean(fieldErrors.phone)} />
                  {fieldErrors.phone && <span className="block text-xs font-bold text-error">{fieldErrors.phone}</span>}
                </label>

                <button type="button" onClick={continueFromBusiness} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-on-primary shadow-lg shadow-primary/20">Continue <ArrowRight size={18} /></button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className={sectionClass}>
              <div className="mb-6">
                <h2 className="font-headline text-2xl font-black">Where can customers find you?</h2>
                <p className="mt-2 text-sm text-on-surface-variant">Confirm the place where customers collect orders or deliveries begin.</p>
              </div>

              <div className="space-y-6">
                <label className="block space-y-2 text-sm font-bold">
                  Shop address
                  <span className="block text-xs font-medium leading-5 text-on-surface-variant">Enter the physical place where orders are prepared or collected.</span>
                  <input maxLength={300} value={form.location} onChange={(event) => { addressEditVersionRef.current += 1; updateField("location", event.target.value); setLocationNotice(""); clearFieldError("location"); }} className={inputClass} aria-invalid={Boolean(fieldErrors.location)} />
                  {fieldErrors.location && <span className="block text-xs font-bold text-error">{fieldErrors.location}</span>}
                </label>

                <div>
                  <p className="mb-3 text-sm font-bold">Confirm your shop location</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={useCurrentLocation} disabled={isLocating} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-on-primary disabled:opacity-60">
                      {isLocating ? <><Loader2 size={18} className="animate-spin" /> Finding your location...</> : <><LocateFixed size={18} /> Use my current location</>}
                    </button>
                    <button type="button" onClick={() => setShowMap((current) => !current)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-black text-primary">
                      <MapPin size={18} /> Choose on map
                    </button>
                  </div>

                  {hasConfirmedLocation && <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={18} /> Location confirmed ✓</div>}
                  {isResolvingAddress && <div className="mt-3 flex items-center gap-2 text-xs font-bold text-on-surface-variant"><Loader2 size={15} className="animate-spin" /> Finding a nearby address...</div>}
                  {locationNotice && <span className="mt-3 block text-xs font-bold leading-5 text-on-surface-variant">{locationNotice}</span>}
                  {fieldErrors.coordinates && <span className="mt-3 block text-xs font-bold leading-5 text-error">{fieldErrors.coordinates}</span>}

                  {showMap && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-medium leading-5 text-on-surface-variant">Tap the map or drag the marker to your shop's exact location.</p>
                      <div className="h-64 w-full overflow-hidden rounded-2xl sm:h-72">
                        <LeafletMap center={mapCenter} zoom={hasConfirmedLocation ? 16 : 11} onLocationSelect={(nextLatitude, nextLongitude) => { void confirmLocationAndAddress(nextLatitude, nextLongitude); }} deliveryRadiusEnabled={false} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={goBack} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-outline-variant/30 px-5 py-3 font-black text-on-surface-variant"><ArrowLeft size={18} /> Back</button>
                  <button type="button" onClick={continueFromLocation} disabled={isResolvingAddress} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-on-primary shadow-lg shadow-primary/20 disabled:cursor-wait disabled:opacity-60">Continue <ArrowRight size={18} /></button>
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className={sectionClass}>
              <div className="mb-6">
                <h2 className="font-headline text-2xl font-black">Finish your shop profile</h2>
                <p className="mt-2 text-sm text-on-surface-variant">Review the essentials, then add your hours and shop image.</p>
              </div>

              <div className="mb-6 rounded-2xl border border-outline-variant/15 bg-surface-container p-4">
                <h3 className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant">Your shop</h3>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs font-bold text-on-surface-variant">Shop name</dt><dd className="mt-1 font-black">{form.name.trim()}</dd></div>
                  <div><dt className="text-xs font-bold text-on-surface-variant">Category</dt><dd className="mt-1 font-black">{category}</dd></div>
                  <div><dt className="text-xs font-bold text-on-surface-variant">Phone</dt><dd className="mt-1 font-black">{form.phone}</dd></div>
                  <div><dt className="text-xs font-bold text-on-surface-variant">Address</dt><dd className="mt-1 font-black">{form.location.trim()}</dd></div>
                </dl>
              </div>

              <div className="space-y-7">
                <fieldset>
                  <legend className="mb-3 flex items-center gap-2 text-sm font-bold"><Clock size={18} className="text-primary" /> Opening hours</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {hourPresets.map((preset) => (
                      <button key={preset.id} type="button" onClick={() => selectHoursPreset(preset)} className={`min-h-12 rounded-xl border px-3 py-2 text-xs font-black transition ${hoursPreset === preset.id ? "border-primary bg-primary/10 text-primary" : "border-outline-variant/25"}`}>{preset.label}</button>
                    ))}
                    <button type="button" onClick={() => setHoursPreset("custom")} className={`min-h-12 rounded-xl border px-3 py-2 text-xs font-black transition ${hoursPreset === "custom" ? "border-primary bg-primary/10 text-primary" : "border-outline-variant/25"}`}>Custom</button>
                  </div>
                  {hoursPreset === "custom" && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2 text-sm font-bold">Opening time<input type="time" value={form.opening_time} onChange={(event) => { updateField("opening_time", event.target.value); clearFieldError("hours"); }} className={inputClass} /></label>
                      <label className="space-y-2 text-sm font-bold">Closing time<input type="time" value={form.closing_time} onChange={(event) => { updateField("closing_time", event.target.value); clearFieldError("hours"); }} className={inputClass} /></label>
                    </div>
                  )}
                  {fieldErrors.hours && <span className="mt-2 block text-xs font-bold text-error">{fieldErrors.hours}</span>}
                </fieldset>

                <div>
                  <p className="text-sm font-bold">Shop photo or logo</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-on-surface-variant">Upload your logo, storefront, or a clear photo of your food.</p>
                  <label className="mt-3 flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-outline-variant/30 bg-surface-container text-center hover:border-primary/60">
                    {logoPreview ? <img src={logoPreview} alt="Shop photo or logo preview" className="h-52 w-full object-cover" /> : <><ImagePlus size={30} className="mb-2 text-primary" /><span className="px-3 text-sm font-black">Add a shop photo or logo</span></>}
                    <input type="file" accept="image/*" className="sr-only" onChange={(event) => { setLogoFile(event.target.files?.[0] || null); clearFieldError("image"); }} />
                  </label>
                  {fieldErrors.image && <span className="mt-2 block text-xs font-bold text-error">{fieldErrors.image}</span>}
                </div>

                <label className="block space-y-2 text-sm font-bold">
                  Your story (optional)
                  <span className="block text-xs font-medium leading-5 text-on-surface-variant">Tell customers what makes your shop special. You can also add this later.</span>
                  <textarea maxLength={1000} rows={4} value={form.story} onChange={(event) => updateField("story", event.target.value)} className={inputClass} />
                </label>

                {errorMessage && <div role="alert" className="rounded-2xl border border-error/20 bg-error/5 p-4 text-sm font-bold text-error">{errorMessage}</div>}

                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm font-bold text-on-surface-variant">Your shop will not be visible to customers until LocalEats approves it.</div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={goBack} disabled={isCreating} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-outline-variant/30 px-5 py-3 font-black text-on-surface-variant disabled:opacity-50"><ArrowLeft size={18} /> Back</button>
                  <button type="submit" disabled={isCreating} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-on-primary shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60">
                    {isCreating ? <><Loader2 size={19} className="animate-spin" /> Submitting your shop...</> : "Submit shop for approval"}
                  </button>
                </div>
              </div>
            </section>
          )}
        </form>
      </div>
    </div>
  );
};
