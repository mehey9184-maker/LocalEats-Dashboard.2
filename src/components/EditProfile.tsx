import React, { useState } from "react";
import {
  ArrowLeft,
  Bell,
  Moon,
  Check,
  Loader2,
  CheckCircle2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatSAPhone } from "../utils";
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
  avatarUrl?: string;
  marketing?: boolean;
  darkMode?: boolean;
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
  isSaving = false,
  isSuccess = false,
}) => {
  const [formData, setFormData] = useState({
    fullName: initialData?.fullName || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    avatarUrl: initialData?.avatarUrl || "",
  });

  const [preferences, setPreferences] = useState({
    marketing: initialData?.marketing ?? true,
    darkMode: initialData?.darkMode ?? false,
  });

  // Avatar writes are disabled until the same server-authorized profile save
  // can atomically confirm ownership and the saved photo reference.
  const handleSave = () => {
    if (formData.phone) {
      const phoneCleaned = formData.phone.replace(/[\s-]/g, "");
      const saRegex = /^(?:\+27|0)[0-9]{9}$/;

      if (!saRegex.test(phoneCleaned)) {
        toast.error("Please enter a valid South African phone number (e.g., +27 82 123 4567 or 082 123 4567).");
        return;
      }
    }

    onSave({ ...formData, ...preferences });
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface pb-24 selection:bg-primary/10 selection:text-primary">
      <header className="fixed top-0 w-full z-50 bg-surface/70 backdrop-blur-xl shadow-sm shadow-primary/5">
        <div className="flex items-center justify-between px-6 h-16 w-full max-w-screen-xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="active:scale-95 transition-transform duration-200 hover:opacity-80 p-2 rounded-full hover:bg-surface-container-low cursor-pointer"
            >
              <ArrowLeft className="text-primary" size={24} />
            </button>
            <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">
              My Account
            </h1>
          </div>
        </div>
        <div className="bg-surface-container-low h-[1px] w-full absolute bottom-0 opacity-15"></div>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-10">
        <section className="flex flex-col items-center">
          <div className="relative rounded-full p-1.5">
            <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-surface-container-lowest shadow-lg bg-surface-container-low flex items-center justify-center">
              {formData.avatarUrl ? (
                <img alt="Profile" className="w-full h-full object-cover" src={formData.avatarUrl} />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center bg-primary"
                  style={{ background: "radial-gradient(circle at 30% 30%, #ff9d4d 0%, #f58220 100%)" }}
                >
                  <UserIcon size={64} className="text-white drop-shadow-md" strokeWidth={1.5} />
                </div>
              )}
            </div>
          </div>
          <p data-testid="merchant-avatar-upload-unavailable" role="note"
            className="mt-4 max-w-sm text-center text-xs font-medium text-on-surface-variant">
            Profile photo changes are unavailable until secure profile saving is enabled.
          </p>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
              Personal Information
            </h2>
            <span className="text-xs font-label text-primary font-bold tracking-widest uppercase px-2 py-1 bg-primary/10 rounded-full">
              Account Owner
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
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface-variant px-1">
                Login Email Address
              </label>
              <input
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="your.email@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm font-medium text-on-surface-variant px-1">
                <span>Personal Phone Number</span>
                {!formData.phone && (
                  <span className="flex items-center gap-1 text-[10px] text-on-surface-variant/60 font-medium">
                    Optional
                  </span>
                )}
              </label>
              <input
                className={cn(
                  "w-full border-none rounded-xl px-4 py-3.5 focus:ring-2 transition-all text-on-surface bg-surface-container-low focus:ring-primary/40 focus:bg-surface-container-lowest"
                )}
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  const result = formatSAPhone(e.target.value);
                  setFormData({ ...formData, phone: result.formatted });
                }}
                placeholder="e.g. +27 82 123 4567"
              />
              <p className="text-[10px] text-on-surface-variant/60 px-1 italic">
                Personal contact for account recovery and owner communications.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
            Account Preferences
          </h2>
          <div className="bg-surface-container-low rounded-xl overflow-hidden divide-y divide-surface-container-high">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                  <Bell className="text-on-surface-variant" size={20} />
                </div>
                <div>
                  <p className="font-medium text-on-surface">
                    Marketing Updates
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Platform news, merchant tips, and feature announcements
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
                    Reduce eye strain during evening shifts
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
              "w-full text-on-primary font-headline font-extrabold text-lg py-5 rounded-full shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer",
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
    </div>
  );
};
