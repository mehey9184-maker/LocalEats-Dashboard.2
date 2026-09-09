import React, { useState, useMemo } from "react";
import { TrendingUp, Play, Layers,
  Bell,
  Ticket,
  Sparkles,
  Smartphone,
  Copy,
  Check,
  Send,
  Volume2,
  Tag,
  Clock,
  Zap,
  CheckCircle2,
  Eye,
  Sliders,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Shop, MenuItem } from "../types";

interface CampaignBuilderProps {
  activeShop: Shop | undefined;
  storeMenuItems?: MenuItem[];
  storeUrl: string;
}

type CampaignType = "push" | "coupon" | "combo";
type PreviewDevice = "lockscreen" | "inapp_banner" | "voucher_card" | "whatsapp";
type DiscountType = "percentage" | "fixed_amount" | "free_delivery" | "bonus_gift";
type TargetAudience = "all" | "radius_5km" | "frequent_diners" | "inactive_30d";

interface SavedCampaign {
  id: string;
  title: string;
  body: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minSpend: number;
  type: CampaignType;
  audience: TargetAudience;
  expiresAt: string;
  active: boolean;
  createdAt: string;
}

export const CampaignBuilder: React.FC<CampaignBuilderProps> = ({
  activeShop,
  storeMenuItems = [],
  storeUrl,
}) => {
  // Campaign Configuration State
  const [campaignType, setCampaignType] = useState<CampaignType>("combo");
  const [previewTab, setPreviewTab] = useState<PreviewDevice>("lockscreen");

  // Campaign Content Fields
  const [title, setTitle] = useState<string>("🔥 20% OFF LUNCH RUSH SPECIAL!");
  const [body, setBody] = useState<string>(
    "Craving fresh hot Kotas & Meals? Order now and enjoy 20% off your entire meal plus super fast township delivery!"
  );
  const [couponCode, setCouponCode] = useState<string>("LUNCH20");
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState<number>(20);
  const [minSpend, setMinSpend] = useState<number>(100);
  const [expiryOption, setExpiryOption] = useState<string>("today_1500");
  const [customExpiryDate, setCustomExpiryDate] = useState<string>("");
  const [targetAudience, setTargetAudience] = useState<TargetAudience>("all");
  const [themeColor, setThemeColor] = useState<"coral" | "midnight" | "emerald" | "amber">("coral");
  const [badgeText, setBadgeText] = useState<string>("LIMITED TIME OFFER");
  const [featuredItemId, setFeaturedItemId] = useState<string | number>("");

  // Copy & Action states
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [isSimulatingPush, setIsSimulatingPush] = useState(false);

  // Saved campaigns storage
  const shopId = activeShop?.id || "default";
  const storageKey = `localeats_campaigns_${shopId}`;

  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>(() => {
    try {
      const saved = localStorage.getItem(`localeats_campaigns_${shopId}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [
      {
        id: "camp_default_1",
        title: "⚡ 20% OFF Lunch Rush",
        body: "Get 20% off all orders over R100 between 11:30 and 14:30.",
        code: "LUNCH20",
        discountType: "percentage",
        discountValue: 20,
        minSpend: 100,
        type: "combo",
        audience: "all",
        expiresAt: "Today, 14:30",
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];
  });

  const shopName = activeShop?.name || "Our Local Shop";
  const shopLocation = activeShop?.address || activeShop?.location || activeShop?.city || "Township";

  // Selected Featured Menu Item
  const featuredItem = useMemo(() => {
    if (!featuredItemId) return storeMenuItems[0] || null;
    return storeMenuItems.find((i) => String(i.id) === String(featuredItemId)) || null;
  }, [featuredItemId, storeMenuItems]);

  // Campaign Presets
  const presets = [
    {
      id: "lunch_rush",
      label: "🔥 Lunch Rush (20% Off)",
      title: `⚡ 20% OFF LUNCH SPECIAL AT ${shopName.toUpperCase()}!`,
      body: `Beat the queue! Order your favorite ${featuredItem?.name || "Kota Special"} right now and get 20% off your entire basket.`,
      code: "LUNCH20",
      discountType: "percentage" as DiscountType,
      discountValue: 20,
      minSpend: 100,
      expiry: "today_1500",
      theme: "coral" as const,
      badge: "LUNCH SPECIAL",
    },
    {
      id: "free_delivery",
      label: "🛵 Free Township Delivery",
      title: `🛵 FREE DELIVERY ON ALL ORDERS OVER R120!`,
      body: `Enjoy hot, delicious food delivered straight to your door in ${shopLocation} with zero delivery fee today.`,
      code: "FREEDELIVERY",
      discountType: "free_delivery" as DiscountType,
      discountValue: 25,
      minSpend: 120,
      expiry: "this_weekend",
      theme: "emerald" as const,
      badge: "FREE SHIPPING",
    },
    {
      id: "first_time",
      label: "🎁 First Order R30 Off",
      title: `🎉 WELCOME GIFT: R30 OFF YOUR FIRST ORDER!`,
      body: `New to ${shopName}? Enjoy R30 off your first meal when ordering through LocalEats SA!`,
      code: "WELCOME30",
      discountType: "fixed_amount" as DiscountType,
      discountValue: 30,
      minSpend: 100,
      expiry: "end_of_month",
      theme: "amber" as const,
      badge: "NEW CUSTOMER ONLY",
    },
    {
      id: "weekend_feast",
      label: "🍔 Weekend Feast Platter",
      title: `🍔 WEEKEND FEAST SPECIAL: 15% OFF!`,
      body: `Family meals & township platters made fresh. Order online early to reserve your batch before we sell out!`,
      code: "WEEKEND15",
      discountType: "percentage" as DiscountType,
      discountValue: 15,
      minSpend: 150,
      expiry: "this_weekend",
      theme: "midnight" as const,
      badge: "WEEKEND VIBES",
    },
    {
      id: "item_deal",
      label: "✨ Item Deal: Free Drink/Side",
      title: `🥤 FREE BEVERAGE WITH ANY KOTA MEAL!`,
      body: `Order any large combo from ${shopName} and get a complimentary cold refreshment with code FREECOLD.`,
      code: "FREECOLD",
      discountType: "bonus_gift" as DiscountType,
      discountValue: 18,
      minSpend: 90,
      expiry: "today_1500",
      theme: "coral" as const,
      badge: "MEAL DEAL",
    },
  ];

  const applyPreset = (preset: (typeof presets)[0]) => {
    setTitle(preset.title);
    setBody(preset.body);
    setCouponCode(preset.code);
    setDiscountType(preset.discountType);
    setDiscountValue(preset.discountValue);
    setMinSpend(preset.minSpend);
    setExpiryOption(preset.expiry);
    setThemeColor(preset.theme);
    setBadgeText(preset.badge);
    toast.success(`Loaded preset: ${preset.label}`);
  };

  // Sound Simulation
  const playPushNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  const handleSimulatePushAlert = () => {
    setIsSimulatingPush(true);
    playPushNotificationSound();
    toast(title, {
      description: body,
      icon: <Bell className="text-primary animate-bounce" size={18} />,
      duration: 5000,
      action: {
        label: "Apply Code",
        onClick: () => {
          navigator.clipboard.writeText(couponCode);
          toast.success(`Copied coupon ${couponCode} to clipboard!`);
        },
      },
    });

    setTimeout(() => {
      setIsSimulatingPush(false);
    }, 1500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(couponCode);
    setCopiedCode(true);
    toast.success(`Coupon code "${couponCode}" copied to clipboard!`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPayload = () => {
    const payload = JSON.stringify(
      {
        notification: {
          title,
          body,
          icon: activeShop?.logo_url || "https://www.localeatssa.co.za/icon-192.png",
          badge: "https://www.localeatssa.co.za/badge-72.png",
          click_action: `${storeUrl}&coupon=${encodeURIComponent(couponCode)}`,
        },
        data: {
          shop_id: activeShop?.id,
          coupon_code: couponCode,
          discount_type: discountType,
          discount_value: discountValue,
          min_spend: minSpend,
          audience: targetAudience,
        },
      },
      null,
      2
    );

    navigator.clipboard.writeText(payload);
    setCopiedPayload(true);
    toast.success("Push notification payload copied to clipboard!");
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleCopyShareLink = () => {
    const promoLink = `${storeUrl}&promo=${encodeURIComponent(couponCode)}`;
    navigator.clipboard.writeText(promoLink);
    setCopiedShareLink(true);
    toast.success("Customer discount link copied!");
    setTimeout(() => setCopiedShareLink(false), 2000);
  };

  const handleSaveCampaign = () => {
    if (!title || !couponCode) {
      toast.error("Please fill in campaign title and coupon code.");
      return;
    }

    const newCampaign: SavedCampaign = {
      id: `camp_${Date.now()}`,
      title,
      body,
      code: couponCode.toUpperCase().replace(/\s+/g, ""),
      discountType,
      discountValue,
      minSpend,
      type: campaignType,
      audience: targetAudience,
      expiresAt:
        expiryOption === "today_1500"
          ? "Today, 15:00"
          : expiryOption === "this_weekend"
          ? "This Sunday, 23:59"
          : expiryOption === "end_of_month"
          ? "End of Month"
          : customExpiryDate || "No Expiry",
      active: true,
      createdAt: new Date().toISOString(),
    };

    const updated = [newCampaign, ...savedCampaigns];
    setSavedCampaigns(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
    toast.success(`Campaign "${title}" saved and activated for customers!`);
  };

  const handleToggleCampaignStatus = (id: string) => {
    const updated = savedCampaigns.map((c) => (c.id === id ? { ...c, active: !c.active } : c));
    setSavedCampaigns(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
    const camp = updated.find((c) => c.id === id);
    if (camp?.active) {
      toast.success(`Campaign "${camp.title}" resumed`);
    } else {
      toast.info(`Campaign paused`);
    }
  };

  const handleDeleteCampaign = (id: string) => {
    const updated = savedCampaigns.filter((c) => c.id !== id);
    setSavedCampaigns(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
    toast.success("Campaign deleted");
  };

  // Expiry text calculation
  const expiryDisplay = useMemo(() => {
    switch (expiryOption) {
      case "today_1500":
        return "Ends Today at 15:00";
      case "this_weekend":
        return "Valid this weekend only";
      case "end_of_month":
        return "Expires on 30th of this month";
      case "custom":
        return customExpiryDate ? `Valid until ${customExpiryDate}` : "Custom Date";
      default:
        return "Limited time only";
    }
  }, [expiryOption, customExpiryDate]);

  // Discount Text Display
  const discountDisplay = useMemo(() => {
    if (discountType === "percentage") return `${discountValue}% OFF`;
    if (discountType === "fixed_amount") return `R${discountValue} OFF`;
    if (discountType === "free_delivery") return "FREE DELIVERY";
    return "FREE GIFT / SIDE";
  }, [discountType, discountValue]);

  // Theme styles helper
  const getThemeClasses = () => {
    switch (themeColor) {
      case "midnight":
        return {
          bannerBg: "bg-slate-950 text-white border-slate-800",
          accent: "text-amber-400",
          button: "bg-amber-400 hover:bg-amber-300 text-slate-950",
          cardBorder: "border-slate-800 bg-slate-900 text-white",
          pillBg: "bg-slate-800 text-amber-300",
        };
      case "emerald":
        return {
          bannerBg: "bg-emerald-900 text-white border-emerald-800",
          accent: "text-emerald-300",
          button: "bg-emerald-400 hover:bg-emerald-300 text-emerald-950",
          cardBorder: "border-emerald-800 bg-emerald-950 text-white",
          pillBg: "bg-emerald-800 text-emerald-200",
        };
      case "amber":
        return {
          bannerBg: "bg-amber-900 text-white border-amber-800",
          accent: "text-amber-200",
          button: "bg-amber-400 hover:bg-amber-300 text-amber-950",
          cardBorder: "border-amber-800 bg-amber-950 text-white",
          pillBg: "bg-amber-800 text-amber-100",
        };
      default:
        return {
          bannerBg: "bg-gradient-to-r from-[#EA580C] to-[#C2410C] text-white border-orange-700",
          accent: "text-amber-200",
          button: "bg-white hover:bg-amber-50 text-[#EA580C]",
          cardBorder: "border-orange-200/40 bg-white text-zinc-900",
          pillBg: "bg-orange-500/20 text-orange-200",
        };
    }
  };

  const themeClasses = getThemeClasses();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-6 rounded-3xl border border-outline-variant/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-wider">
            <Sparkles size={13} />
            <span>Interactive Growth Engine</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black font-headline text-on-surface">
            Campaign & Coupon Builder
          </h2>
          <p className="text-xs md:text-sm text-on-surface-variant font-medium">
            Design push notification blasts, in-app storefront banners, and coupon vouchers with live customer previews.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSimulatePushAlert}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
              isSimulatingPush
                ? "bg-amber-500 text-white scale-95"
                : "bg-primary hover:bg-primary-container text-on-primary active:scale-95"
            }`}
            title="Trigger realistic customer phone alert"
          >
            <Volume2 size={15} className={isSimulatingPush ? "animate-spin" : ""} />
            <span>{isSimulatingPush ? "Ringing Phone..." : "Test Push Sound"}</span>
          </button>

          <button
            onClick={handleSaveCampaign}
            className="px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center gap-1.5 transition-all cursor-pointer shadow-xs border border-outline-variant/20"
          >
            <CheckCircle2 size={15} className="text-emerald-500" />
            <span>Save & Publish</span>
          </button>
        </div>
      </div>

      {/* Preset Quick Loader Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-on-surface-variant/75 flex items-center gap-1.5">
            <Zap size={14} className="text-amber-500" /> Quick Campaign Templates
          </span>
          <span className="text-[11px] text-on-surface-variant font-medium">Click to load pre-configured parameters</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-surface-container-low hover:bg-surface-container-high text-on-surface border border-outline-variant/20 transition-all cursor-pointer hover:border-primary/40 active:scale-95 flex items-center gap-1.5 shadow-2xs"
            >
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Controls vs Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Controls (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Campaign Structure & Types */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/10">
              <h3 className="font-headline font-black text-sm uppercase tracking-wider text-on-surface flex items-center gap-2">
                <Sliders size={16} className="text-primary" />
                <span>1. Campaign Strategy & Channel</span>
              </h3>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full uppercase">
                {campaignType.toUpperCase()}
              </span>
            </div>

            {/* Campaign Type Pills */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-2">Campaign Broadcast Channel</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCampaignType("combo")}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    campaignType === "combo"
                      ? "border-primary bg-primary/10 text-primary font-black shadow-xs"
                      : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  <Sparkles size={18} />
                  <span className="text-xs">Combo Blast</span>
                  <span className="text-[9px] font-medium opacity-75">Push + Voucher + Banner</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCampaignType("push")}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    campaignType === "push"
                      ? "border-primary bg-primary/10 text-primary font-black shadow-xs"
                      : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  <Bell size={18} />
                  <span className="text-xs">Push Notification</span>
                  <span className="text-[9px] font-medium opacity-75">Lock Screen Alert</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCampaignType("coupon")}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    campaignType === "coupon"
                      ? "border-primary bg-primary/10 text-primary font-black shadow-xs"
                      : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  <Ticket size={18} />
                  <span className="text-xs">Coupon Voucher</span>
                  <span className="text-[9px] font-medium opacity-75">Store Checkout Ticket</span>
                </button>
              </div>
            </div>

            {/* Campaign Headline */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-on-surface">Campaign Headline / Push Title</label>
                <span className="text-[10px] text-on-surface-variant font-mono">{title.length}/60 chars</span>
              </div>
              <input
                type="text"
                value={title}
                maxLength={65}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 🔥 20% OFF LUNCH RUSH SPECIAL!"
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl px-4 py-3 text-sm text-on-surface font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>

            {/* Campaign Body / Push Message */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-on-surface">Notification Body & Offer Details</label>
                <span className="text-[10px] text-on-surface-variant font-mono">{body.length}/140 chars</span>
              </div>
              <textarea
                rows={3}
                value={body}
                maxLength={160}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter customer facing message..."
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl p-4 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all leading-relaxed"
              />
            </div>

            {/* Optional Featured Menu Item */}
            {storeMenuItems.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">Featured Menu Special (Optional)</label>
                <select
                  value={featuredItemId}
                  onChange={(e) => setFeaturedItemId(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2.5 text-xs text-on-surface font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="">-- General Storewide Promo (No single item) --</option>
                  {storeMenuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - R{item.price} {item.category ? `(${item.category})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Banner Top Badge Text */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">Badge Ribbon Text</label>
                <input
                  type="text"
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value.toUpperCase())}
                  placeholder="e.g. LIMITED TIME OFFER"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2.5 text-xs text-on-surface font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">Visual Color Scheme</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "coral", bg: "bg-[#EA580C]", name: "Coral" },
                    { id: "midnight", bg: "bg-slate-900", name: "Dark" },
                    { id: "emerald", bg: "bg-emerald-600", name: "Green" },
                    { id: "amber", bg: "bg-amber-600", name: "Gold" },
                  ].map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setThemeColor(color.id as typeof themeColor)}
                      className={`py-2 px-1 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        themeColor === color.id
                          ? "border-primary ring-2 ring-primary/20 bg-surface-container"
                          : "border-outline-variant/20 bg-surface-container-low"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full ${color.bg}`} />
                      <span className="text-[9px] font-bold">{color.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Coupon Voucher & Discount Logic */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/10">
              <h3 className="font-headline font-black text-sm uppercase tracking-wider text-on-surface flex items-center gap-2">
                <Ticket size={16} className="text-primary" />
                <span>2. Coupon Code & Reward Rules</span>
              </h3>
              <span className="text-xs font-black font-mono text-primary bg-primary/10 px-2.5 py-0.5 rounded-lg">
                {couponCode || "NO-CODE"}
              </span>
            </div>

            {/* Coupon Code Input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">Coupon Code (Customer enters at checkout)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                    placeholder="e.g. LUNCH20"
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-10 pr-4 py-2.5 text-xs text-on-surface font-mono font-black tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <Tag size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">Discount Reward Type</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2.5 text-xs text-on-surface font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="percentage">Percentage Discount (%)</option>
                  <option value="fixed_amount">Flat Rand Discount (R Off)</option>
                  <option value="free_delivery">Free Township Delivery</option>
                  <option value="bonus_gift">Free Item / Refreshment</option>
                </select>
              </div>
            </div>

            {/* Discount Value & Min Spend */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">
                  {discountType === "percentage"
                    ? "Discount Percentage (%)"
                    : discountType === "fixed_amount"
                    ? "Rand Discount Value (R)"
                    : discountType === "free_delivery"
                    ? "Waived Delivery Fee Value (R)"
                    : "Gift / Item Value (R)"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-10 pr-4 py-2.5 text-xs text-on-surface font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-xs">
                    {discountType === "percentage" ? "%" : "R"}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">Minimum Order Basket (R)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={minSpend}
                    onChange={(e) => setMinSpend(Number(e.target.value))}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-10 pr-4 py-2.5 text-xs text-on-surface font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-xs">
                    R
                  </div>
                </div>
                <span className="text-[10px] text-on-surface-variant mt-1 block">
                  Customer must spend at least R{minSpend} to redeem
                </span>
              </div>
            </div>

            {/* Expiry & Target Audience */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">Campaign Expiry Window</label>
                <select
                  value={expiryOption}
                  onChange={(e) => setExpiryOption(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2.5 text-xs text-on-surface font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="today_1500">Today Rush (Until 15:00)</option>
                  <option value="this_weekend">This Weekend Only</option>
                  <option value="end_of_month">End of Current Month</option>
                  <option value="custom">Custom Date Range...</option>
                </select>
                {expiryOption === "custom" && (
                  <input
                    type="date"
                    value={customExpiryDate}
                    onChange={(e) => setCustomExpiryDate(e.target.value)}
                    className="mt-2 w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3 py-2 text-xs font-bold text-on-surface"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">Target Customer Segment</label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value as TargetAudience)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2.5 text-xs text-on-surface font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="all">🌐 All LocalEats Customers in Township</option>
                  <option value="radius_5km">📍 Nearby Diners (Within 5km Radius)</option>
                  <option value="frequent_diners">⭐ Returning & Frequent Diners</option>
                  <option value="inactive_30d">💤 Win Back Lapsed Customers (30+ Days)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Visual Multi-Device Preview Dashboard (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-5 sticky top-6">
            {/* Preview Switcher Tabs */}
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/10">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-primary" />
                <h3 className="font-headline font-black text-sm uppercase tracking-wider text-on-surface">
                  Customer Live Preview
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Real-time
              </span>
            </div>

            {/* Device Switcher Pills */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-surface-container-low rounded-2xl">
              <button
                type="button"
                onClick={() => setPreviewTab("lockscreen")}
                className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  previewTab === "lockscreen"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
                title="Phone Lock Screen Push"
              >
                <Smartphone size={14} />
                <span>Lock Screen</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab("inapp_banner")}
                className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  previewTab === "inapp_banner"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
                title="Storefront Announcement Header"
              >
                <Sparkles size={14} />
                <span>In-App Banner</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab("voucher_card")}
                className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  previewTab === "voucher_card"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
                title="Customer Digital Coupon Ticket"
              >
                <Ticket size={14} />
                <span>Voucher Ticket</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab("whatsapp")}
                className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  previewTab === "whatsapp"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
                title="WhatsApp Share Card"
              >
                <Send size={14} />
                <span>Chat Share</span>
              </button>
            </div>

            {/* PREVIEW 1: SMARTPHONE LOCK SCREEN PUSH NOTIFICATION */}
            {previewTab === "lockscreen" && (
              <div className="relative mx-auto w-full max-w-[340px] rounded-[38px] p-3 bg-zinc-950 shadow-2xl border-4 border-zinc-800 text-white font-sans overflow-hidden">
                {/* Notch & Speaker */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-zinc-900 rounded-full flex items-center justify-center gap-2 z-20">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                  <div className="w-10 h-1 bg-zinc-800 rounded-full" />
                </div>

                {/* Lockscreen Background Mockup */}
                <div className="relative pt-12 pb-6 px-3 bg-gradient-to-b from-slate-900 via-zinc-900 to-black rounded-[30px] min-h-[380px] flex flex-col justify-between">
                  {/* Lock Screen Time */}
                  <div className="text-center space-y-0.5">
                    <div className="text-[10px] font-medium text-zinc-400 tracking-wider">
                      Wednesday, 26 August
                    </div>
                    <div className="text-4xl font-extralight tracking-tight text-white">12:30</div>
                  </div>

                  {/* Push Notification Card */}
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="bg-zinc-900/90 backdrop-blur-md p-3.5 rounded-2xl border border-zinc-700/60 shadow-xl space-y-2 relative"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-[#EA580C] flex items-center justify-center text-white font-black text-[9px] shadow-xs">
                          LE
                        </div>
                        <span className="text-[11px] font-bold text-zinc-200">LocalEats SA</span>
                        <span className="text-[9px] text-zinc-400">· {shopName}</span>
                      </div>
                      <span className="text-[9px] text-zinc-400 font-medium">now</span>
                    </div>

                    {/* Content */}
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-white leading-snug">{title}</h4>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">{body}</p>
                    </div>

                    {/* Actions / Coupon Badge */}
                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EA580C]/20 text-[#EA580C] text-[10px] font-mono font-black border border-[#EA580C]/30">
                        <Tag size={10} />
                        <span>Code: {couponCode}</span>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400 hover:text-white flex items-center gap-0.5">
                        Tap to Order <ArrowRight size={10} />
                      </span>
                    </div>
                  </motion.div>

                  {/* Lock Screen Bottom Icons */}
                  <div className="flex justify-between items-center px-4 pt-4 text-zinc-400">
                    <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center text-xs">
                      🔦
                    </div>
                    <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center text-xs">
                      📷
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PREVIEW 2: STOREFRONT IN-APP ANNOUNCEMENT BANNER */}
            {previewTab === "inapp_banner" && (
              <div className="space-y-4">
                <div className="text-[11px] text-on-surface-variant font-medium">
                  Appears at the very top of your storefront inside the LocalEats customer app:
                </div>

                {/* In-App Store Banner Mockup */}
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl border shadow-md space-y-3 ${themeClasses.bannerBg}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${themeClasses.pillBg}`}>
                      {badgeText}
                    </span>
                    <span className="text-[10px] font-medium opacity-90 flex items-center gap-1">
                      <Clock size={11} /> {expiryDisplay}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-black tracking-tight">{title}</h4>
                    <p className="text-xs opacity-90 leading-relaxed">{body}</p>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-white/20">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-black bg-black/25 px-3 py-1 rounded-xl">
                      <Ticket size={13} className={themeClasses.accent} />
                      <span>{couponCode}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-transform active:scale-95 cursor-pointer shadow-xs ${themeClasses.button}`}
                    >
                      {copiedCode ? "Applied!" : "Claim & Order"}
                    </button>
                  </div>
                </motion.div>

                {/* Store mini preview */}
                <div className="bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/10 space-y-2 opacity-80">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                      {shopName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-on-surface">{shopName}</div>
                      <div className="text-[10px] text-on-surface-variant">📍 {shopLocation} · Fast Delivery</div>
                    </div>
                  </div>
                  <div className="h-10 rounded-xl bg-surface-container border border-outline-variant/10 flex items-center px-3 text-xs text-on-surface-variant">
                    🔍 Search delicious meals from {shopName}...
                  </div>
                </div>
              </div>
            )}

            {/* PREVIEW 3: DIGITAL TEAR-OFF COUPON VOUCHER CARD */}
            {previewTab === "voucher_card" && (
              <div className="space-y-4">
                <div className="text-[11px] text-on-surface-variant font-medium">
                  Digital coupon voucher presented at checkout and inside customer wallet:
                </div>

                {/* Perforated Voucher Ticket */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`relative rounded-3xl border-2 shadow-lg overflow-hidden ${themeClasses.cardBorder}`}
                >
                  {/* Left tear notch */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-surface-container-lowest border border-outline-variant/20 z-10" />
                  {/* Right tear notch */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 rounded-full bg-surface-container-lowest border border-outline-variant/20 z-10" />

                  <div className="p-5 space-y-4">
                    {/* Top Store Info */}
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary">
                          LOCALEATS VOUCHER PASS
                        </span>
                        <h4 className="text-base font-black text-on-surface leading-tight mt-0.5">
                          {shopName}
                        </h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-primary font-headline block">
                          {discountDisplay}
                        </span>
                        <span className="text-[9px] text-on-surface-variant font-semibold">
                          Min spend R{minSpend}
                        </span>
                      </div>
                    </div>

                    {/* Dashed perforated line */}
                    <div className="border-t-2 border-dashed border-outline-variant/30 relative" />

                    {/* Voucher Code Block */}
                    <div className="bg-surface-container-high/60 p-3.5 rounded-2xl border border-outline-variant/15 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">
                          PROMO CODE
                        </span>
                        <span className="text-base font-black font-mono tracking-wider text-on-surface">
                          {couponCode}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="px-3.5 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-xl text-xs font-black uppercase tracking-wider transition-transform active:scale-95 cursor-pointer shadow-xs flex items-center gap-1"
                      >
                        {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedCode ? "Copied" : "Copy Code"}</span>
                      </button>
                    </div>

                    {/* Footer terms */}
                    <div className="flex items-center justify-between text-[10px] text-on-surface-variant font-medium">
                      <span>⏳ {expiryDisplay}</span>
                      <span>📍 Valid at {shopName}</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {/* PREVIEW 4: WHATSAPP CUSTOMER SHARE PREVIEW */}
            {previewTab === "whatsapp" && (
              <div className="space-y-4">
                <div className="text-[11px] text-on-surface-variant font-medium">
                  How the promotional voucher and deep-link appear when shared on WhatsApp:
                </div>

                {/* WhatsApp Chat Bubble Mockup */}
                <div className="bg-[#EFEAE2] dark:bg-zinc-950 p-4 rounded-3xl border border-outline-variant/20 shadow-inner space-y-3 font-sans">
                  <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl rounded-tl-none border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2 max-w-[290px] ml-1">
                    <div className="text-xs text-zinc-900 dark:text-zinc-100 font-normal leading-relaxed space-y-1">
                      <p className="font-bold text-[#EA580C]">
                        {title}
                      </p>
                      <p>{body}</p>
                      <div className="p-2 rounded-xl bg-amber-50 dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 text-[11px]">
                        🎟️ Use Coupon Code: <strong className="font-mono">{couponCode}</strong> ({discountDisplay})
                        <br />
                        🛒 Minimum Basket: R{minSpend}
                      </div>
                      <p className="text-[#0284C7] font-semibold underline text-[11px] pt-1">
                        👉 {storeUrl}&promo={couponCode}
                      </p>
                    </div>
                    <div className="text-right text-[9px] text-zinc-400">12:31 PM ✓✓</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const text = `${title}\n\n${body}\n\n🎟️ Use Coupon: *${couponCode}* (${discountDisplay})\n🛒 Min spend R${minSpend}\n\n👉 Order Online Now: ${storeUrl}&promo=${couponCode}`;
                      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                      window.open(waUrl, "_blank");
                    }}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Send size={14} />
                    <span>Share on WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="px-3.5 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold transition-all cursor-pointer border border-outline-variant/20 flex items-center gap-1"
                  >
                    {copiedShareLink ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    <span>{copiedShareLink ? "Copied" : "Link"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Campaign Reach Projection Card */}
            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/15 space-y-2">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-on-surface">
                <span className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-emerald-500" /> Projected Campaign Impact
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  High Conversion
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2 rounded-xl bg-surface-container-lowest border border-outline-variant/10 text-center">
                  <span className="text-[9px] text-on-surface-variant font-bold uppercase block">Audience Reach</span>
                  <span className="text-xs font-black text-on-surface">~350+ Users</span>
                </div>
                <div className="p-2 rounded-xl bg-surface-container-lowest border border-outline-variant/10 text-center">
                  <span className="text-[9px] text-on-surface-variant font-bold uppercase block">Est. Lift</span>
                  <span className="text-xs font-black text-emerald-600">+28% Orders</span>
                </div>
                <div className="p-2 rounded-xl bg-surface-container-lowest border border-outline-variant/10 text-center">
                  <span className="text-[9px] text-on-surface-variant font-bold uppercase block">Avg Ticket</span>
                  <span className="text-xs font-black text-primary">~R165.00</span>
                </div>
              </div>
            </div>

            {/* Developer / Integration Tools */}
            <div className="pt-2 border-t border-outline-variant/10 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCopyPayload}
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedPayload ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedPayload ? "JSON Payload Copied" : "Copy Webhook / API Payload"}</span>
              </button>

              <button
                type="button"
                onClick={handleSimulatePushAlert}
                className="text-[11px] font-bold text-on-surface-variant hover:text-on-surface flex items-center gap-1 cursor-pointer"
              >
                <Play size={12} />
                <span>Simulate Push</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Saved / Active Campaigns Dashboard */}
      {savedCampaigns.length > 0 && (
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-headline font-black text-base text-on-surface flex items-center gap-2">
                <Layers size={18} className="text-primary" />
                <span>Active & Published Campaigns</span>
              </h3>
              <p className="text-xs text-on-surface-variant">
                Live promotions broadcasted to customer app and checkout.
              </p>
            </div>
            <span className="text-xs font-bold text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full">
              {savedCampaigns.length} Total
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedCampaigns.map((camp) => (
              <div
                key={camp.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 relative ${
                  camp.active
                    ? "bg-surface-container-low border-primary/20 shadow-xs"
                    : "bg-surface-container-high/40 border-outline-variant/10 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      camp.active
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"
                    }`}
                  >
                    {camp.active ? "● Active Live" : "○ Paused"}
                  </span>

                  <div className="flex items-center gap-1.5 font-mono text-xs font-black bg-primary/10 text-primary px-2.5 py-0.5 rounded-lg">
                    <Tag size={11} />
                    <span>{camp.code}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-black text-on-surface leading-snug line-clamp-1">{camp.title}</h4>
                  <p className="text-[11px] text-on-surface-variant line-clamp-2">{camp.body}</p>
                </div>

                <div className="pt-2 border-t border-outline-variant/10 flex items-center justify-between text-[10px] text-on-surface-variant">
                  <span>⏳ {camp.expiresAt}</span>
                  <span>Min: R{camp.minSpend}</span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleToggleCampaignStatus(camp.id)}
                    className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      camp.active
                        ? "bg-surface-container hover:bg-surface-container-highest text-on-surface"
                        : "bg-primary text-on-primary"
                    }`}
                  >
                    {camp.active ? "Pause" : "Activate"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteCampaign(camp.id)}
                    className="px-2.5 py-1.5 bg-error/10 hover:bg-error/20 text-error rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                    title="Delete Campaign"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
