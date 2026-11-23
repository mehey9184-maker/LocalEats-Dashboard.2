import { useState } from "react";
import { Store, UtensilsCrossed } from "lucide-react";

interface MerchantPhotoProps {
  src?: string | null;
  alt: string;
  kind?: "shop" | "food";
  /** Compact mode keeps small image slots legible. */
  compact?: boolean;
  className?: string;
}

const missingPhoto = (source?: string | null) =>
  !source?.trim() || /placeholder\.com|via\.placeholder|food-placeholder/.test(source);

export function MerchantPhoto({
  src,
  alt,
  kind = "food",
  compact = false,
  className = "",
}: MerchantPhotoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !!src && failedSrc === src;
  const isShop = kind === "shop";

  if (missingPhoto(src) || failed) {
    return (
      <div
        role="img"
        aria-label={`${isShop ? "Shop" : "Menu item"} photo not available: ${alt}`}
        className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-orange-50 to-surface-container text-primary dark:from-slate-800 dark:to-slate-900"
      >
        {isShop ? <Store aria-hidden="true" size={compact ? 20 : 30} /> : <UtensilsCrossed aria-hidden="true" size={compact ? 20 : 30} />}
        {!compact && (
          <span className="px-1 max-w-full line-clamp-2 break-words text-center text-[10px] font-bold leading-tight">
            {isShop ? alt : "No photo yet"}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src!}
      alt={alt}
      className={`w-full h-full object-cover ${className}`}
      onError={() => setFailedSrc(src ?? null)}
      loading="lazy"
      decoding="async"
    />
  );
}
