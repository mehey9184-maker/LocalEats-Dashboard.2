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
import {merchantMarketingPublishingEnabled,verifiedMarketingStats} from "../services/merchantMarketingTrust";
import type { User } from "@supabase/supabase-js";
import { CampaignBuilder } from "./CampaignBuilder";
import { ReadOnlyMarketingPreview } from "./marketing/ReadOnlyMarketingPreview";
import { CustomerReEngagement } from "./marketing/CustomerReEngagement";
import { FlashDealsStudio } from "./marketing/FlashDealsStudio";
import { TableTentGenerator } from "./marketing/TableTentGenerator";

interface MarketingProps {
  currentShop: Shop | undefined;
  setShops?: React.Dispatch<React.SetStateAction<Shop[]>>;
  shops?: Shop[];
  menuItems?: MenuItem[];
  orders?: Order[];
  ordersReadState?: "checking"|"confirmed"|"unavailable";
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
  ordersReadState = "checking",
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

  // Never infer revenue, diners or retention from cached/unverified orders.
  const publishingEnabled = merchantMarketingPublishingEnabled();
  // Preview QR codes must not take customers to a live ordering surface.
  const previewQrTarget = publishingEnabled ? storeUrl : "https://example.invalid/localeats-marketing-preview";
  const dinerStats = useMemo(
    () => verifiedMarketingStats(orders, activeShop?.id, ordersReadState),
    [orders, activeShop?.id, ordersReadState]
  );

  const previewToolDescriptions:Record<ToolSubTab,string> = {
    direct_reach:"Customer lists are excluded from this preview; outreach needs consent and verified customer data.",
    flash_deals:"Example deal prices only; no discount, timer or campaign is active.",
    table_tents:"Dine-in table ordering is not part of the pickup pilot; QR codes use non-operational demo links.",
    qr_stands:"QR stands and printed customer ordering links are not approved for distribution.",
    whatsapp:"WhatsApp campaign templates are examples; they do not send or copy messages.",
    social_studio:"Social graphics are examples; no post or offer may be published.",
    sms:"SMS content is a mockup; no customer broadcast is permitted.",
    playbook:"Growth advice is not a verified result and cannot activate a promotion.",
  };

  // Quick Action Switchers
  const handleLaunchQuickAction = (tool: ToolSubTab) => {
    if(!publishingEnabled) return;
    setMainSegment("tool_library");
    setActiveTool(tool);
  };

  // 2. QR Code State & Generator
  const [qrStyle, setQrStyle] = useState<QrStyle>("coral");
  const [qrFrameText, setQrFrameText] = useState<string>("PREVIEW — NOT LIVE");
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

        const url = await QRCodeLib.toDataURL(previewQrTarget, {
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
  }, [previewQrTarget, qrStyle]);

  // Copy Store Link Handler
  const copyStoreUrl = () => {
    if(!publishingEnabled || !activeShop) return;
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
    const priceText = typeof featuredItemPrice === "number" && Number.isFinite(featuredItemPrice) ? `(listed R${featuredItemPrice})` : "";

    switch (selectedPreset) {
      case "opening":
        return `📋 *${shopName} — SAMPLE LAUNCH MESSAGE*\n\nThis is an example for a future LocalEats collection pilot in ${shopLocation}. Ordering is NOT active. When approved, customers will collect food and pay at the shop (cash or the shop card machine).\n\nPreview only: ${previewQrTarget}`;
      case "lunch":
        return `🍔 *SAMPLE LUNCH POST FOR ${shopName.toUpperCase()}*\n\nFeatured menu idea: ${featuredItemName} ${priceText}. This is not a live order or active special. Future orders will be for collection, with payment at the shop.\n\nPreview only: ${previewQrTarget}`;
      case "item_deal":
        return `✨ *SAMPLE ITEM HIGHLIGHT: ${featuredItemName.toUpperCase()}*\n\nExample menu spotlight from ${shopName} ${priceText}. No deal has been activated. Future pickup customers will collect and pay at the shop.\n\n📍 ${shopLocation}\nPreview only: ${previewQrTarget}`;
      case "delivery":
        return `📍 *COLLECTION-ONLY PLAN FOR ${shopName}*\n\nDelivery and riders are not available. This is a sample message, not an invitation to order. Following approval, customers will collect their food and pay at the shop.\n\nPreview only: ${previewQrTarget}`;
      case "discount":
        return `🎟️ *SAMPLE VOUCHER — NOT VALID*\n\nExample code: ${customDiscountCode}. No discount exists or can be redeemed at checkout. Any future promotion requires separate merchant and LocalEats approval.\n\nPreview only: ${previewQrTarget}`;
      case "weekend":
        return `🍔 *SAMPLE WEEKEND MESSAGE FOR ${shopName.toUpperCase()}*\n\nA possible future post about your weekend menu. No online ordering, delivery or customer offer is active. The approved pilot will use collection and payment at the shop.\n\nPreview only: ${previewQrTarget}`;
      default:
        return `Sample marketing message for ${shopName}. Ordering is not active: ${previewQrTarget}`;
    }
  }, [selectedPreset, activeShop, previewQrTarget, customFeaturedItem, customDiscountCode, storeMenuItems]);

  const activeMessage = userEditedMessage !== null ? userEditedMessage : generatedMessage;

  // WhatsApp Action Handlers
  const handleOpenWhatsApp = () => {
    if(!publishingEnabled) return;
    const encoded = encodeURIComponent(activeMessage);
    const waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(waUrl, "_blank");
    toast.success("Opening WhatsApp share window...");
  };

  const handleCopyMessage = () => {
    if(!publishingEnabled) return;
    navigator.clipboard.writeText(activeMessage);
    setCopiedMsg(true);
    toast.success("WhatsApp pitch copied to clipboard!");
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  // 4. Social Graphic Studio State
  const [socialTheme, setSocialTheme] = useState<SocialTheme>("coral");
  const [socialTagline, setSocialTagline] = useState<string>("Local Kota & Township Meals");
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
    return `📋 SAMPLE SOCIAL POST — ${shopName} in ${shopLocation}. Collection and payment at the shop are planned only after launch approval. Ordering and delivery are not active. Preview link: ${previewQrTarget} #LocalEats #SupportLocal #${shopName.replace(/\s+/g, "")}`;
  }, [activeShop, previewQrTarget]);

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
    ctx.fillText("LOCALEATS SA", 115, 117);

    // Verified Store Badge
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.roundRect(740, 80, 260, 56, 28);
    ctx.fill();
    ctx.fillStyle = accentColor;
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillText("PREVIEW ONLY", 765, 116);

    // Shop Name
    ctx.font = "900 68px system-ui, sans-serif";
    ctx.fillStyle = textColor;
    const shopName = activeShop?.name || "Local Eatery";
    ctx.fillText(shopName.slice(0, 22), 80, 240);

    // Tagline / Category
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.fillStyle = accentColor;
    ctx.fillText(socialTagline || "Collection Preview Only", 80, 300);

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
      ctx.fillText("EXAMPLE MENU ITEM", 120, 420);

      ctx.font = "900 44px system-ui, sans-serif";
      ctx.fillStyle = textColor;
      ctx.fillText(featuredSocialItem.name.slice(0, 20), 120, 490);

      ctx.font = "bold 34px system-ui, sans-serif";
      ctx.fillStyle = accentColor;
      ctx.fillText(`R${featuredSocialItem.price}`, 120, 550);

      ctx.font = "24px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillText("• Example menu item and price", 120, 620);
      ctx.fillText("• Collection only after approval", 120, 665);
      ctx.fillText("• Pay at the shop after launch", 120, 710);
    } else {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 44px system-ui, sans-serif";
      ctx.fillText("MARKETING", 120, 470);
      ctx.fillText("PREVIEW ONLY", 120, 530);

      ctx.font = "26px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillText("1. Sample QR (not live)", 120, 610);
      ctx.fillText("2. Future collection only", 120, 665);
      ctx.fillText("3. Pay at shop after launch", 120, 720);
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
        ctx.fillText("NOT A LIVE ORDER", 825, 755);
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
    const phone = activeShop?.phone || activeShop?.whatsapp || "Contact not listed";
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
    if(!publishingEnabled) return;
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
    if(!publishingEnabled) return;
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
      doc.text("LOCALEATS SA - PREVIEW ONLY", 105, 18, { align: "center" });

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Example layout • Collection planned • Not live", 105, 28, { align: "center" });

      // Shop Name Heading
      doc.setTextColor(15, 23, 42); // #0F172A
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.text(shopName, 105, 65, { align: "center" });

      doc.setFontSize(14);
      doc.setTextColor(234, 88, 12);
      doc.text("SAMPLE QR - NOT FOR CUSTOMER ORDERS", 105, 75, { align: "center" });

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
      doc.text("FUTURE COLLECTION FLOW (NOT ACTIVE):", 105, 227, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("1. Preview the sample QR design above.", 35, 236);
      doc.text("2. View a menu when LocalEats ordering is approved.", 35, 243);
      doc.text("3. Collect and pay at the shop (cash/card machine).", 35, 250);

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
    return `SAMPLE: ${shopName} — collection and payment at shop planned after approval. No ordering active. ${previewQrTarget}`;
  }, [activeShop, previewQrTarget]);

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
                Review your shop's verified order activity. Campaigns, links and sharing remain unavailable before launch.
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

      {!publishingEnabled && (
        <p role="status" className="text-xs text-on-surface-variant bg-surface-container-lowest rounded-2xl border border-outline-variant/15 px-4 py-3">
          Marketing Preview only — customer ordering and promotional publishing are not activated. No vouchers, messages or customer-facing campaigns will be sent from this page.
        </p>
      )}

      {/* 2. PRIMARY 3-SEGMENT NAVIGATION */}
      <div className="bg-surface-container-lowest p-1.5 rounded-2xl border border-outline-variant/15 grid grid-cols-3 gap-2 shadow-xs">
        {/* Segment 1: Dashboard Summary */}
        <button
          onClick={() => setMainSegment("dashboard")}
          className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
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
          type="button"
          title="Inspect Campaign Builder layout (read-only)"
          onClick={() => setMainSegment("campaign_builder")}
          className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
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
          type="button"
          title="Inspect Tool Library layouts (read-only)"
          onClick={() => setMainSegment("tool_library")}
          className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
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
              <p className="text-2xl font-black text-on-surface">{dinerStats?.uniqueDiners ?? "—"}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">Unique verified customer IDs</p>
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
                <p className="text-2xl font-black text-on-surface">{dinerStats?.repeatDiners ?? "—"}</p>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  {dinerStats?.repeatRate === null || !dinerStats ? "—" : `${dinerStats.repeatRate}%`} repeat
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1">Customer IDs with 2+ orders</p>
            </div>

            <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Avg Order Value
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Zap size={16} />
                </div>
              </div>
              <p className="text-2xl font-black text-on-surface">{dinerStats?.averageOrderValue === null || !dinerStats ? "—" : `R${dinerStats.averageOrderValue.toFixed(2)}`}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">Per order, not confirmed revenue</p>
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
              <p className="text-2xl font-black text-on-surface">{dinerStats?.totalOrders ?? "—"}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">Confirmed API order records</p>
            </div>
          </div>

          {/* 1-Tap Quick Action Growth Boosters */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
                  <Zap size={18} className="text-amber-500" />
                  <span>Marketing Ideas — Not Yet Active</span>
                </h3>
                <p className="text-xs text-on-surface-variant">
                  These ideas are previews only. Discounts, customer messages and printed order links are not activated.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Booster 1: Lunch Rush */}
              <div
                aria-disabled={!publishingEnabled}
                onClick={publishingEnabled ? () => handleLaunchQuickAction("flash_deals") : undefined}
                className="p-4 rounded-2xl bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/20 transition-all cursor-not-allowed opacity-60 group flex flex-col justify-between"
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
                    Preview a future lunch promotion. No discount is active.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-orange-500/15 flex items-center justify-between text-xs font-bold text-orange-600">
                  <span>Coming Later</span>
                  <span>→</span>
                </div>
              </div>

              {/* Booster 2: Win Back Diners */}
              <div
                aria-disabled={!publishingEnabled}
                onClick={publishingEnabled ? () => handleLaunchQuickAction("direct_reach") : undefined}
                className="p-4 rounded-2xl bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 transition-all cursor-not-allowed opacity-60 group flex flex-col justify-between"
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
                    Customer outreach is not activated. No messages are sent.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-blue-500/15 flex items-center justify-between text-xs font-bold text-blue-600">
                  <span>Coming Later</span>
                  <span>→</span>
                </div>
              </div>

              {/* Booster 3: Table Tents */}
              <div
                aria-disabled={!publishingEnabled}
                onClick={publishingEnabled ? () => handleLaunchQuickAction("table_tents") : undefined}
                className="p-4 rounded-2xl bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 transition-all cursor-not-allowed opacity-60 group flex flex-col justify-between"
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
                    QR table-ordering materials are not ready for customer use.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-emerald-500/15 flex items-center justify-between text-xs font-bold text-emerald-600">
                  <span>Coming Later</span>
                  <span>→</span>
                </div>
              </div>

              {/* Booster 4: Counter Flyer */}
              <div
                aria-disabled={!publishingEnabled}
                onClick={publishingEnabled ? () => handleLaunchQuickAction("qr_stands") : undefined}
                className="p-4 rounded-2xl bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/20 transition-all cursor-not-allowed opacity-60 group flex flex-col justify-between"
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
                    Counter flyer publishing is not activated while ordering is closed.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-purple-500/15 flex items-center justify-between text-xs font-bold text-purple-600">
                  <span>Coming Later</span>
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
                    <span>Storefront Link Preview</span>
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Customer ordering and payments at the shop are not active yet. Do not publish this link before owner approval.
                  </p>
                </div>
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full uppercase">
                  ● Ordering Not Activated
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
                  type="button"
                  disabled={!publishingEnabled}
                  title="Storefront sharing is locked until ordering is approved"
                  onClick={copyStoreUrl}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {copiedLink ? <Check size={14} className="text-white" /> : <Copy size={14} />}
                  <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={!publishingEnabled}
                  title="WhatsApp campaigns are not activated"
                  onClick={() => handleLaunchQuickAction("whatsapp")}
                  className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageSquare size={15} />
                  <span>Share on WhatsApp</span>
                </button>

                <button
                  type="button"
                  disabled={!publishingEnabled}
                  title="Publishing social posts is not activated"
                  onClick={() => handleLaunchQuickAction("social_studio")}
                  className="p-3 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold flex items-center justify-center gap-2 border border-outline-variant/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Palette size={15} className="text-primary" />
                  <span>Create Social Post</span>
                </button>

                <button
                  type="button"
                  disabled={!publishingEnabled}
                  title="Vouchers are not activated"
                  onClick={() => { if(publishingEnabled) setMainSegment("campaign_builder"); }}
                  className="p-3 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold flex items-center justify-center gap-2 border border-outline-variant/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                <p className="text-[11px] text-on-surface-variant">QR Preview Only — Not for Distribution</p>
              </div>
              <div className="w-full grid grid-cols-2 gap-2">
                <span
                  title="QR export is unavailable before launch"
                  aria-disabled="true"
                  className="py-2 px-3 rounded-xl bg-surface-container-high text-on-surface-variant text-[11px] font-bold flex items-center justify-center gap-1 border border-outline-variant/20 opacity-50 cursor-not-allowed"
                >
                  <Download size={13} />
                  <span>PNG</span>
                </span>
                <button
                  type="button"
                  disabled={!publishingEnabled}
                  title="Order-link printing is not activated"
                  onClick={() => handleLaunchQuickAction("qr_stands")}
                  className="py-2 px-3 rounded-xl bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
        <ReadOnlyMarketingPreview
          locked={!publishingEnabled}
          description="Campaign Builder: sample coupons, audience rules and push designs are not published or linked to checkout.">
          <CampaignBuilder
            activeShop={activeShop}
            storeMenuItems={storeMenuItems}
            storeUrl={publishingEnabled ? storeUrl : "https://example.invalid/localeats-marketing-preview"}
            previewOnly={!publishingEnabled}
          />
        </ReadOnlyMarketingPreview>
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

          {/* ACTIVE TOOL RENDERING — visual-only until separately approved */}
          <ReadOnlyMarketingPreview locked={!publishingEnabled} description={previewToolDescriptions[activeTool]}>

          {/* Tool 1: Direct Customer Reach & Diners */}
          {activeTool === "direct_reach" && (
            <CustomerReEngagement
              activeShop={activeShop}
              orders={publishingEnabled ? orders : []}
              menuItems={storeMenuItems}
              storeUrl={publishingEnabled ? storeUrl : "https://example.invalid/localeats-marketing-preview"}
            />
          )}

          {/* Tool 2: Timed Flash Deals */}
          {activeTool === "flash_deals" && (
            <FlashDealsStudio
              activeShop={activeShop}
              menuItems={storeMenuItems}
              storeUrl={publishingEnabled ? storeUrl : "https://example.invalid/localeats-marketing-preview"}
              previewOnly={!publishingEnabled}
            />
          )}

          {/* Tool 3: Table Tent Card Generator */}
          {activeTool === "table_tents" && (
            <TableTentGenerator
              activeShop={activeShop}
              storeUrl={publishingEnabled ? storeUrl : "https://example.invalid/localeats-marketing-preview"}
              previewOnly={!publishingEnabled}
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
                      <option value="PREVIEW — NOT LIVE">PREVIEW — NOT LIVE</option>
                      <option value="TABLE & COUNTER MENU">TABLE & COUNTER MENU</option>
                      <option value="PICKUP AFTER LAUNCH">PICKUP AFTER LAUNCH</option>
                      <option value="SAMPLE MENU ONLY">SAMPLE MENU ONLY</option>
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
                    <p className="text-xs font-extrabold text-on-surface text-center mb-1">Example collection flow (not active):</p>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                      <span>Sample QR — not live</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                      <span>View menu after launch</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                      <span>Pay at shop after approval</span>
                    </div>
                  </div>

                  {/* Footer Trust Signals */}
                  <div className="flex items-center justify-center gap-4 text-[11px] font-bold text-on-surface-variant/80 pt-1">
                    <span className="flex items-center gap-1">
                      <Store size={13} className="text-primary" /> Delivery Not Active
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Utensils size={13} className="text-primary" /> Collection Planned
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
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Sample launch message only</p>
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
                        <Utensils size={14} className="text-amber-500" /> Example Lunch Post
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Experiment with timing later</p>
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
                        <Truck size={14} className="text-blue-500" /> Delivery Deferred
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Riders not part of pilot</p>
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
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Unissued code example only</p>
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
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Sample weekend message only</p>
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
                        <option value="">Sample Store Preview</option>
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
                    Sample layout only — not approved for publication or customer promotion.
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
                  Sample SMS text only. Sending is disabled; length and billing depend on the network, encoding and message content.
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
                <h3 className="font-extrabold text-base text-on-surface">1. Test Lunch-Time Posting</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Try different lunchtime posting times once your shop launches. Measure actual enquiries rather than assuming 11:30 works for every neighbourhood. Do not share inactive order links or unapproved discounts.
                </p>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                  🛍️
                </div>
                <h3 className="font-extrabold text-base text-on-surface">2. Takeaway Bag QR Flyers — Later</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Draft QR flyers now if useful, but do not print or distribute them until the customer ordering flow is approved and the QR target has been tested.
                </p>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                  💬
                </div>
                <h3 className="font-extrabold text-base text-on-surface">3. Community Groups — With Permission</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  After launch approval, share accurate collection-only information in community groups that allow business posts. Avoid unsolicited messages and never claim rider delivery is available.
                </p>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                  🎟️
                </div>
                <h3 className="font-extrabold text-base text-on-surface">4. Voucher Codes — Future Feature</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Voucher codes shown in this Preview are examples only. Do not advertise or promise a discount until the checkout rules, approval process and redemption flow are verified.
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
          </ReadOnlyMarketingPreview>
        </div>
      )}
    </div>
  );
};

export default Marketing;
