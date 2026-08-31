import React, { useState, useEffect, useMemo } from "react";
import {
  Flame,
  Clock,
  MessageSquare,
  Copy,
  Check,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Shop, MenuItem } from "../../types";

export interface FlashDeal {
  id: string;
  itemId: string | number;
  itemName: string;
  itemImage?: string;
  originalPrice: number;
  discountPercentage: number;
  flashPrice: number;
  savings: number;
  durationHours: number;
  startedAt: string;
  expiresAt: string;
  timeslotTag: string;
  status: "active" | "expired";
}

interface FlashDealsStudioProps {
  activeShop: Shop | undefined;
  menuItems: MenuItem[];
  storeUrl: string;
}

export const FlashDealsStudio: React.FC<FlashDealsStudioProps> = ({
  activeShop,
  menuItems = [],
  storeUrl,
}) => {
  const shopId = activeShop?.id || "default";
  const shopName = activeShop?.name || "LocalEats Shop";
  const storageKey = `localeats_flash_deals_${shopId}`;

  // Form State
  const [selectedItemId, setSelectedItemId] = useState<string | number>(
    menuItems[0]?.id || ""
  );
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [durationHours, setDurationHours] = useState<number>(3);
  const [timeslotTag, setTimeslotTag] = useState<string>("Lunch Rush Booster (11:30 - 14:30)");
  const [copiedDealId, setCopiedDealId] = useState<string | null>(null);

  // Active Deals
  const [deals, setDeals] = useState<FlashDeal[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    return [];
  });

  // Save to local storage on changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(deals));
    } catch {
      // ignore
    }
  }, [deals, storageKey]);

  // Selected item object
  const selectedItem = useMemo(() => {
    return menuItems.find((it) => String(it.id) === String(selectedItemId)) || menuItems[0] || null;
  }, [menuItems, selectedItemId]);

  // Calculate pricing
  const pricing = useMemo(() => {
    if (!selectedItem) {
      return { original: 0, flash: 0, savings: 0 };
    }
    const orig = Number(selectedItem.price || 0);
    const savings = Math.round((orig * discountPercent) / 100);
    const flash = Math.max(1, orig - savings);
    return { original: orig, flash, savings };
  }, [selectedItem, discountPercent]);

  // Timer ticker to auto-refresh countdowns every 10 seconds
  const [timeNow, setTimeNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeNow(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Format countdown string
  const getRemainingTime = (expiresAt: string) => {
    const remainingMs = new Date(expiresAt).getTime() - timeNow;
    if (remainingMs <= 0) return "Expired";

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${mins}m left`;
    }
    return `${mins} mins left`;
  };

  // Launch Flash Deal
  const handleLaunchDeal = () => {
    if (!selectedItem) {
      toast.error("Please select a menu item first.");
      return;
    }

    const now = new Date();
    const expires = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    const newDeal: FlashDeal = {
      id: `flash_${Date.now()}`,
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      itemImage: selectedItem.image_url,
      originalPrice: pricing.original,
      discountPercentage: discountPercent,
      flashPrice: pricing.flash,
      savings: pricing.savings,
      durationHours,
      startedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      timeslotTag,
      status: "active",
    };

    setDeals((prev) => [newDeal, ...prev]);
    toast.success(`⚡ Flash deal activated on ${selectedItem.name}!`);
  };

  const handleEndDeal = (dealId: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    toast.info("Flash deal removed.");
  };

  // Generate WhatsApp broadcast copy for a deal
  const getDealWhatsAppText = (deal: FlashDeal) => {
    return `⚡ *LIMITED TIME FLASH DEAL ALERT!* 🔥\n\n*${shopName}* is running a special flash deal for the next *${deal.durationHours} hours* only!\n\n🍔 *${deal.itemName.toUpperCase()}*\n💰 NOW ONLY: *R${deal.flashPrice}* (was R${deal.originalPrice} - Save R${deal.savings}!)\n\n👉 *Order Online Instantly:*\n${storeUrl}\n\n⏰ *Hurry before deal expires!* Fast township delivery & pickup.`;
  };

  const handleShareWhatsApp = (deal: FlashDeal) => {
    const text = getDealWhatsAppText(deal);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    toast.success("Opening WhatsApp Broadcast...");
  };

  const handleCopyDealBroadcast = (deal: FlashDeal) => {
    const text = getDealWhatsAppText(deal);
    navigator.clipboard.writeText(text);
    setCopiedDealId(deal.id);
    toast.success("Broadcast message copied to clipboard!");
    setTimeout(() => setCopiedDealId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-gradient-to-br from-orange-500/10 via-surface-container-lowest to-surface-container-lowest p-6 rounded-3xl border border-orange-500/20 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                <Flame size={12} /> Slow-Hour Booster
              </span>
              <span className="text-xs font-bold text-on-surface-variant">
                Convert quiet hours into rapid online orders
              </span>
            </div>
            <h3 className="text-lg font-black text-on-surface font-headline">
              Timed Flash Deals & Lightning Boosters
            </h3>
            <p className="text-xs text-on-surface-variant max-w-2xl leading-relaxed">
              Launch temporary countdown deals (10% - 40% off) for 2 to 8 hours during slow afternoons or lunch rushes. Share directly to WhatsApp Status with 1-click.
            </p>
          </div>

          <div className="flex items-center gap-2 p-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 text-center shrink-0">
            <div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase block">
                Active Flash Deals
              </span>
              <span className="text-xl font-black text-orange-600 font-headline">
                {deals.filter((d) => new Date(d.expiresAt).getTime() > timeNow).length} running
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Create Deal + Active Deals List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Create Flash Deal Form */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-5">
            <h4 className="font-black text-base text-on-surface flex items-center gap-2">
              <Zap size={18} className="text-orange-500" />
              <span>Create New Flash Deal</span>
            </h4>

            {/* 1. Menu Item Selector */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Select Menu Item to Boost
              </label>
              {menuItems.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic">No menu items found. Add items to your menu first.</p>
              ) : (
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full bg-surface-container-high border-none rounded-2xl px-3.5 py-3 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary outline-none"
                >
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — R{item.price}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 2. Timeslot Preset Selector */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Target Booster Slot
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { tag: "Lunch Rush Booster (11:30 - 14:30)", desc: "Beat the lunch queue before 12:00" },
                  { tag: "Afternoon Slow-Hour Dip (14:30 - 17:00)", desc: "Fill the quiet kitchen gap" },
                  { tag: "Dinner Evening Rush (17:30 - 20:30)", desc: "Township evening family dinners" },
                ].map((slot) => (
                  <button
                    key={slot.tag}
                    type="button"
                    onClick={() => setTimeslotTag(slot.tag)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      timeslotTag === slot.tag
                        ? "border-orange-500 bg-orange-500/10 text-on-surface font-bold"
                        : "border-outline-variant/15 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    <p className="text-xs font-bold text-on-surface">{slot.tag}</p>
                    <p className="text-[10px] text-on-surface-variant">{slot.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Discount Percentage Slider / Presets */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-on-surface mb-2">
                <span>Discount Percentage</span>
                <span className="text-sm font-black text-orange-600">{discountPercent}% OFF</span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[10, 15, 20, 30].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDiscountPercent(pct)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      discountPercent === pct
                        ? "bg-orange-500 text-white shadow-xs"
                        : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer"
              />
            </div>

            {/* 4. Duration Selector */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Countdown Duration
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "2 Hours", val: 2 },
                  { label: "4 Hours", val: 4 },
                  { label: "6 Hours", val: 6 },
                  { label: "8 Hours", val: 8 },
                ].map((dur) => (
                  <button
                    key={dur.val}
                    type="button"
                    onClick={() => setDurationHours(dur.val)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      durationHours === dur.val
                        ? "bg-primary text-on-primary shadow-xs"
                        : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                    }`}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Live Pricing Breakdown Card */}
            <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">Original Menu Price:</span>
                <span className="line-through font-bold text-on-surface-variant">
                  R {pricing.original}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">Flash Deal Price ({discountPercent}% Off):</span>
                <span className="text-base font-black text-orange-600 font-headline">
                  R {pricing.flash}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-orange-500/20 text-emerald-600 font-bold">
                <span>Diner Saves:</span>
                <span>R {pricing.savings} per item</span>
              </div>
            </div>

            {/* Launch Button */}
            <button
              onClick={handleLaunchDeal}
              disabled={!selectedItem}
              className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Flame size={16} />
              <span>Launch Flash Deal ({durationHours}h Countdown)</span>
            </button>
          </div>
        </div>

        {/* Right: Active Flash Deals & WhatsApp Preview */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-4">
            <h4 className="font-black text-base text-on-surface flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                <span>Active & Scheduled Flash Deals</span>
              </span>
              <span className="text-xs font-bold text-on-surface-variant">
                {deals.length} Total
              </span>
            </h4>

            {deals.length === 0 ? (
              <div className="p-10 text-center rounded-2xl bg-surface-container-low border border-dashed border-outline-variant/20 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto">
                  <Flame size={24} />
                </div>
                <p className="text-sm font-bold text-on-surface">No Active Flash Deals</p>
                <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                  Select a menu item on the left and tap "Launch Flash Deal" to activate a limited-time special.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {deals.map((deal) => {
                  const isExpired = new Date(deal.expiresAt).getTime() <= timeNow;
                  const remaining = getRemainingTime(deal.expiresAt);

                  return (
                    <div
                      key={deal.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isExpired
                          ? "bg-surface-container-low border-outline-variant/10 opacity-60"
                          : "bg-surface-container-lowest border-orange-500/30 shadow-xs"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                isExpired
                                  ? "bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                                  : "bg-orange-500 text-white animate-pulse"
                              }`}
                            >
                              <Flame size={10} />
                              {remaining}
                            </span>
                            <span className="text-[11px] font-bold text-on-surface-variant">
                              {deal.timeslotTag}
                            </span>
                          </div>
                          <h5 className="font-bold text-sm text-on-surface flex items-center gap-2">
                            <span>{deal.itemName}</span>
                            <span className="text-xs font-black text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded-md">
                              {deal.discountPercentage}% OFF
                            </span>
                          </h5>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="line-through text-on-surface-variant">
                              R{deal.originalPrice}
                            </span>
                            <span className="font-black text-base text-on-surface">
                              R{deal.flashPrice}
                            </span>
                            <span className="text-emerald-600 font-bold text-[11px]">
                              (Save R{deal.savings})
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => handleShareWhatsApp(deal)}
                            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                            title="Share on WhatsApp Status or Broadcast"
                          >
                            <MessageSquare size={14} />
                            <span>WhatsApp Status</span>
                          </button>

                          <button
                            onClick={() => handleCopyDealBroadcast(deal)}
                            className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/20 transition-all cursor-pointer"
                            title="Copy broadcast text"
                          >
                            {copiedDealId === deal.id ? (
                              <Check size={14} className="text-emerald-500" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>

                          <button
                            onClick={() => handleEndDeal(deal.id)}
                            className="p-2 rounded-xl bg-error/10 hover:bg-error/20 text-error border border-error/20 transition-all cursor-pointer"
                            title="End Flash Deal"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* WhatsApp Status Mockup for Active Deal */}
          {deals.length > 0 && (
            <div className="bg-[#E5DDD5] dark:bg-[#0B141A] p-5 rounded-3xl border border-outline-variant/15 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-emerald-600" />
                  <span>WhatsApp Broadcast Copy Preview</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                  1-Tap Share
                </span>
              </div>

              <div className="bg-[#DCF8C6] dark:bg-[#005C4B] p-4 rounded-2xl text-slate-900 dark:text-white text-xs leading-relaxed whitespace-pre-wrap font-sans">
                {getDealWhatsAppText(deals[0])}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default FlashDealsStudio;
