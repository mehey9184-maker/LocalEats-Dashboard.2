import React, { useEffect, useState } from "react";
import {
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

interface CreateShopOnboardingProps {
  onCreated: (shop: Shop) => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
}

const initialForm = {
  name: "",
  category: "",
  description: "",
  phone: "",
  location: "",
  latitude: "",
  longitude: "",
  opening_time: "08:00",
  closing_time: "20:00",
  story: "",
};

export const CreateShopOnboarding: React.FC<CreateShopOnboardingProps> = ({
  onCreated,
  onSignOut,
}) => {
  const [form, setForm] = useState(initialForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(logoFile);
    setLogoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [logoFile]);

  const updateField = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const useCurrentLocation = () => {
    setErrorMessage("");
    if (!navigator.geolocation) {
      setErrorMessage("Location access is not available on this device.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({
          ...current,
          latitude: coords.latitude.toFixed(6),
          longitude: coords.longitude.toFixed(6),
        }));
        setIsLocating(false);
      },
      () => {
        setErrorMessage("We couldn't read your location. Enter the coordinates manually or try again.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
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

    setErrorMessage("");
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setErrorMessage("Enter a valid latitude between -90 and 90.");
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setErrorMessage("Enter a valid longitude between -180 and 180.");
      return;
    }
    if (!logoFile) {
      setErrorMessage("Choose a shop logo before creating your shop.");
      return;
    }

    setIsCreating(true);
    try {
      const logoUrl = await uploadImageToCloudinary(logoFile);
      const payload: MerchantShopCreateInput = {
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        phone: form.phone.trim(),
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
    "w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

  return (
    <div className="min-h-screen bg-surface px-4 py-8 text-on-surface md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/20">
              <Store size={28} />
            </div>
            <div>
              <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <ShieldCheck size={14} /> Merchant setup
              </p>
              <h1 className="font-headline text-3xl font-black tracking-tight md:text-4xl">Create Your Shop</h1>
              <p className="mt-2 text-sm font-medium text-on-surface-variant">
                Set up your shop profile to continue.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            disabled={isCreating}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-outline-variant/30 px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-on-surface-variant">
          Your shop will be submitted for LocalEats approval before it becomes visible to customers.
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm md:p-7">
            <h2 className="mb-5 flex items-center gap-2 font-headline text-lg font-black"><Store size={20} className="text-primary" /> Basic</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2 text-sm font-bold">Shop name<input required maxLength={100} value={form.name} onChange={(e) => updateField("name", e.target.value)} className={inputClass} /></label>
              <label className="space-y-2 text-sm font-bold">Category<input required maxLength={100} value={form.category} onChange={(e) => updateField("category", e.target.value)} className={inputClass} placeholder="Restaurant, bakery, takeaway..." /></label>
              <label className="space-y-2 text-sm font-bold md:col-span-2">Description<textarea required maxLength={500} rows={4} value={form.description} onChange={(e) => updateField("description", e.target.value)} className={inputClass} /></label>
              <label className="space-y-2 text-sm font-bold">Phone<input required maxLength={20} type="tel" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className={inputClass} /></label>
            </div>
          </section>

          <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm md:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-headline text-lg font-black"><MapPin size={20} className="text-primary" /> Location</h2>
              <button type="button" onClick={useCurrentLocation} disabled={isLocating || isCreating} className="flex min-h-11 items-center gap-2 rounded-xl bg-surface-container px-4 py-2 text-xs font-black uppercase tracking-wider hover:bg-surface-container-high disabled:opacity-50">
                {isLocating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />} Use my current location
              </button>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2 text-sm font-bold md:col-span-2">Physical address / location<input required maxLength={300} value={form.location} onChange={(e) => updateField("location", e.target.value)} className={inputClass} /></label>
              <label className="space-y-2 text-sm font-bold">Latitude<input required type="number" step="any" min={-90} max={90} value={form.latitude} onChange={(e) => updateField("latitude", e.target.value)} className={inputClass} /></label>
              <label className="space-y-2 text-sm font-bold">Longitude<input required type="number" step="any" min={-180} max={180} value={form.longitude} onChange={(e) => updateField("longitude", e.target.value)} className={inputClass} /></label>
            </div>
          </section>

          <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm md:p-7">
            <h2 className="mb-5 flex items-center gap-2 font-headline text-lg font-black"><Clock size={20} className="text-primary" /> Hours</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2 text-sm font-bold">Opening time<input required type="time" value={form.opening_time} onChange={(e) => updateField("opening_time", e.target.value)} className={inputClass} /></label>
              <label className="space-y-2 text-sm font-bold">Closing time<input required type="time" value={form.closing_time} onChange={(e) => updateField("closing_time", e.target.value)} className={inputClass} /></label>
            </div>
          </section>

          <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm md:p-7">
            <h2 className="mb-5 flex items-center gap-2 font-headline text-lg font-black"><ImagePlus size={20} className="text-primary" /> Branding</h2>
            <div className="grid gap-5 md:grid-cols-[180px_1fr]">
              <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-outline-variant/30 bg-surface-container text-center hover:border-primary/60">
                {logoPreview ? <img src={logoPreview} alt="Shop logo preview" className="h-full w-full object-cover" /> : <><ImagePlus size={28} className="mb-2 text-primary" /><span className="px-3 text-xs font-bold">Choose required logo</span></>}
                <input type="file" accept="image/*" required={!logoFile} className="sr-only" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
              </label>
              <label className="space-y-2 text-sm font-bold">Story<textarea required maxLength={1000} rows={7} value={form.story} onChange={(e) => updateField("story", e.target.value)} className={inputClass} placeholder="Tell customers what makes your shop special." /></label>
            </div>
          </section>

          {errorMessage && <div role="alert" className="rounded-2xl border border-error/20 bg-error/5 p-4 text-sm font-bold text-error">{errorMessage}</div>}

          <button type="submit" disabled={isCreating} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-4 font-headline text-base font-black text-on-primary shadow-xl shadow-primary/25 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60">
            {isCreating ? <><Loader2 size={20} className="animate-spin" /> Creating your shop...</> : "Create Shop"}
          </button>
        </form>
      </div>
    </div>
  );
};
