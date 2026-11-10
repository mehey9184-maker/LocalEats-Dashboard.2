import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  QrCode,
  Copy,
  Check,
  Download,
  Sparkles,
  Megaphone,
  Printer,
  Smartphone,
  MessageSquare,
  Store,
  FileText,
  ExternalLink,
  Flame,
  Utensils,
  Percent,
  Palette,
  Eye,
  Gift,
  Ticket,
  Users,
  Zap,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { createLocalEatsBrandedQr, drawRecommendedLocalEatsPoster, LOCALEATS_POSTER_HEADLINE, LOCALEATS_DOMAIN, postableBrandCopy } from "./marketing/localEatsBrandedPoster";
import { Shop, MenuItem, Order } from "../types";
import { isShopOwnedByUser } from "../utils/shopOwnership";
import type { User } from "@supabase/supabase-js";
import { CampaignBuilder } from "./CampaignBuilder";
import { CustomerReEngagement } from "./marketing/CustomerReEngagement";
import { FlashDealsStudio } from "./marketing/FlashDealsStudio";
import { TableTentGenerator } from "./marketing/TableTentGenerator";

interface MarketingProps {
  currentShop: Shop | undefined;
  setShops?: React.Dispatch<React.SetStateAction<Shop[]>>;
  shops?: Shop[];
  menuItems?: MenuItem[];
  orders?: Order[];
  user?: User | null;
  onNavigateTab?: (tab: string) => void;
}

type MainSegment = "dashboard" | "campaign_builder" | "tool_library";

type ToolSubTab =
  | "direct_reach"
  | "flash_deals"
  | "table_tents"
  | "qr_stands"
  | "whatsapp"
  | "social_studio"
  | "sms"
  | "playbook";

type QrStyle = "standard" | "coral" | "dark";
type SocialTheme = "coral" | "dark" | "golden" | "emerald";

export const Marketing: React.FC<MarketingProps> = ({
  currentShop,
  shops = [],
  menuItems = [],
  orders = [],
  user = null,
  onNavigateTab,
}) => {
  // 1. Store Selection (supports multi-store accounts)
  const userOwnedShops = useMemo(() => {
    if (shops.length === 0 && currentShop) return [currentShop];
    const owned = shops.filter((s) => isShopOwnedByUser(s, user));
    return owned.length > 0 ? owned : (currentShop && isShopOwnedByUser(currentShop, user) ? [currentShop] : []);
  }, [shops, user, currentShop]);

  const [selectedShopId, setSelectedShopId] = useState<string | number | null>(null);

  const activeShop: Shop | undefined = useMemo(() => {
    if (selectedShopId !== null) {
      const match = userOwnedShops.find((s) => String(s.id) === String(selectedShopId));
      if (match) return match;
    }
    return userOwnedShops.find((s) => String(s.id) === String(currentShop?.id)) || userOwnedShops[0];
  }, [userOwnedShops, selectedShopId, currentShop]);

  // Filter menu items for selected store
  const storeMenuItems = useMemo(() => {
    if (!activeShop) return [];
    return menuItems.filter((item) => String(item.shop_id) === String(activeShop.id));
  }, [menuItems, activeShop]);

  // Main Segment Navigation: Dashboard Summary, Campaign Builder, Tool Library
  const [mainSegment, setMainSegment] = useState<MainSegment>("tool_library");

  // Sub-Tab within Tool Library
  const [activeTool, setActiveTool] = useState<ToolSubTab>("whatsapp");

  // Store URL
  const storeUrl = useMemo(() => {
    if (!activeShop) return "";
    return `https://www.localeatssa.co.za/?shopId=${activeShop.id}`;
  }, [activeShop]);

  // High-Level Diner Analytics for Dashboard Summary
  const shopOrders = useMemo(() => {
    if (!activeShop) return [];
    return orders.filter(
      (o) =>
        String(o.shop_id) === String(activeShop.id) ||
        (activeShop.name && o.shop_name?.toLowerCase() === activeShop.name.toLowerCase())
    );
  }, [orders, activeShop]);

  const dinerStats = useMemo(() => {
    const customerMap = new Map<string, { count: number; spend: number }>();
    let totalRevenue = 0;

    shopOrders.forEach((ord) => {
      const phone = ord.customer_phone || ord.phone || "";
      const name = ord.customer_name || ord.customer || "Diner";
      const key = phone.trim() || name.trim();
      const amount = typeof ord.total === "number" ? ord.total : parseFloat(String(ord.total || 0)) || 0;
      totalRevenue += amount;

      if (!customerMap.has(key)) {
        customerMap.set(key, { count: 1, spend: amount });
      } else {
        const curr = customerMap.get(key)!;
        curr.count += 1;
        curr.spend += amount;
      }
    });

    const totalUniqueDiners = customerMap.size || (shopOrders.length > 0 ? Math.ceil(shopOrders.length * 0.75) : 0);
    let repeatCount = 0;
    customerMap.forEach((val) => {
      if (val.count > 1) repeatCount += 1;
    });

    const repeatRate = totalUniqueDiners > 0 ? Math.round((repeatCount / totalUniqueDiners) * 100) : 0;
    const avgSpend = shopOrders.length > 0 ? Math.round(totalRevenue / shopOrders.length) : 0;

    return {
      totalUniqueDiners,
      repeatCount,
      repeatRate,
      avgSpend,
      totalOrders: shopOrders.length,
    };
  }, [shopOrders]);

  // Quick Action Switchers
  const handleLaunchQuickAction = (tool: ToolSubTab) => {
    setMainSegment("tool_library");
    setActiveTool(tool);
  };

  // 2. QR Code State & Generator
  const [qrStyle, setQrStyle] = useState<QrStyle>("coral");
  const [qrFrameText, setQrFrameText] = useState<string>("SCAN TO EXPLORE");
  const [qrState, setQrState] = useState<{ sourceUrl: string; image: string } | null>(null);
  const qrDataUrl = qrState?.sourceUrl === storeUrl ? qrState.image : "";
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  // Brand QR is shared by the poster, printable flyer, and on-screen QR preview.
  // Switching shops invalidates the previous image immediately.
  useEffect(() => {
    let cancelled = false;
    setQrState(null);
    if (!storeUrl) return;
    void createLocalEatsBrandedQr(storeUrl, qrStyle).then((url) => {
      if (!cancelled) setQrState({ sourceUrl: storeUrl, image: url });
    }).catch((error) => {
      console.warn("Branded QR generation failed", error);
      if (!cancelled) setQrState(null);
    });
    return () => { cancelled = true; };
  }, [storeUrl, qrStyle]);

  // Copy Store Link Handler
  const copyStoreUrl = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopiedLink(true);
    toast.success("Shop menu link copied!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // 3. WhatsApp Promo Studio State
  const [selectedPreset, setSelectedPreset] = useState<string>("opening");
  const [customFeaturedItem, setCustomFeaturedItem] = useState<string>("");
  const [userEditedMessage, setUserEditedMessage] = useState<string | null>(null);

  // Derived auto-generated message
  const generatedMessage = useMemo(() => {
    const shopName = activeShop?.name || "Our Shop";
    const shopLocation = activeShop?.address || activeShop?.location || activeShop?.city || "Township";
    const featuredItemName = customFeaturedItem || storeMenuItems[0]?.name || "Kota Special";
    const featuredItemPrice = storeMenuItems.find((i) => i.name === featuredItemName)?.price;
    const priceText = featuredItemPrice ? `for only R${featuredItemPrice}` : "";

    switch (selectedPreset) {
      case "opening":
        return `🔥 *EXPLORE ${shopName} ON LOCALEATS!* 🔥\n\nExplore local favourites! Browse our menu on your phone in ${shopLocation}. Pickup ordering availability is shown inside LocalEats.\n\n👉 *Explore Our Menu:*\n${storeUrl}\n\n✅ Pickup only. Pay at the shop when ordering is available.\n⚡ Powered by LocalEats SA`;
      case "lunch":
        return `🍔 *LUNCH MENU AT ${shopName.toUpperCase()}!* 🕒\n\nHungry? Treat yourself today to our fresh ${featuredItemName} ${priceText}! Explore our menu and prices in LocalEats. Pickup ordering is available only when shown in the app.\n\n📲 *Explore the menu:*\n${storeUrl}\n\nShare with friends who love local food!`;
      case "item_deal":
        return `✨ *MENU SPOTLIGHT: ${featuredItemName.toUpperCase()}* ✨\n\nMade fresh to order at *${shopName}* ${priceText}.\n\nSee the menu inside LocalEats:\n👉 ${storeUrl}\n\n📍 Location: ${shopLocation}\nPickup only - pay at the shop when ordering is available.`;
      case "pickup":
        return `*PICKUP FOOD FROM ${shopName.toUpperCase()}!*\n\nExplore the menu on LocalEats and check whether pickup ordering is available.\n\nLocation: ${shopLocation}\nPay at the shop when collecting. No delivery.\n\nExplore: ${storeUrl}`;
      case "discount":
        return `🎉 *CHECK OFFERS ON LOCALEATS!* 🎁\n\nBrowse *${shopName}* on LocalEats. Only offers confirmed active in the app can be redeemed. Do not share unconfirmed voucher codes.\n\n👉 *Check available offers:*\n${storeUrl}\n\nNo promotion is guaranteed unless shown as active inside LocalEats.`;
      case "weekend":
        return `🔥 *WEEKEND VIBES AT ${shopName.toUpperCase()}!* 🎉\n\nRelax and let us do the cooking! Fresh hot Kotas and township favorites ready for you and your family.\n\n📲 *Browse the local menu:*\n${storeUrl}\n\nHave a great weekend! 🍻🍔`;
      default:
        return `Explore food from ${shopName} on LocalEats: ${storeUrl}`;
    }
  }, [selectedPreset, activeShop, storeUrl, customFeaturedItem, storeMenuItems]);

  const activeMessage = userEditedMessage !== null ? userEditedMessage : generatedMessage;

  // WhatsApp Action Handlers
  const handleOpenWhatsApp = () => {
    if (!activeShop) return;
    const encoded = encodeURIComponent(activeMessage);
    const waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(waUrl, "_blank");
    toast.success("Opening WhatsApp share window...");
  };

  const handleCopyMessage = () => {
    if (!activeShop) return;
    navigator.clipboard.writeText(activeMessage);
    setCopiedMsg(true);
    toast.success("WhatsApp pitch copied to clipboard!");
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  // 4. Social Graphic Studio State
  const [socialTheme, setSocialTheme] = useState<SocialTheme>("coral");
  const [socialTagline, setSocialTagline] = useState<string>(LOCALEATS_POSTER_HEADLINE);
  const [posterEditorOpen, setPosterEditorOpen] = useState(false);
  const [posterRevision, setPosterRevision] = useState(0);
  const [posterReady, setPosterReady] = useState(false);
  const [featuredSocialItemId, setFeaturedSocialItemId] = useState<string | number>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const featuredSocialItem = useMemo(() => {
    if (!featuredSocialItemId) return null;
    return storeMenuItems.find((i) => String(i.id) === String(featuredSocialItemId)) || null;
  }, [featuredSocialItemId, storeMenuItems]);

  // The caption promotes discovery without claiming a live discount or enabled checkout.
  const socialCaption = useMemo(() => {
    const shopName = activeShop?.name || "our local shop";
    return "Discover " + shopName + " on LocalEats! " + postableBrandCopy
      + " Browse: " + storeUrl + " | Can't scan? " + LOCALEATS_DOMAIN
      + " #LocalEats #SupportLocal";
  }, [activeShop, storeUrl]);

  // Render the complete QR before allowing a poster to download.
  // This avoids the old race where canvas.toDataURL captured a blank QR box.
  const posterRenderRequest = useRef(0);
  const renderSocialGraphic = useCallback(async () => {
    const request = ++posterRenderRequest.current;
    setPosterReady(false);
    if (!activeShop || !qrDataUrl || !canvasRef.current) return;
    try {
      const qrImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("The branded QR preview could not load."));
        img.src = qrDataUrl;
      });
      if (request !== posterRenderRequest.current || !canvasRef.current) return;
      drawRecommendedLocalEatsPoster(canvasRef.current, {
        shopName: activeShop.name || "LocalEats shop",
        shopLocation: activeShop.address || activeShop.location || "",
        headline: socialTagline,
        featuredItem: featuredSocialItem
          ? { name: featuredSocialItem.name, price: featuredSocialItem.price } : null,
        theme: socialTheme,
        qrImage,
      });
      setPosterReady(true);
    } catch (error) {
      console.error("LocalEats poster generation failed:", error);
      if (request === posterRenderRequest.current) setPosterReady(false);
    }
  }, [activeShop, qrDataUrl, socialTheme, socialTagline, featuredSocialItem]);

  useEffect(() => {
    if (mainSegment === "tool_library" && activeTool === "social_studio") {
      void renderSocialGraphic();
    }
    return () => { posterRenderRequest.current++; };
  }, [mainSegment, activeTool, renderSocialGraphic, posterRevision]);

  // Download Social Graphic Image
  const handleDownloadSocialGraphic = () => {
    const canvas = canvasRef.current;
    if (!canvas || !posterReady || !activeShop || !qrDataUrl) {
      toast.error("Your branded poster is still loading. Please try again.");
      return;
    }
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `LocalEats_Poster_${activeShop?.name || "Shop"}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Social graphic downloaded successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Could not download graphic. Try taking a screenshot.");
    }
  };

  // 5. PDF Flyer & Counter Stand Generator (A4 / Table Tent)
  const generatePdfFlyer = () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const shopName = activeShop?.name || "LocalEats Eatery";
      const shopLocation = activeShop?.address || activeShop?.location || activeShop?.city || "Township Store";
      const shopPhone = activeShop?.phone || activeShop?.whatsapp || "";

      // Header Banner
      doc.setFillColor(234, 88, 12); // #EA580C
      doc.rect(0, 0, 210, 45, "F");

      // Platform badge
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("LOCALEATS SA - OFFICIAL STORE", 105, 18, { align: "center" });

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Explore menus | Pickup only | Pay at shop", 105, 28, { align: "center" });

      // Shop Name Heading
      doc.setTextColor(15, 23, 42); // #0F172A
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.text(shopName, 105, 65, { align: "center" });

      doc.setFontSize(14);
      doc.setTextColor(234, 88, 12);
      doc.text("SCAN TO EXPLORE OUR MENU", 105, 75, { align: "center" });

      // Frame around QR code
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(1);
      doc.roundedRect(45, 88, 120, 120, 6, 6, "S");

      // Add QR Code Image if available
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, "PNG", 55, 98, 100, 100);
      }

      // Step-by-step instructions box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(25, 218, 160, 40, 4, 4, "F");

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text("EXPLORE LOCAL FOOD IN 3 STEPS:", 105, 227, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("1. Open your phone camera & scan the QR code above.", 35, 236);
      doc.text("2. Browse the available menus and prices.", 35, 243);
      doc.text("3. If ordering is available, collect and pay at the shop.", 35, 250);

      // Footer bar
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 268, 210, 29, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`📍 Location: ${shopLocation}`, 105, 278, { align: "center" });

      if (shopPhone) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`📞 Phone / WhatsApp: ${shopPhone}  •  🌐 ${storeUrl}`, 105, 286, { align: "center" });
      }

      doc.save(`LocalEats_Counter_Flyer_${shopName.replace(/\s+/g, "_")}.pdf`);
      toast.success("Printable A4 Counter Stand Flyer downloaded!");
    } catch (e) {
      console.error("PDF Flyer Generation Error:", e);
      toast.error("Failed to generate PDF flyer.");
    }
  };

  // LocalEats brand campaign preview; never creates or promises a live reward.
  const generateRewardsTeaserPdf = () => {
    if (!qrDataUrl) {
      toast.error("The shop QR code is still loading. Please try again.");
      return;
    }
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.setFillColor(234, 88, 12);
      doc.rect(0, 0, 210, 75, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("LOCALEATS REWARDS", 105, 20, { align: "center" });
      doc.setFontSize(38);
      doc.text("A FREE KOTA?", 105, 43, { align: "center" });
      doc.setFontSize(18);
      doc.text("COMING SOON", 105, 60, { align: "center" });

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("LOCAL FOOD. FUTURE REWARDS.", 105, 91, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("Explore your neighbourhood's menus on LocalEats.", 105, 101, { align: "center" });

      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(57, 108, 96, 96, 5, 5, "S");
      doc.addImage(qrDataUrl, "PNG", 65, 116, 80, 80);
      doc.setFontSize(11);
      doc.text("Scan to explore this shop", 105, 212, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      const shopLabel = String(activeShop?.name || "LocalEats shops").slice(0, 36);
      doc.text(shopLabel, 105, 222, { align: "center" });

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(16, 231, 178, 35, 4, 4, "F");
      doc.setTextColor(51, 65, 85);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Preview only - rewards are not active.", 105, 241, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("No purchases currently earn or redeem free food.", 105, 249, { align: "center" });
      doc.text("Launch date, eligible shops and full terms will be shown in the app.", 105, 257, { align: "center" });

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 276, 210, 21, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("PICKUP ONLY  |  PAY AT SHOP", 105, 288, { align: "center" });
      doc.save("LocalEats_Rewards_Free_Kota_Coming_Soon.pdf");
      toast.success("LocalEats Rewards coming-soon flyer downloaded (no active offer).");
    } catch (error) {
      console.error("Rewards teaser PDF generation failed", error);
      toast.error("Could not generate the LocalEats Rewards teaser PDF.");
    }
  };

  // Direct Browser Print
  const handleDirectPrint = () => {
    window.print();
  };

  // SMS Text State
  const smsText = useMemo(() => {
    const shopName = activeShop?.name || "Our Shop";
    return `Hi! Explore the menu for ${shopName} on LocalEats. Pickup only, pay at the shop when ordering is available: ${storeUrl}`;
  }, [activeShop, storeUrl]);

  return (
    <div className="w-full space-y-6">
      {/* 1. Header Banner & Store Selection */}
      <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-xs">
              <Megaphone size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-on-surface flex items-center gap-2">
                <span>Marketing</span>
              </h2>
              <p className="text-xs text-on-surface-variant">
                Help more people discover your shop. Share real menu information; pickup ordering is available only when shown in the customer app.
              </p>
            </div>
          </div>
        </div>

        {/* Multi-Store Switcher (if merchant has more than 1 store) */}
        {userOwnedShops.length > 1 && (
          <div className="flex items-center gap-2 bg-surface-container-high/60 p-1.5 rounded-2xl border border-outline-variant/15 shrink-0 overflow-x-auto">
            <div className="flex items-center gap-1 px-2 text-xs font-bold text-on-surface-variant shrink-0">
              <Store size={14} className="text-primary" />
              <span>Store:</span>
            </div>
            {userOwnedShops.map((shop) => (
              <button
                key={shop.id}
                onClick={() => {
                  setSelectedShopId(shop.id);
                  setUserEditedMessage(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  String(activeShop?.id) === String(shop.id)
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                {shop.name}
              </button>
            ))}
          </div>
        )}
      </div>

{/* M4.1: four owner-facing actions. Legacy campaign/analytics controls remain dormant. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Marketing actions">
        {([
          { key: "whatsapp", label: "Share My Shop", description: "Shop link and WhatsApp", icon: MessageSquare },
          { key: "social_studio", label: "Create Poster", description: "Make a social graphic", icon: Palette },
          { key: "qr_stands", label: "QR & Flyers", description: "Printable materials", icon: QrCode },
          { key: "playbook", label: "Marketing Tips", description: "Free local ideas", icon: Sparkles },
        ] as const).map(({key, label, description, icon: Icon}) => (
          <button key={key} type="button" disabled={!activeShop}
            aria-pressed={activeTool === key}
            onClick={() => { setMainSegment("tool_library"); setActiveTool(key); }}
            className={`min-h-24 text-left p-4 rounded-2xl border transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${activeTool === key ? "bg-primary text-on-primary border-primary shadow-sm" : "bg-surface-container-lowest text-on-surface border-outline-variant/15 hover:bg-surface-container-high"} disabled:opacity-50`}>
            <Icon size={22} aria-hidden="true" />
            <span className="block mt-2 text-sm font-black">{label}</span>
            <span className="block mt-1 text-xs opacity-80">{description}</span>
          </button>
        ))}
      </div>
      {!activeShop && <p role="status" className="text-sm text-on-surface-variant">Select a shop you own to create shop-specific marketing materials.</p>}

            {/* 3. SEGMENT CONTENT */}

      {/* ========================================================================= */}
      {/* SEGMENT 1: DASHBOARD SUMMARY (EXECUTIVE GROWTH PULSE & QUICK ACTIONS)     */}
      {/* ========================================================================= */}
      {false && mainSegment === "dashboard" && (
        <div className="space-y-6">
          {/* Executive Metrics Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Total Diners Reached
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Users size={16} />
                </div>
              </div>
              <p className="text-2xl font-black text-on-surface">{dinerStats.totalUniqueDiners}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">Unique customer profiles</p>
            </div>

            <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Repeat Diners
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Flame size={16} />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-on-surface">{dinerStats.repeatCount}</p>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  {dinerStats.repeatRate}% loyalty
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1">Ordered 2+ times</p>
            </div>

            <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Avg Diner Spend
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Zap size={16} />
                </div>
              </div>
              <p className="text-2xl font-black text-on-surface">R{dinerStats.avgSpend || 0}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">Average basket value</p>
            </div>

            <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Total Orders Driven
                </span>
                <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                  <Store size={16} />
                </div>
              </div>
              <p className="text-2xl font-black text-on-surface">{dinerStats.totalOrders}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">Direct from LocalEats</p>
            </div>
          </div>

          {/* 1-Tap Quick Action Growth Boosters */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
                  <Zap size={18} className="text-amber-500" />
                  <span>1-Tap Quick Action Boosters</span>
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Instant marketing actions designed for busy restaurant and kota shop operators.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Booster 1: Lunch Rush */}
              <div
                onClick={() => handleLaunchQuickAction("flash_deals")}
                className="p-4 rounded-2xl bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/20 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-xl bg-orange-500 text-white font-bold text-xs">
                      <Flame size={15} />
                    </span>
                    <span className="text-[10px] font-black uppercase text-orange-600 bg-orange-100 dark:bg-orange-950/60 px-2 py-0.5 rounded-full">
                      11:30 Rush
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">
                    Launch Flash Deal
                  </h4>
                  <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">
                    Trigger a 15% discount for 3 hours to capture lunch break hunger.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-orange-500/15 flex items-center justify-between text-xs font-bold text-orange-600">
                  <span>Start Deal</span>
                  <span>→</span>
                </div>
              </div>

              {/* Booster 2: Win Back Diners */}
              <div
                onClick={() => handleLaunchQuickAction("direct_reach")}
                className="p-4 rounded-2xl bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-xl bg-blue-600 text-white font-bold text-xs">
                      <Users size={15} />
                    </span>
                    <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
                      Loyalty
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">
                    Win Back Inactive Diners
                  </h4>
                  <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">
                    Send 1-tap WhatsApp greetings with a discount to diners who haven't ordered in 14d.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-blue-500/15 flex items-center justify-between text-xs font-bold text-blue-600">
                  <span>View Diners</span>
                  <span>→</span>
                </div>
              </div>

              {/* Booster 3: Table Tents */}
              <div
                onClick={() => handleLaunchQuickAction("table_tents")}
                className="p-4 rounded-2xl bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-xl bg-emerald-600 text-white font-bold text-xs">
                      <Utensils size={15} />
                    </span>
                    <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                      Dine-In
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">
                    Print Table Cards (PDF)
                  </h4>
                  <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">
                    Batch generate QR tent cards for tables 1–20 for direct table ordering.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-emerald-500/15 flex items-center justify-between text-xs font-bold text-emerald-600">
                  <span>Generate PDF</span>
                  <span>→</span>
                </div>
              </div>

              {/* Booster 4: Counter Flyer */}
              <div
                onClick={() => handleLaunchQuickAction("qr_stands")}
                className="p-4 rounded-2xl bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/20 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-xl bg-purple-600 text-white font-bold text-xs">
                      <Printer size={15} />
                    </span>
                    <span className="text-[10px] font-black uppercase text-purple-600 bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 rounded-full">
                      Counter
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">
                    Counter Stand Flyer
                  </h4>
                  <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">
                    Print high-res A4 counter stand flyers for takeaway bags and cash registers.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-purple-500/15 flex items-center justify-between text-xs font-bold text-purple-600">
                  <span>View & Print</span>
                  <span>→</span>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Storefront Sharing & Live QR Link */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
                    <Store size={18} className="text-primary" />
                    <span>Your Live Online Storefront</span>
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Share your LocalEats shop link so customers can browse menus. Pickup availability is shown in-app.
                  </p>
                </div>
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full uppercase">
                  Menu Link Available
                </span>
              </div>

              <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/15 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={storeUrl}
                  className="flex-1 bg-transparent border-none text-xs font-mono text-on-surface px-2 outline-none"
                />
                <button
                  onClick={copyStoreUrl}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  {copiedLink ? <Check size={14} className="text-white" /> : <Copy size={14} />}
                  <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <button
                  onClick={() => handleLaunchQuickAction("whatsapp")}
                  className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <MessageSquare size={15} />
                  <span>Share on WhatsApp</span>
                </button>

                <button
                  onClick={() => handleLaunchQuickAction("social_studio")}
                  className="p-3 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold flex items-center justify-center gap-2 border border-outline-variant/20 transition-all cursor-pointer"
                >
                  <Palette size={15} className="text-primary" />
                  <span>Create Social Post</span>
                </button>

                <button
                  onClick={() => setActiveTool("playbook")}
                  className="p-3 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold flex items-center justify-center gap-2 border border-outline-variant/20 transition-all cursor-pointer"
                >
                  <Ticket size={15} className="text-primary" />
                  <span>Create Voucher</span>
                </button>
              </div>
            </div>

            {/* Quick QR Code Card */}
            <div className="lg:col-span-4 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-inner">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Store QR Code" className="w-36 h-36 rounded-xl object-contain mx-auto" />
                ) : (
                  <div className="w-36 h-36 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                    <QrCode size={36} />
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-extrabold text-on-surface">{activeShop?.name || "LocalEats Store"}</p>
                <p className="text-[11px] text-on-surface-variant">Scan to Explore Menu</p>
              </div>
              <div className="w-full grid grid-cols-2 gap-2">
                <a
                  href={qrDataUrl}
                  download={`QR_${activeShop?.name || "Store"}.png`}
                  className="py-2 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[11px] font-bold flex items-center justify-center gap-1 border border-outline-variant/20 cursor-pointer"
                >
                  <Download size={13} />
                  <span>PNG</span>
                </a>
                <button
                  onClick={() => handleLaunchQuickAction("qr_stands")}
                  className="py-2 px-3 rounded-xl bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Print Stand</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEGMENT 2: CAMPAIGN BUILDER (DEDICATED INTERACTIVE CAMPAIGN & VOUCHERS)   */}
      {/* ========================================================================= */}
      {false && mainSegment === "campaign_builder" && (
        <CampaignBuilder
          activeShop={activeShop}
          storeMenuItems={storeMenuItems}
          storeUrl={storeUrl}
        />
      )}

      {/* ========================================================================= */}
      {/* SEGMENT 3: TOOL LIBRARY (CATEGORIZED TOOL SUITE)                          */}
      {/* ========================================================================= */}
      {mainSegment === "tool_library" && (
        <div className="space-y-6">
          {/* Four-action navigation above replaces the legacy eight-tool submenu. */}
                    {/* ACTIVE TOOL RENDERING */}

          {activeTool === "whatsapp" && activeShop && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-sm text-on-surface">Your shop link</p>
                <p className="text-xs break-all text-on-surface-variant">{storeUrl}</p>
              </div>
              <button type="button" onClick={copyStoreUrl}
                className="rounded-xl bg-primary text-on-primary px-4 py-2.5 text-xs font-bold flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                {copiedLink ? "Copied" : "Copy Shop Link"}
              </button>
            </div>
          )}
          {/* Tool 1: Direct Customer Reach & Diners */}
          {false && activeTool === "direct_reach" && (
            <CustomerReEngagement
              activeShop={activeShop}
              orders={shopOrders}
              menuItems={storeMenuItems}
              storeUrl={storeUrl}
            />
          )}

          {/* Tool 2: Timed Flash Deals */}
          {false && activeTool === "flash_deals" && (
            <FlashDealsStudio
              activeShop={activeShop}
              menuItems={storeMenuItems}
              storeUrl={storeUrl}
            />
          )}

          {/* Tool 3: Table Tent Card Generator */}
          {false && activeTool === "table_tents" && (
            <TableTentGenerator
              activeShop={activeShop}
              storeUrl={storeUrl}
            />
          )}

          {/* Tool 4: QR Stands & Printable A4 Flyers */}
          {activeTool === "qr_stands" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Customization Controls */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-5">
                  <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
                    <Palette size={18} className="text-primary" />
                    <span>Customize Stand & QR Code</span>
                  </h3>

                  {/* QR Style Preset */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-2">QR Code Color Theme</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setQrStyle("coral")}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                          qrStyle === "coral"
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                            : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-[#EA580C] shadow-xs" />
                        <span className="text-[11px]">Brand Coral</span>
                      </button>

                      <button
                        onClick={() => setQrStyle("dark")}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                          qrStyle === "dark"
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                            : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-[#0F172A] shadow-xs" />
                        <span className="text-[11px]">Midnight Dark</span>
                      </button>

                      <button
                        onClick={() => setQrStyle("standard")}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                          qrStyle === "standard"
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                            : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-slate-400 shadow-xs" />
                        <span className="text-[11px]">Classic Crisp</span>
                      </button>
                    </div>
                  </div>

                  {/* Frame Label */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-2">Display Stand Heading</label>
                    <select
                      value={qrFrameText}
                      onChange={(e) => setQrFrameText(e.target.value)}
                      className="w-full bg-surface-container-high border-none rounded-xl px-3.5 py-2.5 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="SCAN TO VIEW MENU">SCAN TO VIEW MENU</option>
                      <option value="TABLE & COUNTER MENU">TABLE & COUNTER MENU</option>
                      <option value="VIEW PICKUP OPTIONS">VIEW PICKUP OPTIONS</option>
                      <option value="SCAN FOR MENU & PRICES">SCAN FOR MENU & PRICES</option>
                    </select>
                  </div>

                  {/* Direct Store URL display & Copy */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1.5">Direct Online Store URL</label>
                    <div className="flex items-center gap-2 p-2 bg-surface-container-low rounded-2xl border border-outline-variant/15">
                      <input
                        type="text"
                        readOnly
                        value={storeUrl}
                        className="flex-1 bg-transparent border-none text-xs font-mono text-on-surface px-2 outline-none"
                      />
                      <button
                        onClick={copyStoreUrl}
                        className="px-3 py-1.5 bg-surface-container-highest hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        {copiedLink ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        <span>{copiedLink ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Download & Print Actions */}
                  <div className="space-y-2.5 pt-2 border-t border-outline-variant/10">
                    <button
                      onClick={generatePdfFlyer}
                      className="w-full py-3 rounded-2xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-all cursor-pointer"
                    >
                      <FileText size={16} />
                      <span>Download A4 Printable Flyer (PDF)</span>
                    </button>
                    <button
                      type="button"
                      onClick={generateRewardsTeaserPdf}
                      className="w-full py-3 rounded-2xl bg-surface-container-high text-on-surface text-xs font-bold flex items-center justify-center gap-2 border border-outline-variant/20 hover:bg-surface-container-highest transition-all cursor-pointer"
                    >
                      <Gift size={16} />
                      <span>Download Free Kota Teaser (PDF)</span>
                    </button>
                    <p className="text-[11px] text-on-surface-variant leading-snug">
                      Rewards COMING SOON. This teaser does not promise a live free kota; no purchases earn rewards yet.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={qrDataUrl}
                        download={`QR_Code_${activeShop?.name || "LocalEats"}.png`}
                        className="py-2.5 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-outline-variant/20"
                      >
                        <Download size={15} />
                        <span>Download PNG</span>
                      </a>

                      <button
                        onClick={handleDirectPrint}
                        className="py-2.5 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-outline-variant/20"
                      >
                        <Printer size={15} />
                        <span>Print Direct</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Live Stand Mockup Preview */}
              <div className="lg:col-span-7 flex flex-col items-center justify-center">
                <div className="w-full max-w-md bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/15 shadow-xl text-center space-y-6 relative overflow-hidden">
                  {/* Stand Header Ribbon */}
                  <div className="bg-primary text-on-primary py-2 px-6 rounded-2xl inline-block shadow-md">
                    <p className="text-xs font-black tracking-wider uppercase">{qrFrameText}</p>
                  </div>

                  <div>
                    <h2 className="text-2xl font-black text-on-surface tracking-tight">{activeShop?.name || "My Store"}</h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {activeShop?.address || activeShop?.location || activeShop?.city || "Township Store"}
                    </p>
                  </div>

                  {/* QR Code Container */}
                  <div className="p-4 bg-white rounded-3xl shadow-inner border border-slate-200 inline-block">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Store QR Code"
                        className="w-56 h-56 rounded-2xl object-contain mx-auto"
                      />
                    ) : (
                      <div className="w-56 h-56 bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center text-slate-400">
                        <QrCode size={48} />
                      </div>
                    )}
                  </div>

                  {/* Ordering Steps Pill */}
                  <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/15 text-left space-y-1.5">
                    <p className="text-xs font-extrabold text-on-surface text-center mb-1">How customers browse:</p>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                      <span>Open Camera & Scan QR Code</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                      <span>Browse the menu and prices</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                      <span>Pay at the shop when ordering is available</span>
                    </div>
                  </div>

                  {/* Footer Trust Signals */}
                  <div className="flex items-center justify-center gap-4 text-[11px] font-bold text-on-surface-variant/80 pt-1">
                    <span className="flex items-center gap-1">
                      <Utensils size={13} className="text-primary" /> Pickup Only
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Store size={13} className="text-primary" /> Pay at Shop
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tool 5: Share My Shop */}
          {activeTool === "whatsapp" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Preset Selector & Customizer */}
              <div className="lg:col-span-6 space-y-5">
                <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-4">
                  <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
                    <MessageSquare size={18} className="text-emerald-500" />
                    <span>Choose a Share Message</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => {
                        setSelectedPreset("opening");
                        setUserEditedMessage(null);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedPreset === "opening"
                          ? "border-emerald-500 bg-emerald-500/10 text-on-surface font-bold"
                          : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <Flame size={14} className="text-orange-500" /> Grand Opening
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Invite customers to browse your menu</p>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedPreset("lunch");
                        setUserEditedMessage(null);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedPreset === "lunch"
                          ? "border-emerald-500 bg-emerald-500/10 text-on-surface font-bold"
                          : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <Utensils size={14} className="text-amber-500" /> Lunch Rush (11:30)
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Post before lunch breaks</p>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedPreset("item_deal");
                        setUserEditedMessage(null);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedPreset === "item_deal"
                          ? "border-emerald-500 bg-emerald-500/10 text-on-surface font-bold"
                          : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <Gift size={14} className="text-primary" /> Menu Spotlight
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Feature a specific Kota / meal</p>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedPreset("pickup");
                        setUserEditedMessage(null);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedPreset === "pickup"
                          ? "border-emerald-500 bg-emerald-500/10 text-on-surface font-bold"
                          : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <Utensils size={14} className="text-blue-500" /> Pickup Only
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Promote menu browsing and pickup</p>
                    </button>



                    <button
                      onClick={() => {
                        setSelectedPreset("weekend");
                        setUserEditedMessage(null);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedPreset === "weekend"
                          ? "border-emerald-500 bg-emerald-500/10 text-on-surface font-bold"
                          : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <Sparkles size={14} className="text-rose-500" /> Weekend Vibes
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Family & gathering promos</p>
                    </button>
                  </div>

                  {/* Dynamic Option Inputs */}
                  {(selectedPreset === "item_deal" || selectedPreset === "lunch") && storeMenuItems.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-1.5">Select Featured Menu Item</label>
                      <select
                        value={customFeaturedItem}
                        onChange={(e) => {
                          setCustomFeaturedItem(e.target.value);
                          setUserEditedMessage(null);
                        }}
                        className="w-full bg-surface-container-high border-none rounded-xl px-3.5 py-2.5 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary outline-none"
                      >
                        {storeMenuItems.map((item) => (
                          <option key={item.id} value={item.name}>
                            {item.name} — R{item.price}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedPreset === "discount" && (
                    <p className="rounded-xl bg-surface-container-low p-3 text-xs text-on-surface-variant">
                      This message only links to offers confirmed inside LocalEats. It does not create or activate a voucher code.
                    </p>
                  )}

                  {/* Editable Message Box */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1.5 flex items-center justify-between">
                      <span>Custom Message Content</span>
                      <span className="text-[11px] font-normal text-on-surface-variant font-mono">
                        {activeMessage.length} characters
                      </span>
                    </label>
                    <textarea
                      rows={6}
                      value={activeMessage}
                      onChange={(e) => setUserEditedMessage(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/15 rounded-2xl p-3.5 text-xs text-on-surface font-sans leading-relaxed focus:ring-2 focus:ring-primary outline-none resize-none"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleOpenWhatsApp}
                      className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                    >
                      <MessageSquare size={16} />
                      <span>Share on WhatsApp</span>
                    </button>

                    <button
                      onClick={handleCopyMessage}
                      className="px-4 py-3 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 border border-outline-variant/20 transition-all cursor-pointer"
                    >
                      {copiedMsg ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      <span>{copiedMsg ? "Copied!" : "Copy Text"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: WhatsApp Chat Bubble Mockup */}
              <div className="lg:col-span-6 flex flex-col justify-center">
                <div className="bg-[#E5DDD5] dark:bg-[#0B141A] p-6 rounded-3xl border border-outline-variant/15 shadow-md space-y-4">
                  <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                        {activeShop?.name ? activeShop.name.slice(0, 2).toUpperCase() : "LE"}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {activeShop?.name || "LocalEats Merchant"}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">WhatsApp Status / Broadcast Preview</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                      Live Preview
                    </span>
                  </div>

                  {/* Chat Bubble */}
                  <div className="bg-[#DCF8C6] dark:bg-[#005C4B] p-4 rounded-2xl rounded-tr-none shadow-xs text-slate-900 dark:text-white text-xs leading-relaxed whitespace-pre-wrap font-sans">
                    {activeMessage}
                  </div>

                  <div className="p-3 bg-white/60 dark:bg-black/40 rounded-2xl text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-500 shrink-0" />
                    <span>
                      <strong>Merchant Tip:</strong> Post this to your WhatsApp Status at <strong>11:30 AM</strong> before lunch, or share with local community groups!
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tool 6: Recommended LocalEats poster with optional editing */}
          {activeTool === "social_studio" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5">
                <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-5">
                  <div className="flex items-center gap-2">
                    <Palette size={20} className="text-primary" />
                    <h3 className="font-extrabold text-base text-on-surface">Ready-to-share poster</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    We created a LocalEats poster for your shop. Download it now or make small edits.
                    Offers are shown only when available in the app.
                  </p>
                  <div className="rounded-xl bg-surface-container-low p-3 text-xs text-on-surface-variant">
                    <p className="font-bold text-on-surface">{activeShop?.name || "Your shop"}</p>
                    <p className="mt-1">{LOCALEATS_DOMAIN} · LocalEats since 2023</p>
                  </div>
                  <button type="button" onClick={handleDownloadSocialGraphic} disabled={!posterReady || !activeShop}
                    className="w-full min-h-12 py-3 rounded-2xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    <Download size={17} />
                    <span>{posterReady ? "Download Poster (PNG)" : "Preparing your poster..."}</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => {
                      setSocialTheme("coral");
                      setSocialTagline(LOCALEATS_POSTER_HEADLINE);
                      setFeaturedSocialItemId("");
                      setPosterRevision((v) => v + 1);
                    }} className="min-h-11 rounded-xl border border-outline-variant/30 px-3 text-xs font-bold text-on-surface hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                      Regenerate
                    </button>
                    <button type="button" aria-expanded={posterEditorOpen}
                      onClick={() => setPosterEditorOpen((v) => !v)}
                      className="min-h-11 rounded-xl border border-outline-variant/30 px-3 text-xs font-bold text-on-surface hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                      {posterEditorOpen ? "Close Editor" : "Edit Text"}
                    </button>
                  </div>
                  {posterEditorOpen && (
                    <div className="space-y-4 border-t border-outline-variant/20 pt-4">
                      <div>
                        <label htmlFor="localeats-poster-headline" className="block text-xs font-bold text-on-surface mb-1.5">Headline</label>
                        <input id="localeats-poster-headline" type="text" maxLength={70}
                          value={socialTagline} onChange={(e) => setSocialTagline(e.target.value)}
                          className="w-full bg-surface-container-high rounded-xl px-3 py-2.5 text-xs text-on-surface focus:ring-2 focus:ring-primary outline-none" />
                      </div>
                      {storeMenuItems.length > 0 && (
                        <div>
                          <label htmlFor="localeats-poster-item" className="block text-xs font-bold text-on-surface mb-1.5">Featured item (optional)</label>
                          <select id="localeats-poster-item" value={featuredSocialItemId}
                            onChange={(e) => setFeaturedSocialItemId(e.target.value)}
                            className="w-full bg-surface-container-high rounded-xl px-3 py-2.5 text-xs text-on-surface focus:ring-2 focus:ring-primary outline-none">
                            <option value="">Browse LocalEats menus</option>
                            {storeMenuItems.map((item) => <option key={item.id} value={item.id}>{item.name} (R{item.price})</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-on-surface mb-2">Poster colour (optional)</p>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            ["coral", "LocalEats Orange"], ["dark", "Midnight"], ["golden", "Golden"], ["emerald", "Fresh Green"]
                          ] as const).map(([theme, label]) => (
                            <button key={theme} type="button" aria-pressed={socialTheme === theme}
                              onClick={() => setSocialTheme(theme)}
                              className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${socialTheme === theme ? "bg-primary/10 border-primary text-primary" : "bg-surface-container-low border-outline-variant/20 text-on-surface"}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="border-t border-outline-variant/10 pt-3">
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-xs font-bold text-on-surface">Social caption</span>
                      <button type="button" onClick={() => {
                        void navigator.clipboard.writeText(socialCaption).then(() => {
                          setCopiedCaption(true);
                          toast.success("Caption copied!");
                          setTimeout(() => setCopiedCaption(false), 2000);
                        }).catch(() => toast.error("Unable to copy caption."));
                      }} className="text-xs font-bold text-primary">
                        {copiedCaption ? "Copied" : "Copy Caption"}
                      </button>
                    </div>
                    <p className="mt-2 rounded-xl bg-surface-container-low p-3 text-[11px] text-on-surface-variant leading-relaxed break-all">{socialCaption}</p>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xl text-center space-y-4 w-full max-w-lg mx-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-on-surface flex items-center gap-1.5">
                      <Eye size={14} className="text-primary" /> Poster Preview
                    </span>
                    <span className="text-[10px] text-on-surface-variant">1080 × 1080 PNG</span>
                  </div>
                  <div className="relative w-full aspect-square bg-surface-container-low rounded-2xl overflow-hidden shadow-md flex items-center justify-center border border-outline-variant/20">
                    <canvas ref={canvasRef} className="w-full h-full object-contain" aria-label="LocalEats branded shop poster preview" role="img" />
                    {!posterReady && <span role="status" className="absolute inset-0 flex items-center justify-center bg-surface-container-lowest/90 p-4 text-xs text-on-surface-variant">Preparing your branded QR poster...</span>}
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    The QR opens your shop. The short website address helps customers who cannot scan.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tool 7: SMS Broadcast */}
          {false && activeTool === "sms" && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Smartphone size={20} className="text-primary" />
                  <h3 className="font-extrabold text-base text-on-surface">SMS Customer Broadcast</h3>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Copy this standard single-credit SMS text message (under 160 characters) to send to your loyal customer phone list.
                </p>

                <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/15 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-on-surface">
                    <span>SMS Copy</span>
                    <span className={`font-mono text-[11px] ${smsText.length <= 160 ? "text-emerald-500" : "text-amber-500"}`}>
                      {smsText.length} / 160 characters ({Math.ceil(smsText.length / 160)} SMS)
                    </span>
                  </div>
                  <p className="text-xs font-mono text-on-surface bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10 leading-relaxed">
                    {smsText}
                  </p>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(smsText);
                    setCopiedSms(true);
                    toast.success("SMS broadcast copied to clipboard!");
                    setTimeout(() => setCopiedSms(false), 2000);
                  }}
                  className="w-full py-3 rounded-2xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-all cursor-pointer"
                >
                  {copiedSms ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  <span>{copiedSms ? "Copied SMS Text!" : "Copy SMS to Clipboard"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Tool 8: Local Growth Playbook */}
          {activeTool === "playbook" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold">
                  ⏰
                </div>
                <h3 className="font-extrabold text-base text-on-surface">1. The 11:30 AM Status Strategy</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Try a short lunch-time status featuring a genuine menu item and its real price. Include your LocalEats menu link, but do not promise ordering or a discount unless it is available in the app.
                </p>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                  🛍️
                </div>
                <h3 className="font-extrabold text-base text-on-surface">2. Takeaway Bag QR Flyers</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Print our A4 / small flyers and stick them on top of every takeaway box or brown paper bag. When walk-in customers get home, they can scan to explore the menu on LocalEats.
                </p>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                  💬
                </div>
                <h3 className="font-extrabold text-base text-on-surface">3. Community WhatsApp Groups</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Share your store link in relevant neighborhood groups. Explain that LocalEats is pickup-only, with payment at the shop when ordering is available.
                </p>
              </div>

     </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Marketing;
