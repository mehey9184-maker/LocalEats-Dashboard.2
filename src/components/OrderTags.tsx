import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Original order tag presentation shared by all four legacy board columns. */
export function OrderTagBadges({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map((tag) => {
        const colors: Record<string, string> = {
          "Rush": "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
          "VIP": "bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/20",
          "Large Order": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
          "Special": "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
        };
        return (
          <span
            key={tag}
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md border whitespace-nowrap",
              colors[tag] || "bg-zinc-100 text-zinc-600 border-zinc-200"
            )}
          >
            {tag === "Rush" && "⚡ "}{tag === "VIP" && "⭐ "}{tag === "Large Order" && "📦 "}{tag}
          </span>
        );
      })}
    </div>
  );
}

type QuickOrderTagsProps = {
  orderId: string;
  manualTags: string[];
  onToggle: (orderId: string, tag: string) => void;
};

/** Parent owns tag state and persistence; clicks never bubble to the order card. */
export function QuickOrderTags({ orderId, manualTags, onToggle }: QuickOrderTagsProps) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-outline-variant/10 pt-2 text-[10px]">
      <span className="text-on-surface-variant font-bold uppercase tracking-wider shrink-0">Quick Tags:</span>
      <div role="group" aria-label="Quick order tags" className="grid grid-cols-3 gap-[12px] flex-1 min-w-[156px]">
        {(["Rush", "VIP", "Special"] as const).map((tag) => {
          const isActive = manualTags.includes(tag);
          const icons = { Rush: "⚡", VIP: "⭐", Special: "📝" };
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={isActive}
              aria-label={`Toggle ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(orderId, tag);
              }}
              title={`Toggle ${tag}`}
              className={cn(
                "min-h-[44px] min-w-[44px] px-1 rounded-md font-bold transition-[color,background-color,border-color,filter] duration-100 motion-reduce:transition-none active:brightness-90 cursor-pointer select-none text-[10px] inline-flex items-center justify-center gap-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                isActive
                  ? tag === "Rush"
                    ? "bg-rose-700 text-white"
                    : tag === "VIP"
                      ? "bg-amber-800 text-white"
                      : "bg-teal-700 text-white"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white"
              )}
            >
              {icons[tag]} {tag === "Special" ? "Spec" : tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
