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
  Truck,
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
import QRCodeLib from "qrcode";
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
    return owned.length > 0 ? owned : (currentShop ? [currentShop] : []);
  }, [shops, user, currentShop]);

  const [selectedShopId, setSelectedShopId] = useState<string | number | null>(null);

  const activeShop: Shop | undefined = useMemo(() => {
    if (selectedShopId !== null) {
      const match = userOwnedShops.find((s) => String(s.id) === String(selectedShopId));
      if (match) return match;
    }
    return currentShop || userOwnedShops[0];
  }, [userOwnedShops, selectedShopId, currentShop]);

  // Filter menu items for selected store
  const storeMenuItems = useMemo(() => {
    if (!activeShop) return menuItems;
    return menuItems.filter((item) => String(item.shop_id) === String(activeShop.id));
  }, [menuItems, activeShop]);

  // Main Segment Navigation: Dashboard Summary, Campaign Builder, Tool Library
  const [mainSegment, setMainSegment] = useState<MainSegment>("dashboard");

  // Sub-Tab within Tool Library
  const [activeTool, setActiveTool] = useState<ToolSubTab>("direct_reach");

  // Store URL
  const storeUrl = useMemo(() => {
    if (!activeShop) return "https://www.localeatssa.co.za";
    return `https://www.localeatssa.co.za/?shopId=${activeShop.id}`;
  }, [activeShop]);

  // High-Level Diner Analytics for Dashboard Summary
  const shopOrders = useMemo(() => {
    if (!activeShop) return orders;
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
    const avgSpend = totalUniqueDiners > 0 ? Math.round(totalRevenue / totalUniqueDiners) : 0;

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
  const [qrFrameText, setQrFrameText] = useState<string>("SCAN TO ORDER ONLINE");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  // Generate QR Code
  useEffect(() => {
    let isMounted = true;
    const generateQR = async () => {
      try {
        let darkColor = "#0F172A";
        const lightColor = "#FFFFFF";

        if (qrStyle === "coral") {
          darkColor = "#EA580C"; // Brand Coral / Orange
        } else if (qrStyle === "dark") {
          darkColor = "#020617";
        }

        const url = await QRCodeLib.toDataURL(storeUrl, {
          width: 500,
          margin: 1,
          color: {
            dark: darkColor,
            light: lightColor,
          },
          errorCorrectionLevel: "H",
        });

        if (isMounted) {
          setQrDataUrl(url);
        }
      } catch (e) {
        console.error("QR Code Generation Error:", e);
      }
    };

    generateQR();
    return () => {
      isMounted = false;
    };
  }, [storeUrl, qrStyle]);

  // Copy Store Link Handler
  const copyStoreUrl = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopiedLink(true);
    toast.success("Store online link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // 3. WhatsApp Promo Studio State
  const [selectedPreset, setSelectedPreset] = useState<string>("opening");
  const [customFeaturedItem, setCustomFeaturedItem] = useState<string>("");
  const [customDiscountCode, setCustomDiscountCode] = useState<string>("LOCAL10");
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
        return `🔥 *${shopName} IS LIVE ON LOCALEATS!* 🔥\n\nSkip the queues! You can now order all our delicious meals directly from your phone for instant pickup or fast local delivery in ${shopLocation}.\n\n👉 *View Menu & Order Here:*\n${storeUrl}\n\n✅ Cash on Arrival & Card Accepted!\n⚡ Powered by LocalEats SA`;
      case "lunch":
        return `🍔 *LUNCH TIME SPECIAL AT ${shopName.toUpperCase()}!* 🕒\n\nHungry? Treat yourself today to our fresh ${featuredItemName} ${priceText}! Order right now on your phone and get fast delivery straight to your door or ready for quick pickup.\n\n📲 *Tap to order now:*\n${storeUrl}\n\nTag your friends and order together! 🛵💨`;
      case "item_deal":
        return `✨ *DEAL OF THE DAY: ${featuredItemName.toUpperCase()}* ✨\n\nMade fresh to order at *${shopName}* ${priceText}.\n\nDon't wait in the cold — order online in 30 seconds:\n👉 ${storeUrl}\n\n📍 Location: ${shopLocation}\n🛵 Local delivery riders available!`;
      case "delivery":
        return `🛵 *TOWNSHIP DELIVERY NOW AVAILABLE!* 📦\n\nGet your favorite meals from *${shopName}* delivered right to your house or workplace!\n\n💳 Pay Cash on Delivery or Card\n📍 Delivering around ${shopLocation}\n\n👉 *Order here:* ${storeUrl}`;
      case "discount":
        return `🎉 *SPECIAL VOUCHER FOR YOU!* 🎁\n\nGet a special discount on your next order from *${shopName}* using code *${customDiscountCode}* at checkout on LocalEats!\n\n👉 *Order & Apply Code:*\n${storeUrl}\n\nValid for online orders. Treat yourself today! 😋`;
      case "weekend":
        return `🔥 *WEEKEND VIBES AT ${shopName.toUpperCase()}!* 🎉\n\nRelax and let us do the cooking! Fresh hot Kotas and township favorites ready for you and your family.\n\n📲 *Order online before we sell out:*\n${storeUrl}\n\nHave a great weekend! 🍻🍔`;
      default:
        return `Order delicious food from ${shopName} online: ${storeUrl}`;
    }
  }, [selectedPreset, activeShop, storeUrl, customFeaturedItem, customDiscountCode, storeMenuItems]);

  const activeMessage = userEditedMessage !== null ? userEditedMessage : generatedMessage;

  // WhatsApp Action Handlers
  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(activeMessage);
    const waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(waUrl, "_blank");
    toast.success("Opening WhatsApp share window...");
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(activeMessage);
    setCopiedMsg(true);
    toast.success("WhatsApp pitch copied to clipboard!");
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  // 4. Social Graphic Studio State
  const [socialTheme, setSocialTheme] = useState<SocialTheme>("coral");
  const [socialTagline, setSocialTagline] = useState<string>("Best Kota & Township Meals");
  const [featuredSocialItemId, setFeaturedSocialItemId] = useState<string | number>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const featuredSocialItem = useMemo(() => {
    if (!featuredSocialItemId) return storeMenuItems[0] || null;
    return storeMenuItems.find((i) => String(i.id) === String(featuredSocialItemId)) || null;
  }, [featuredSocialItemId, storeMenuItems]);

  // Social Media Caption
  const socialCaption = useMemo(() => {
    const shopName = activeShop?.name || "Our Shop";
    const shopLocation = activeShop?.address || activeShop?.location || "Township";
    return `🔥 ${shopName} is now on LocalEats SA! Order your favorite meals online for fast pickup and delivery in ${shopLocation}. 📲 Link in bio or order at: ${storeUrl} #LocalEats #SupportLocal #${shopName.replace(/\s+/g, "")} #TownshipFood #KotaSA #FastDelivery`;
  }, [activeShop, storeUrl]);

  // Draw Social Graphic Canvas
  const renderSocialGraphic = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions (1080x1080 High Res Square Post)
    canvas.width = 1080;
    canvas.height = 1080;

    // Background theme
    let bgGradient;
    const textColor = "#FFFFFF";
    let accentColor = "#FF5A36";

    if (socialTheme === "coral") {
      bgGradient = ctx.createLinearGradient(0, 0, 1080, 1080);
      bgGradient.addColorStop(0, "#EA580C");
      bgGradient.addColorStop(0.5, "#C2410C");
      bgGradient.addColorStop(1, "#9A3412");
      accentColor = "#FEF08A"; // Yellow accent
    } else if (socialTheme === "dark") {
      bgGradient = ctx.createLinearGradient(0, 0, 1080, 1080);
      bgGradient.addColorStop(0, "#0F172A");
      bgGradient.addColorStop(1, "#020617");
      accentColor = "#FF5A36";
    } else if (socialTheme === "golden") {
      bgGradient = ctx.createLinearGradient(0, 0, 1080, 1080);
      bgGradient.addColorStop(0, "#D97706");
      bgGradient.addColorStop(1, "#78350F");
      accentColor = "#FEF3C7";
    } else {
      // Emerald
      bgGradient = ctx.createLinearGradient(0, 0, 1080, 1080);
      bgGradient.addColorStop(0, "#059669");
      bgGradient.addColorStop(1, "#064E3B");
      accentColor = "#A7F3D0";
    }

    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1080, 1080);

    // Subtle background circle patterns
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.arc(900, 150, 300, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(150, 950, 250, 0, Math.PI * 2);
    ctx.fill();

    // Top Platform Badge
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.roundRect(80, 80, 260, 56, 28);
    ctx.fill();

    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("🛵 LOCALEATS SA", 115, 117);

    // Verified Store Badge
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.roundRect(740, 80, 260, 56, 28);
    ctx.fill();
    ctx.fillStyle = accentColor;
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillText("⚡ OFFICIAL STORE", 765, 116);

    // Shop Name
    ctx.font = "900 68px system-ui, sans-serif";
    ctx.fillStyle = textColor;
    const shopName = activeShop?.name || "Local Eatery";
    ctx.fillText(shopName.slice(0, 22), 80, 240);

    // Tagline / Category
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.fillStyle = accentColor;
    ctx.fillText(socialTagline || "Fresh Meals & Fast Delivery", 80, 300);

    // Central Card (Featured item or order callout)
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.roundRect(80, 360, 520, 480, 32);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (featuredSocialItem) {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 26px system-ui, sans-serif";
      ctx.fillText("🔥 FEATURED TODAY", 120, 420);

      ctx.font = "900 44px system-ui, sans-serif";
      ctx.fillStyle = textColor;
      ctx.fillText(featuredSocialItem.name.slice(0, 20), 120, 490);

      ctx.font = "bold 34px system-ui, sans-serif";
      ctx.fillStyle = accentColor;
      ctx.fillText(`R${featuredSocialItem.price}`, 120, 550);

      ctx.font = "24px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillText("• Prepared fresh to order", 120, 620);
      ctx.fillText("• Fast local rider delivery", 120, 665);
      ctx.fillText("• Cash or Card on Arrival", 120, 710);
    } else {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 44px system-ui, sans-serif";
      ctx.fillText("ORDER ONLINE", 120, 470);
      ctx.fillText("IN 3 STEPS", 120, 530);

      ctx.font = "26px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillText("1. Scan QR or click store link", 120, 610);
      ctx.fillText("2. Pick your favorite meal", 120, 665);
      ctx.fillText("3. Fast pickup or delivery!", 120, 720);
    }

    // QR Code Container Box
    ctx.fillStyle = "#FFFFFF";
    ctx.roundRect(650, 360, 350, 480, 32);
    ctx.fill();

    // Draw QR code image onto canvas if ready
    if (qrDataUrl) {
      const qrImg = new window.Image();
      qrImg.crossOrigin = "anonymous";
      qrImg.onload = () => {
        ctx.drawImage(qrImg, 685, 395, 280, 280);
        ctx.fillStyle = "#0F172A";
        ctx.font = "900 24px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SCAN WITH PHONE", 825, 720);
        ctx.font = "bold 20px system-ui, sans-serif";
        ctx.fillStyle = "#EA580C";
        ctx.fillText("TO ORDER NOW", 825, 755);
        ctx.textAlign = "left";
      };
      qrImg.src = qrDataUrl;
    }

    // Bottom Bar (Location & Contact)
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.roundRect(80, 890, 920, 110, 28);
    ctx.fill();

    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    const loc = activeShop?.address || activeShop?.location || activeShop?.city || "Township Store";
    const phone = activeShop?.phone || activeShop?.whatsapp || "WhatsApp Available";
    ctx.fillText(`📍 ${loc.slice(0, 32)}`, 120, 955);
    ctx.fillText(`📞 ${phone}`, 680, 955);
  }, [socialTheme, socialTagline, featuredSocialItem, activeShop, qrDataUrl]);

  useEffect(() => {
    if (mainSegment === "tool_library" && activeTool === "social_studio") {
      const timer = setTimeout(() => {
        renderSocialGraphic();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mainSegment, activeTool, renderSocialGraphic]);

  // Download Social Graphic Image
  const handleDownloadSocialGraphic = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `Promo_${activeShop?.name || "LocalEats"}.png`;
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
      doc.text("Order Online • Fast Local Delivery • Instant Pickup", 105, 28, { align: "center" });

      // Shop Name Heading
      doc.setTextColor(15, 23, 42); // #0F172A
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.text(shopName, 105, 65, { align: "center" });

      doc.setFontSize(14);
      doc.setTextColor(234, 88, 12);
      doc.text("SCAN TO VIEW OUR FULL MENU & ORDER", 105, 75, { align: "center" });

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
      doc.text("HOW TO ORDER IN 3 EASY STEPS:", 105, 227, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("1. Open your phone camera & scan the QR code above.", 35, 236);
      doc.text("2. Choose your favorite meals & add special instructions.", 35, 243);
      doc.text("3. Pay Cash on Arrival or Card — sit back while we prepare!", 35, 250);

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

  // Direct Browser Print
  const handleDirectPrint = () => {
    window.print();
  };

  // SMS Text State
  const smsText = useMemo(() => {
    const shopName = activeShop?.name || "Our Shop";
    return `Hi! Order delicious meals from ${shopName} online for fast pickup & delivery: ${storeUrl}`;
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
                <span>Marketing & Customer Growth Studio</span>
              </h2>
              <p className="text-xs text-on-surface-variant">
                Drive sales, reward loyal diners, and promote your LocalEats store with QR stands, WhatsApp promos & flash deals.
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

      {/* 2. PRIMARY 3-SEGMENT NAVIGATION */}
      <div className="bg-surface-container-lowest p-1.5 rounded-2xl border border-outline-variant/15 grid grid-cols-3 gap-2 shadow-xs">
        {/* Segment 1: Dashboard Summary */}
        <button
          onClick={() => setMainSegment("dashboard")}
          className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
            mainSegment === "dashboard"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          }`}
        >
          <Sparkles size={16} />
          <span>Dashboard Summary</span>
        </button>

        {/* Segment 2: Campaign Builder */}
        <button
          onClick={() => setMainSegment("campaign_builder")}
          className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
            mainSegment === "campaign_builder"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          }`}
        >
          <Ticket size={16} />
          <span>Campaign Builder</span>
        </button>

        {/* Segment 3: Tool Library */}
        <button
          onClick={() => setMainSegment("tool_library")}
          className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
            mainSegment === "tool_library"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          }`}
        >
          <Layers size={16} />
          <span>Tool Library (8)</span>
        </button>
      </div>

      {/* 3. SEGMENT CONTENT */}

      {/* ========================================================================= */}
      {/* SEGMENT 1: DASHBOARD SUMMARY (EXECUTIVE GROWTH PULSE & QUICK ACTIONS)     */}
      {/* ========================================================================= */}
      {mainSegment === "dashboard" && (
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
                    Share this verified store link with customers to let them order online via Cash on Arrival or Card.
                  </p>
                </div>
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full uppercase">
                  ● Live & Accepting Orders
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
                  onClick={() => setMainSegment("campaign_builder")}
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
                <p className="text-[11px] text-on-surface-variant">Instant Scan to Order</p>
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
      {mainSegment === "campaign_builder" && (
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
          {/* Sub-Navigation for Tool Library */}
          <div className="flex items-center gap-1.5 p-1.5 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-x-auto shadow-xs">
            <button
              onClick={() => setActiveTool("direct_reach")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTool === "direct_reach"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <Users size={15} />
              <span>Direct Customer Reach</span>
            </button>

            <button
              onClick={() => setActiveTool("flash_deals")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTool === "flash_deals"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <Flame size={15} />
              <span>Timed Flash Deals</span>
            </button>

            <button
              onClick={() => setActiveTool("table_tents")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTool === "table_tents"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <Utensils size={15} />
              <span>Table Tent Generator</span>
            </button>

            <button
              onClick={() => setActiveTool("qr_stands")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTool === "qr_stands"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <QrCode size={15} />
              <span>Counter Stands & Flyers</span>
            </button>

            <button
              onClick={() => setActiveTool("whatsapp")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTool === "whatsapp"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <MessageSquare size={15} />
              <span>WhatsApp Promos</span>
            </button>

            <button
              onClick={() => setActiveTool("social_studio")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTool === "social_studio"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <Palette size={15} />
              <span>Social Graphic Studio</span>
            </button>

            <button
              onClick={() => setActiveTool("sms")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTool === "sms"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <Smartphone size={15} />
              <span>SMS Broadcast</span>
            </button>

            <button
              onClick={() => setActiveTool("playbook")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTool === "playbook"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <Sparkles size={15} />
              <span>Growth Playbook</span>
            </button>
          </div>

          {/* ACTIVE TOOL RENDERING */}

          {/* Tool 1: Direct Customer Reach & Diners */}
          {activeTool === "direct_reach" && (
            <CustomerReEngagement
              activeShop={activeShop}
              orders={orders}
              menuItems={storeMenuItems}
              storeUrl={storeUrl}
            />
          )}

          {/* Tool 2: Timed Flash Deals */}
          {activeTool === "flash_deals" && (
            <FlashDealsStudio
              activeShop={activeShop}
              menuItems={storeMenuItems}
              storeUrl={storeUrl}
            />
          )}

          {/* Tool 3: Table Tent Card Generator */}
          {activeTool === "table_tents" && (
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
                      <option value="SCAN TO ORDER ONLINE">SCAN TO ORDER ONLINE</option>
                      <option value="TABLE & COUNTER MENU">TABLE & COUNTER MENU</option>
                      <option value="ORDER AHEAD & SKIP THE LINE">ORDER AHEAD & SKIP THE LINE</option>
                      <option value="SCAN FOR TODAY'S SPECIALS">SCAN FOR TODAY'S SPECIALS</option>
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
                    <p className="text-xs font-extrabold text-on-surface text-center mb-1">How customers order:</p>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                      <span>Open Camera & Scan QR Code</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                      <span>Select meal from live menu</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                      <span>Pay Cash on Arrival or Card!</span>
                    </div>
                  </div>

                  {/* Footer Trust Signals */}
                  <div className="flex items-center justify-center gap-4 text-[11px] font-bold text-on-surface-variant/80 pt-1">
                    <span className="flex items-center gap-1">
                      <Truck size={13} className="text-primary" /> Fast Local Delivery
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Utensils size={13} className="text-primary" /> Instant Pickup
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tool 5: WhatsApp Promos */}
          {activeTool === "whatsapp" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Preset Selector & Customizer */}
              <div className="lg:col-span-6 space-y-5">
                <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-4">
                  <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
                    <MessageSquare size={18} className="text-emerald-500" />
                    <span>Select Campaign Preset</span>
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
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Announce you're taking orders</p>
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
                        <Gift size={14} className="text-primary" /> Item Special
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Feature a specific Kota / meal</p>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedPreset("delivery");
                        setUserEditedMessage(null);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedPreset === "delivery"
                          ? "border-emerald-500 bg-emerald-500/10 text-on-surface font-bold"
                          : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <Truck size={14} className="text-blue-500" /> Local Delivery
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Highlight fast rider delivery</p>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedPreset("discount");
                        setUserEditedMessage(null);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedPreset === "discount"
                          ? "border-emerald-500 bg-emerald-500/10 text-on-surface font-bold"
                          : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <Percent size={14} className="text-purple-500" /> Promo Voucher
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Give a coupon discount</p>
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
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-1.5">Promo / Voucher Code</label>
                      <input
                        type="text"
                        value={customDiscountCode}
                        onChange={(e) => {
                          setCustomDiscountCode(e.target.value.toUpperCase());
                          setUserEditedMessage(null);
                        }}
                        className="w-full bg-surface-container-high border-none rounded-xl px-3.5 py-2.5 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary outline-none uppercase font-mono"
                        placeholder="e.g. KOTA10, WINTER20"
                      />
                    </div>
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
                      <span>Send on WhatsApp</span>
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

          {/* Tool 6: Social Media Graphic Studio */}
          {activeTool === "social_studio" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Customizer */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-4">
                  <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
                    <Palette size={18} className="text-primary" />
                    <span>Flyer Design & Themes</span>
                  </h3>

                  {/* Color Theme Selector */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-2">Color Palette</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSocialTheme("coral")}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          socialTheme === "coral"
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                            : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-[#EA580C]" />
                        <span className="text-xs">Township Coral</span>
                      </button>

                      <button
                        onClick={() => setSocialTheme("dark")}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          socialTheme === "dark"
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                            : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-[#0F172A]" />
                        <span className="text-xs">Midnight Charcoal</span>
                      </button>

                      <button
                        onClick={() => setSocialTheme("golden")}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          socialTheme === "golden"
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                            : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-[#D97706]" />
                        <span className="text-xs">Golden Amber</span>
                      </button>

                      <button
                        onClick={() => setSocialTheme("emerald")}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          socialTheme === "emerald"
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                            : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-[#059669]" />
                        <span className="text-xs">Emerald Fresh</span>
                      </button>
                    </div>
                  </div>

                  {/* Tagline */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1.5">Tagline / Highlight Phrase</label>
                    <input
                      type="text"
                      value={socialTagline}
                      onChange={(e) => setSocialTagline(e.target.value)}
                      className="w-full bg-surface-container-high border-none rounded-xl px-3.5 py-2.5 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary outline-none"
                      placeholder="e.g. Best Kota in Town, Fresh Daily"
                    />
                  </div>

                  {/* Highlight Specific Menu Item */}
                  {storeMenuItems.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-1.5">Featured Item on Card</label>
                      <select
                        value={featuredSocialItemId}
                        onChange={(e) => setFeaturedSocialItemId(e.target.value)}
                        className="w-full bg-surface-container-high border-none rounded-xl px-3.5 py-2.5 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary outline-none"
                      >
                        <option value="">General Store Online Ordering</option>
                        {storeMenuItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} (R{item.price})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Download Action */}
                  <button
                    onClick={handleDownloadSocialGraphic}
                    className="w-full py-3 rounded-2xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-all cursor-pointer"
                  >
                    <Download size={16} />
                    <span>Download High-Res Graphic (PNG)</span>
                  </button>

                  {/* Auto Caption Generator */}
                  <div className="pt-3 border-t border-outline-variant/10 space-y-2">
                    <label className="block text-xs font-bold text-on-surface flex items-center justify-between">
                      <span>Instagram & Facebook Caption</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(socialCaption);
                          setCopiedCaption(true);
                          toast.success("Caption copied!");
                          setTimeout(() => setCopiedCaption(false), 2000);
                        }}
                        className="text-primary hover:underline text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedCaption ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        <span>{copiedCaption ? "Copied" : "Copy Caption"}</span>
                      </button>
                    </label>
                    <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/15 text-[11px] font-mono text-on-surface leading-relaxed">
                      {socialCaption}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Live Graphic Canvas Render */}
              <div className="lg:col-span-7 flex flex-col items-center justify-center">
                <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xl text-center space-y-4 w-full max-w-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-on-surface flex items-center gap-1.5">
                      <Eye size={14} className="text-primary" /> Live Social Card Preview (1080 × 1080)
                    </span>
                    <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
                      Square Post
                    </span>
                  </div>

                  {/* Rendered HTML5 Canvas */}
                  <div className="w-full aspect-square bg-slate-900 rounded-2xl overflow-hidden shadow-md flex items-center justify-center border border-outline-variant/20">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <p className="text-[11px] text-on-surface-variant">
                    Ready to post on Facebook, Instagram, WhatsApp Status, or TikTok!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tool 7: SMS Broadcast */}
          {activeTool === "sms" && (
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
                  Township and office workers decide what to eat for lunch between 11:30 and 12:00. Always post your daily special or Kota deal on WhatsApp Status at 11:30 AM sharp with your direct ordering link.
                </p>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                  🛍️
                </div>
                <h3 className="font-extrabold text-base text-on-surface">2. Takeaway Bag QR Flyers</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Print our A4 / small flyers and stick them on top of every takeaway box or brown paper bag. When walk-in customers get home, they will scan to order online next time!
                </p>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                  💬
                </div>
                <h3 className="font-extrabold text-base text-on-surface">3. Community WhatsApp Groups</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Share your store link once a week in neighborhood business & community groups. Highlight that cash-on-arrival and local delivery riders are supported.
                </p>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                  🎟️
                </div>
                <h3 className="font-extrabold text-base text-on-surface">4. First-Order Voucher Codes</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Create a 10% discount coupon in your Campaign Builder (e.g. <code>FIRST10</code>) and mention it on your social media posts to encourage first-time online orders.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => setMainSegment("campaign_builder")}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Campaign Builder</span>
                    <ExternalLink size={12} />
                  </button>
                  {onNavigateTab && (
                    <button
                      onClick={() => onNavigateTab("coupons")}
                      className="text-xs font-bold text-on-surface-variant hover:text-on-surface flex items-center gap-1 cursor-pointer"
                    >
                      <span>(or Merchant Coupons tab)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Marketing;
