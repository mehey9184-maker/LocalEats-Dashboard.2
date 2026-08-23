import React, { useState, useRef } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Edit2,
  Bell,
  Moon,
  Check,
  Loader2,
  CheckCircle2,
  Upload,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { uploadImageToFirebaseStorage } from "../lib/firebase";
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
  userId,
  isSaving = false,
  isSuccess = false,
}) => {
  const [formData, setFormData] = useState({
    fullName: initialData?.fullName || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    avatarUrl: initialData?.avatarUrl || "",
  });

  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preferences, setPreferences] = useState({
    marketing: initialData?.marketing ?? true,
    darkMode: initialData?.darkMode ?? false,
  });

  const uploadAvatarPhoto = async (file: File) => {
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

      toast.success("Profile photo uploaded successfully!");
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
    await uploadAvatarPhoto(file);
    e.target.value = "";
  };

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
                await uploadAvatarPhoto(file);
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
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-1 right-1 bg-gradient-to-br from-primary to-primary-container p-2.5 rounded-full text-on-primary shadow-lg active:scale-95 transition-transform disabled:opacity-50 cursor-pointer"
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
