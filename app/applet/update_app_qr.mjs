import fs from "fs";

let content = fs.readFileSync("src/App.tsx", "utf-8");

// 1. Ensure Smartphone, Share2 are imported from lucide-react if missing
if (!content.includes("Smartphone")) {
  content = content.replace('from "lucide-react";', ', Smartphone, Share2 } from "lucide-react";');
}

// 2. Locate Marketing component replacement block
const startMarker = "const Marketing = ({";
const endMarker = "const Coupons = ({";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not locate Marketing component boundaries!");
  process.exit(1);
}

const replacementCode = `const Marketing = ({
  currentShop,
  setShops,
}: {
  currentShop: Shop | undefined;
  setShops: React.Dispatch<React.SetStateAction<Shop[]>>;
}) => {
  // Hiring Flyer states
  const [showHiringModal, setShowHiringModal] = useState(false);
  const [hiringHeadline, setHiringHeadline] = useState("Join Our Delivery Fleet!");
  const [hiringBody, setHiringBody] = useState("Earn money delivering for LocalEats. Flexible hours and great pay.");
  const [hiringLink, setHiringLink] = useState("https://www.localeatssa.co.za/riders/apply");
  const [qrGenerating, setQrGenerating] = useState(false);

  // Flyer Studio customizer states
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [flyerTheme, setFlyerTheme] = useState<"orange" | "emerald" | "midnight" | "rose" | "purple">("orange");
  const [flyerHeadline, setFlyerHeadline] = useState("Order Online & Skip the Queue!");
  const [flyerSubline, setFlyerSubline] = useState("Scan to view our live, fresh, handcrafted menu items.");
  const [flyerCTA, setFlyerCTA] = useState("Fast bicycle delivery, direct service.");
  const [flyerCouponCode, setFlyerCouponCode] = useState("");

  // Direct App QR Flyer customizer states
  const [showAppQRFlyerModal, setShowAppQRFlyerModal] = useState(false);
  const [appQRTheme, setAppQRTheme] = useState<"sunset" | "midnight" | "emerald" | "indigo" | "golden" | "swiss">("sunset");
  const [appQRHeadline, setAppQRHeadline] = useState("SCAN TO ORDER & SKIP THE LINE");
  const [appQRSubline, setAppQRSubline] = useState("Order fresh meals directly from your phone — Fast pickup & instant live updates.");
  const [appQRLocationTag, setAppQRLocationTag] = useState("Table / Counter Stand");
  const [appQRIncludePerks, setAppQRIncludePerks] = useState(true);
  const [appQRFormat, setAppQRFormat] = useState<"a4" | "a5_tent" | "square">("a4");
  const [appQRPreviewUrl, setAppQRPreviewUrl] = useState<string>("");
  const [appQRCopied, setAppQRCopied] = useState(false);

  // Generate live QR Code image for interactive flyer builder
  useEffect(() => {
    let active = true;
    const generatePreview = async () => {
      if (!currentShop?.id) return;
      try {
        const QRCode = (await import("qrcode")).default;
        const targetUrl = \`https://www.localeatssa.co.za/?shopId=\${currentShop.id}\`;
        const dataUrl = await QRCode.toDataURL(targetUrl, {
          width: 400,
          margin: 1,
          color: {
            dark: appQRTheme === "midnight" ? "#0F172A" : appQRTheme === "sunset" ? "#9A2C12" : "#0F172A",
            light: "#FFFFFF",
          },
        });
        if (active) setAppQRPreviewUrl(dataUrl);
      } catch (e) {
        console.error("QR preview generation failed", e);
      }
    };
    generatePreview();
    return () => { active = false; };
  }, [currentShop?.id, appQRTheme]);

  const handleCopyAppURL = () => {
    if (!currentShop) return;
    const url = \`https://www.localeatssa.co.za/?shopId=\${currentShop.id}\`;
    navigator.clipboard.writeText(url);
    setAppQRCopied(true);
    toast.success("Direct Menu Link copied to clipboard!");
    setTimeout(() => setAppQRCopied(false), 2000);
  };

  const handleGenerateFlyerPDF = async () => {
    if (!currentShop) return;
    try {
      setQrGenerating(true);
      const { jsPDF } = await import("jspdf");
      const QRCode = (await import("qrcode")).default;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Theme colors
      const themes = {
        orange: { bg: [255, 90, 54], text: [255, 255, 255], accent: [255, 255, 255] },
        emerald: { bg: [5, 150, 105], text: [255, 255, 255], accent: [255, 255, 255] },
        midnight: { bg: [15, 23, 42], text: [255, 255, 255], accent: [255, 90, 54] },
        rose: { bg: [225, 29, 72], text: [255, 255, 255], accent: [255, 255, 255] },
        purple: { bg: [124, 58, 237], text: [255, 255, 255], accent: [255, 255, 255] },
      };
      
      const theme = themes[flyerTheme];
      
      // Background
      doc.setFillColor(theme.bg[0], theme.bg[1], theme.bg[2]);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      // Shop Name
      doc.setTextColor(theme.text[0], theme.text[1], theme.text[2]);
      doc.setFontSize(36);
      doc.setFont("helvetica", "bold");
      doc.text(currentShop.name.toUpperCase(), pageWidth / 2, 40, { align: "center" });

      // Headline
      doc.setFontSize(28);
      const splitHeadline = doc.splitTextToSize(flyerHeadline, pageWidth - 40);
      doc.text(splitHeadline, pageWidth / 2, 70, { align: "center" });

      // Subline
      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      const splitSubline = doc.splitTextToSize(flyerSubline, pageWidth - 40);
      doc.text(splitSubline, pageWidth / 2, 100, { align: "center" });

      // QR Code
      const targetUrl = \`https://www.localeatssa.co.za/?shopId=\${currentShop.id}\`;
      const qrDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
      const boxSize = 80;
      const boxX = (pageWidth - boxSize) / 2;
      
      // White box for QR code
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(boxX - 5, 130 - 5, boxSize + 10, boxSize + 10, 5, 5, "F");
      doc.addImage(qrDataUrl, "PNG", boxX, 130, boxSize, boxSize);

      // CTA
      doc.setTextColor(theme.accent[0], theme.accent[1], theme.accent[2]);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      const splitCTA = doc.splitTextToSize(flyerCTA, pageWidth - 40);
      doc.text(splitCTA, pageWidth / 2, 230, { align: "center" });

      if (flyerCouponCode) {
        doc.setFillColor(255, 255, 255);
        doc.setTextColor(theme.bg[0], theme.bg[1], theme.bg[2]);
        doc.roundedRect(pageWidth / 2 - 40, 250, 80, 20, 3, 3, "F");
        doc.setFontSize(14);
        doc.text(\`Code: \${flyerCouponCode}\`, pageWidth / 2, 263, { align: "center" });
      }

      doc.save(\`LocalEats_Flyer_\${currentShop.name.replace(/\\s+/g, "_")}.pdf\`);
      toast.success("Flyer PDF downloaded!");
      setShowFlyerModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Flyer");
    } finally {
      setQrGenerating(false);
    }
  };

  const handleGenerateHiringPDF = async () => {
    try {
      setQrGenerating(true);
      const { jsPDF } = await import("jspdf");
      const QRCode = (await import("qrcode")).default;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(255, 90, 54);
      doc.rect(0, 0, pageWidth, 40, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.text("LocalEats", 15, 25);

      doc.setTextColor(26, 28, 30);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      const splitHeadline = doc.splitTextToSize(hiringHeadline, pageWidth - 40);
      doc.text(splitHeadline, pageWidth / 2, 70, { align: "center" });

      doc.setFontSize(14);
      doc.setTextColor(70, 70, 70);
      doc.setFont("helvetica", "normal");
      const splitBody = doc.splitTextToSize(hiringBody, pageWidth - 40);
      doc.text(splitBody, pageWidth / 2, 110, { align: "center" });

      const qrDataUrl = await QRCode.toDataURL(hiringLink, {
        width: 400,
        margin: 2,
        color: {
          dark: "#0F172A",
          light: "#FFFFFF",
        },
      });

      const boxSize = 80;
      const boxX = (pageWidth - boxSize) / 2;
      doc.addImage(qrDataUrl, "PNG", boxX, 150, boxSize, boxSize);

      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("Scan the QR code to apply now!", pageWidth / 2, 240, { align: "center" });

      doc.save("LocalEats_Hiring_Rider.pdf");
      toast.success("Hiring PDF downloaded!");
      setShowHiringModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Hiring PDF");
    } finally {
      setQrGenerating(false);
    }
  };

  const handleGenerateAppQRPDF = async () => {
    if (!currentShop) return;
    try {
      setQrGenerating(true);
      const { jsPDF } = await import("jspdf");
      const QRCode = (await import("qrcode")).default;

      const isSquare = appQRFormat === "square";
      const isTent = appQRFormat === "a5_tent";

      const doc = new jsPDF({
        orientation: isSquare ? "landscape" : "portrait",
        unit: "mm",
        format: isSquare ? [150, 150] : isTent ? "a5" : "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const themeConfig = {
        sunset: { bg: [255, 90, 54], text: [255, 255, 255], cardBg: [255, 255, 255], accent: [254, 240, 138], darkText: [15, 23, 42] },
        midnight: { bg: [15, 23, 42], text: [255, 255, 255], cardBg: [30, 41, 59], accent: [255, 90, 54], darkText: [255, 255, 255] },
        emerald: { bg: [5, 150, 105], text: [255, 255, 255], cardBg: [255, 255, 255], accent: [209, 250, 229], darkText: [15, 23, 42] },
        indigo: { bg: [79, 70, 229], text: [255, 255, 255], cardBg: [255, 255, 255], accent: [224, 231, 255], darkText: [15, 23, 42] },
        golden: { bg: [217, 119, 6], text: [255, 255, 255], cardBg: [255, 255, 255], accent: [254, 243, 199], darkText: [15, 23, 42] },
        swiss: { bg: [250, 250, 249], text: [15, 23, 42], cardBg: [255, 255, 255], accent: [255, 90, 54], darkText: [15, 23, 42] },
      };

      const theme = themeConfig[appQRTheme];

      // Background Fill
      doc.setFillColor(theme.bg[0], theme.bg[1], theme.bg[2]);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      if (appQRTheme === "swiss") {
        doc.setFillColor(255, 90, 54);
        doc.rect(0, 0, pageWidth, 8, "F");
      }

      if (isTent) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(10, pageHeight / 2, pageWidth - 10, pageHeight / 2);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("FOLD HERE FOR TABLE TENT DISPLAY", pageWidth / 2, (pageHeight / 2) - 2, { align: "center" });
        doc.setLineDashPattern([], 0);
      }

      // Header Shop Name
      doc.setTextColor(theme.text[0], theme.text[1], theme.text[2]);
      doc.setFontSize(isSquare ? 20 : isTent ? 20 : 32);
      doc.setFont("helvetica", "bold");
      const topY = isSquare ? 22 : isTent ? 18 : 34;
      doc.text(currentShop.name.toUpperCase(), pageWidth / 2, topY, { align: "center" });

      doc.setFontSize(isSquare ? 8 : 10);
      doc.setFont("helvetica", "bold");
      doc.text("VERIFIED LOCAL MERCHANT • DIGITAL MENU", pageWidth / 2, topY + 7, { align: "center" });

      // Headline
      doc.setFontSize(isSquare ? 15 : isTent ? 16 : 24);
      doc.setFont("helvetica", "bold");
      const headlineY = topY + (isSquare ? 18 : isTent ? 18 : 24);
      const splitHeadline = doc.splitTextToSize(appQRHeadline, pageWidth - (isSquare ? 20 : 30));
      doc.text(splitHeadline, pageWidth / 2, headlineY, { align: "center" });

      // Subline
      doc.setFontSize(isSquare ? 8 : isTent ? 9 : 12);
      doc.setFont("helvetica", "normal");
      const sublineY = headlineY + (splitHeadline.length * 6) + 3;
      const splitSubline = doc.splitTextToSize(appQRSubline, pageWidth - (isSquare ? 20 : 36));
      doc.text(splitSubline, pageWidth / 2, sublineY, { align: "center" });

      // Generate QR
      const targetUrl = \`https://www.localeatssa.co.za/?shopId=\${currentShop.id}\`;
      const qrDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 500,
        margin: 1,
        color: { dark: "#0F172A", light: "#FFFFFF" },
      });

      const qrBoxSize = isSquare ? 50 : isTent ? 52 : 80;
      const qrBoxX = (pageWidth - qrBoxSize) / 2;
      const qrBoxY = sublineY + (isSquare ? 8 : isTent ? 8 : 14);

      // Card Box
      doc.setFillColor(theme.cardBg[0], theme.cardBg[1], theme.cardBg[2]);
      doc.roundedRect(qrBoxX - 6, qrBoxY - 6, qrBoxSize + 12, qrBoxSize + 22, 6, 6, "F");

      // Draw QR image
      doc.addImage(qrDataUrl, "PNG", qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

      // Camera badge
      doc.setFillColor(255, 90, 54);
      doc.roundedRect(pageWidth / 2 - 28, qrBoxY + qrBoxSize + 3, 56, 10, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("SCAN WITH CAMERA", pageWidth / 2, qrBoxY + qrBoxSize + 9.5, { align: "center" });

      // Location / Table Tag
      if (appQRLocationTag && !isSquare) {
        const tagY = qrBoxY + qrBoxSize + 22;
        doc.setFillColor(255, 255, 255, 0.25);
        doc.roundedRect(pageWidth / 2 - 35, tagY, 70, 8, 2, 2, "F");
        doc.setTextColor(theme.text[0], theme.text[1], theme.text[2]);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(\`LOCATION: \${appQRLocationTag.toUpperCase()}\`, pageWidth / 2, tagY + 5.5, { align: "center" });
      }

      // Value Perks
      if (appQRIncludePerks && !isSquare && !isTent) {
        const perksY = qrBoxY + qrBoxSize + 36;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(theme.text[0], theme.text[1], theme.text[2]);
        doc.text("⚡ Instant Web App  •  💵 Cash on Delivery  •  🎯 0% Markup", pageWidth / 2, perksY, { align: "center" });
      }

      // Footer
      doc.setFontSize(isSquare ? 8 : 9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(theme.text[0], theme.text[1], theme.text[2]);
      doc.text("Powered by LocalEats • Direct Shop Menu", pageWidth / 2, pageHeight - (isSquare ? 6 : 10), { align: "center" });

      doc.save(\`LocalEats_\${currentShop.name.replace(/\\s+/g, "_")}_AppQR_\${appQRFormat}.pdf\`);
      toast.success("Client App QR Code PDF downloaded!");
      setShowAppQRFlyerModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate QR PDF");
    } finally {
      setQrGenerating(false);
    }
  };

  const handleDownloadAppQRPNG = async () => {
    if (!currentShop || !appQRPreviewUrl) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const gradients: Record<string, [string, string]> = {
        sunset: ["#FF5A36", "#D9381E"],
        midnight: ["#0F172A", "#1E293B"],
        emerald: ["#059669", "#047857"],
        indigo: ["#4F46E5", "#3730A3"],
        golden: ["#D97706", "#B45309"],
        swiss: ["#FAFAF9", "#F5F5F4"],
      };
      const themeCols = gradients[appQRTheme] || gradients.sunset;
      const grad = ctx.createLinearGradient(0, 0, 0, 1600);
      grad.addColorStop(0, themeCols[0]);
      grad.addColorStop(1, themeCols[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1200, 1600);

      const isSwiss = appQRTheme === "swiss";
      ctx.fillStyle = isSwiss ? "#0F172A" : "#FFFFFF";
      ctx.textAlign = "center";

      ctx.font = "bold 60px sans-serif";
      ctx.fillText(currentShop.name.toUpperCase(), 600, 180);

      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = isSwiss ? "#FF5A36" : "#FEF08A";
      ctx.fillText("VERIFIED LOCAL MERCHANT • DIRECT DIGITAL MENU", 600, 230);

      ctx.fillStyle = isSwiss ? "#0F172A" : "#FFFFFF";
      ctx.font = "bold 44px sans-serif";
      ctx.fillText(appQRHeadline, 600, 330);

      ctx.font = "normal 26px sans-serif";
      ctx.fillText(appQRSubline, 600, 400);

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = appQRPreviewUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      ctx.fillStyle = "#FFFFFF";
      if (ctx.roundRect) ctx.roundRect(350, 480, 500, 580, 32);
      else ctx.fillRect(350, 480, 500, 580);
      ctx.fill();

      ctx.drawImage(img, 400, 510, 400, 400);

      ctx.fillStyle = "#FF5A36";
      if (ctx.roundRect) ctx.roundRect(450, 940, 300, 60, 20);
      else ctx.fillRect(450, 940, 300, 60);
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("📷 SCAN WITH CAMERA", 600, 978);

      if (appQRLocationTag) {
        ctx.font = "bold 32px sans-serif";
        ctx.fillStyle = isSwiss ? "#0F172A" : "#FFFFFF";
        ctx.fillText(\`📍 \${appQRLocationTag}\`, 600, 1160);
      }

      if (appQRIncludePerks) {
        ctx.font = "bold 24px sans-serif";
        ctx.fillStyle = isSwiss ? "#475569" : "#E2E8F0";
        ctx.fillText("⚡ Instant Web App  •  💵 Cash Accepted  •  🎯 0% Markup", 600, 1240);
      }

      ctx.font = "bold 24px sans-serif";
      ctx.fillStyle = isSwiss ? "#0F172A" : "#FFFFFF";
      ctx.fillText("Powered by LocalEats • Direct Digital Menu", 600, 1480);

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = \`LocalEats_\${currentShop.name.replace(/\\s+/g, "_")}_AppQR.png\`;
      a.click();
      toast.success("App QR Flyer PNG downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PNG image");
    }
  };

  return (
    <div className="space-y-8" id="marketing_studio_main">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight" id="marketing_header_title">
              Marketing Studio & Toolkit
            </h2>
            {currentShop && (
              <button
                onClick={async () => {
                  const newStatus = !currentShop.is_active;
                  localStorage.setItem(\`localeats_manual_status_override_\${currentShop.id}\`, JSON.stringify({ status: newStatus, timestamp: Date.now() }));
                  if (newStatus) {
                    localStorage.removeItem(\`localeats_holiday_mode_\${currentShop.id}\`);
                  }
                  setShops((prev) =>
                    prev.map((s) => (s.id === currentShop.id ? { ...s, is_active: newStatus } : s))
                  );
                  const { error } = await supabase.from("shops").update({ is_active: newStatus }).eq("id", currentShop.id);
                  if (!error) {
                    toast.success(\`Shop is now \${newStatus ? "Open" : "Closed"}\`);
                  } else {
                    setShops((prev) =>
                      prev.map((s) => (s.id === currentShop.id ? { ...s, is_active: !newStatus } : s))
                    );
                    toast.error("Failed to update status");
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border",
                  currentShop.is_active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-error/10 text-error border-error/20"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full", currentShop.is_active ? "bg-emerald-500 animate-pulse" : "bg-error")} />
                {currentShop.is_active ? "Open for Orders" : "Store Closed"}
              </button>
            )}
          </div>
          <p className="text-sm text-on-surface-variant font-medium">
            Launch campaigns, print custom materials, and manage table QR codes for {currentShop?.name || "your business"}.
          </p>
        </div>
      </header>

      {/* FLYER STUDIO SECTION */}
      <div>
        <h3 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
          <Printer className="text-primary" size={20} />
          Flyer Studio
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="marketing_primary_tools">
          {/* Hiring Rider Flyer */}
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Hire Riders PDF</h3>
                <p className="text-xs text-on-surface-variant/80 mt-1 leading-relaxed">
                  Generate a custom flyer with a QR code to recruit local delivery riders.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowHiringModal(true)}
              className="mt-6 w-full py-2.5 bg-primary/10 text-primary hover:bg-primary/20 font-bold rounded-xl text-xs transition-colors text-center"
            >
              Create Flyer
            </button>
          </motion.div>

          {/* Promotional Flyer Builder */}
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-500">
                <Printer size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Promotional Flyer</h3>
                <p className="text-xs text-on-surface-variant/80 mt-1 leading-relaxed">
                  Design custom promotional flyers with menus, coupons, and distinct themes.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowFlyerModal(true)}
              className="mt-6 w-full py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold rounded-xl text-xs transition-colors text-center"
            >
              Open Builder
            </button>
          </motion.div>

          {/* Direct App QR Flyer - UPGRADED HIGH-ENGAGEMENT TILE */}
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 flex flex-col justify-between relative overflow-hidden group shadow-sm hover:shadow-md transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full pointer-events-none" />
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-500/10 text-indigo-600 font-bold">
                  <QrCode size={24} />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center gap-1 shadow-2xs">
                  <Sparkles size={12} className="text-indigo-500" /> Interactive Studio
                </span>
              </div>
              
              <div>
                <h3 className="text-lg font-extrabold text-on-surface tracking-tight flex items-center gap-2">
                  Direct App QR Flyer
                </h3>
                <p className="text-xs text-on-surface-variant/80 mt-1.5 leading-relaxed font-medium">
                  Design print-ready posters, table tents, or window stickers with instant vector QR codes for your digital menu.
                </p>
              </div>

              {/* Interactive preview badge box */}
              <div className="p-3 bg-surface-container/60 rounded-2xl border border-outline-variant/10 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 p-1 flex items-center justify-center shrink-0 shadow-inner">
                  {appQRPreviewUrl ? (
                    <img src={appQRPreviewUrl} alt="QR Thumbnail" className="w-10 h-10 rounded-lg bg-white p-0.5 object-contain" />
                  ) : (
                    <QrCode size={24} className="text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-on-surface truncate">
                    {currentShop?.name || "Your Shop"} Menu QR
                  </div>
                  <div className="text-[10px] text-on-surface-variant flex items-center gap-1 mt-0.5 font-medium">
                    <CheckCircle2 size={11} className="text-emerald-500 shrink-0" /> Multi-Format & Custom Themes
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-outline-variant/10 flex items-center gap-2 relative z-10">
              <button
                onClick={() => setShowAppQRFlyerModal(true)}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow active:scale-98"
              >
                <Sparkles size={14} /> Customize & Preview
              </button>
              <button
                onClick={handleGenerateAppQRPDF}
                disabled={qrGenerating}
                title="Quick PDF Download"
                className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
              >
                {qrGenerating ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {/* FLYER MODAL */}
        {showFlyerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-surface w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar bg-surface-container-lowest">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-headline font-black text-on-surface flex items-center gap-2">
                      <Printer className="text-primary" size={24} /> Shop Flyer Builder
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-1 font-medium">
                      Design a beautiful PDF flyer for your physical shop or socials.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFlyerModal(false)}
                    className="p-2 bg-surface-container hover:bg-surface-container-high rounded-full transition-colors"
                  >
                    <X size={20} className="text-on-surface" />
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Color Theme</label>
                    <div className="flex gap-2">
                      {(["orange", "emerald", "midnight", "rose", "purple"] as const).map(theme => (
                        <button
                          key={theme}
                          onClick={() => setFlyerTheme(theme)}
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-all",
                            flyerTheme === theme ? "border-primary scale-110" : "border-transparent",
                            theme === "orange" ? "bg-[#FF5A36]" :
                            theme === "emerald" ? "bg-[#059669]" :
                            theme === "midnight" ? "bg-[#0F172A]" :
                            theme === "rose" ? "bg-[#E11D48]" :
                            "bg-[#7C3AED]"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Headline</label>
                    <input
                      type="text"
                      value={flyerHeadline}
                      onChange={(e) => setFlyerHeadline(e.target.value)}
                      className="w-full bg-surface-container px-4 py-3 rounded-xl border border-outline-variant/20 focus:border-primary outline-none text-sm font-semibold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Subline</label>
                    <textarea
                      value={flyerSubline}
                      onChange={(e) => setFlyerSubline(e.target.value)}
                      rows={2}
                      className="w-full bg-surface-container px-4 py-3 rounded-xl border border-outline-variant/20 focus:border-primary outline-none text-sm resize-none font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Call to Action (CTA)</label>
                    <input
                      type="text"
                      value={flyerCTA}
                      onChange={(e) => setFlyerCTA(e.target.value)}
                      className="w-full bg-surface-container px-4 py-3 rounded-xl border border-outline-variant/20 focus:border-primary outline-none text-sm font-semibold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Promo Code (Optional)</label>
                    <input
                      type="text"
                      value={flyerCouponCode}
                      onChange={(e) => setFlyerCouponCode(e.target.value)}
                      placeholder="e.g. WELCOME10"
                      className="w-full bg-surface-container px-4 py-3 rounded-xl border border-outline-variant/20 focus:border-primary outline-none text-sm font-semibold uppercase"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-outline-variant/10 bg-surface flex items-center justify-between">
                <button
                  onClick={() => setShowFlyerModal(false)}
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateFlyerPDF}
                  disabled={qrGenerating}
                  className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-full text-sm font-black shadow-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {qrGenerating ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  {qrGenerating ? "Generating PDF..." : "Download Flyer"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* HIRING RIDER MODAL */}
        {showHiringModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-surface w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar bg-surface-container-lowest">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-headline font-black text-on-surface flex items-center gap-2">
                      <Users className="text-primary" size={24} /> Hiring Rider PDF
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-1 font-medium">
                      Customize the flyer to recruit riders for your shop.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowHiringModal(false)}
                    className="p-2 bg-surface-container hover:bg-surface-container-high rounded-full transition-colors"
                  >
                    <X size={20} className="text-on-surface" />
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Headline</label>
                    <input
                      type="text"
                      value={hiringHeadline}
                      onChange={(e) => setHiringHeadline(e.target.value)}
                      className="w-full bg-surface-container px-4 py-3 rounded-xl border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-semibold"
                      placeholder="e.g. Join Our Delivery Fleet!"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Body Text</label>
                    <textarea
                      value={hiringBody}
                      onChange={(e) => setHiringBody(e.target.value)}
                      rows={3}
                      className="w-full bg-surface-container px-4 py-3 rounded-xl border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm resize-none custom-scrollbar font-medium"
                      placeholder="e.g. Earn money delivering for LocalEats..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">QR Code Link (Application Form)</label>
                    <input
                      type="text"
                      value={hiringLink}
                      onChange={(e) => setHiringLink(e.target.value)}
                      className="w-full bg-surface-container px-4 py-3 rounded-xl border border-outline-variant/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-semibold"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-outline-variant/10 bg-surface flex items-center justify-between">
                <button
                  onClick={() => setShowHiringModal(false)}
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateHiringPDF}
                  disabled={qrGenerating}
                  className="flex items-center gap-2 px-8 py-3 bg-primary text-on-primary rounded-full text-sm font-black shadow-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                >
                  {qrGenerating ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  {qrGenerating ? "Generating PDF..." : "Download PDF"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* DIRECT APP QR FLYER INTERACTIVE BUILDER MODAL */}
        {showAppQRFlyerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/50 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-surface w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-outline-variant/20"
            >
              {/* Modal Header */}
              <div className="p-6 md:px-8 md:py-6 border-b border-outline-variant/10 bg-surface-container-lowest flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700">
                      Studio Engine
                    </span>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-on-surface tracking-tight flex items-center gap-2">
                      <QrCode className="text-indigo-600" size={24} /> Direct App QR Flyer Builder
                    </h2>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
                    Customize layout, branding colors, and messaging to produce print-ready posters, counter stands, or window stickers.
                  </p>
                </div>
                <button
                  onClick={() => setShowAppQRFlyerModal(false)}
                  className="p-2 bg-surface-container hover:bg-surface-container-high rounded-full transition-colors text-on-surface"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body - Grid layout */}
              <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar bg-surface-container-lowest/50 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* LEFT: Live Interactive Poster Preview Stage */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-4 sticky top-0">
                  <div className="text-xs font-black uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5 self-start">
                    <Sparkles size={14} className="text-indigo-500" /> Live Interactive Print Preview
                  </div>

                  {/* Poster Mockup Container */}
                  <div
                    className={cn(
                      "w-full rounded-3xl p-6 md:p-8 shadow-xl flex flex-col items-center justify-between text-center transition-all duration-300 relative overflow-hidden border",
                      appQRTheme === "sunset" ? "bg-gradient-to-b from-[#FF5A36] to-[#D9381E] text-white border-orange-400/30" :
                      appQRTheme === "midnight" ? "bg-slate-900 text-white border-slate-700/50" :
                      appQRTheme === "emerald" ? "bg-gradient-to-b from-emerald-600 to-emerald-800 text-white border-emerald-500/30" :
                      appQRTheme === "indigo" ? "bg-gradient-to-b from-indigo-600 to-indigo-900 text-white border-indigo-500/30" :
                      appQRTheme === "golden" ? "bg-gradient-to-b from-amber-600 to-amber-800 text-white border-amber-500/30" :
                      "bg-stone-50 text-slate-900 border-stone-200"
                    )}
                    style={{ minHeight: appQRFormat === "square" ? "360px" : appQRFormat === "a5_tent" ? "420px" : "480px" }}
                  >
                    {/* Top Watermark / Badge */}
                    <div className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">
                      <span className="flex items-center gap-1">
                        <Store size={12} /> {currentShop?.name || "Local Merchant"}
                      </span>
                      <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full">
                        {appQRFormat === "a4" ? "A4 Poster" : appQRFormat === "a5_tent" ? "Table Tent Fold" : "Square Sticker"}
                      </span>
                    </div>

                    {/* Header */}
                    <div className="space-y-1.5 my-2 w-full">
                      <h3 className="text-xl md:text-2xl font-headline font-black tracking-tight leading-tight uppercase">
                        {appQRHeadline}
                      </h3>
                      <p className="text-xs opacity-90 line-clamp-2 max-w-xs mx-auto leading-relaxed font-medium">
                        {appQRSubline}
                      </p>
                    </div>

                    {/* QR Box centerpiece */}
                    <div className="my-3 p-4 bg-white rounded-2xl shadow-lg flex flex-col items-center text-slate-900 relative group">
                      {appQRPreviewUrl ? (
                        <img src={appQRPreviewUrl} alt="Live QR Preview" className="w-36 h-36 md:w-40 md:h-40 object-contain rounded-lg" />
                      ) : (
                        <div className="w-36 h-36 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                          <QrCode size={48} className="animate-pulse" />
                        </div>
                      )}
                      
                      <div className="mt-2 bg-primary text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                        <span>📷 Scan with Camera App</span>
                      </div>
                    </div>

                    {/* Location Badge */}
                    {appQRLocationTag && (
                      <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold tracking-wide my-1">
                        📍 {appQRLocationTag}
                      </div>
                    )}

                    {/* Perks Footer */}
                    {appQRIncludePerks && appQRFormat === "a4" && (
                      <div className="text-[10px] font-bold opacity-85 pt-2 border-t border-white/20 w-full flex items-center justify-center gap-2">
                        <span>⚡ Instant Web App</span>
                        <span>•</span>
                        <span>💵 Cash Accepted</span>
                        <span>•</span>
                        <span>🎯 0% Markup</span>
                      </div>
                    )}

                    <div className="text-[9px] font-medium opacity-60 mt-2">
                      Powered by LocalEats • Direct Digital Menu
                    </div>
                  </div>

                  {/* Copy Direct Link bar under preview */}
                  <div className="w-full bg-surface-container p-3 rounded-2xl border border-outline-variant/10 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={\`https://www.localeatssa.co.za/?shopId=\${currentShop?.id || ""}\`}
                      className="flex-1 bg-transparent text-xs font-mono text-on-surface-variant outline-none px-1 truncate"
                    />
                    <button
                      onClick={handleCopyAppURL}
                      className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      {appQRCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      {appQRCopied ? "Copied" : "Copy Link"}
                    </button>
                  </div>
                </div>

                {/* RIGHT: Customization Controls Panel */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* 1. Format Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                      <Layers size={14} className="text-primary" /> 1. Select Print Format
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "a4", title: "A4 Poster", desc: "Wall / Window Display" },
                        { id: "a5_tent", title: "A5 Table Tent", desc: "Counter Standee Fold" },
                        { id: "square", title: "Square Badge", desc: "Table Sticker / Decal" },
                      ].map((fmt) => (
                        <button
                          key={fmt.id}
                          onClick={() => setAppQRFormat(fmt.id as any)}
                          className={cn(
                            "p-3 rounded-2xl border text-left transition-all flex flex-col justify-between",
                            appQRFormat === fmt.id
                              ? "bg-indigo-50/80 border-indigo-500 text-indigo-950 font-bold shadow-xs"
                              : "bg-surface-container hover:bg-surface-container-high border-outline-variant/20 text-on-surface"
                          )}
                        >
                          <span className="text-xs font-extrabold">{fmt.title}</span>
                          <span className="text-[10px] opacity-70 mt-1">{fmt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Color Theme Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={14} className="text-primary" /> 2. Color Theme Palette
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[
                        { id: "sunset", label: "Sunset Coral", color: "bg-[#FF5A36]" },
                        { id: "midnight", label: "Midnight", color: "bg-[#0F172A]" },
                        { id: "emerald", label: "Emerald", color: "bg-[#059669]" },
                        { id: "indigo", label: "Indigo", color: "bg-[#4F46E5]" },
                        { id: "golden", label: "Golden", color: "bg-[#D97706]" },
                        { id: "swiss", label: "Swiss Clean", color: "bg-[#FAFAF9] border border-slate-300" },
                      ].map((th) => (
                        <button
                          key={th.id}
                          onClick={() => setAppQRTheme(th.id as any)}
                          className={cn(
                            "p-2.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all",
                            appQRTheme === th.id
                              ? "border-indigo-600 bg-indigo-50/50 scale-105 shadow-xs"
                              : "border-outline-variant/20 bg-surface-container hover:bg-surface-container-high"
                          )}
                        >
                          <div className={cn("w-6 h-6 rounded-full shadow-inner", th.color)} />
                          <span className="text-[10px] font-bold text-on-surface truncate">{th.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Headline & Messaging Presets */}
                  <div className="space-y-3">
                    <label className="text-xs font-black text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                      <Tag size={14} className="text-primary" /> 3. Poster Headline & Content
                    </label>
                    
                    {/* Presets chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "SCAN TO ORDER & SKIP THE LINE",
                        "SCAN FOR DIGITAL MENU & ORDERS",
                        "ORDER AT YOUR TABLE INSTANTLY",
                        "CASH ON ARRIVAL & CARD ACCEPTED",
                      ].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setAppQRHeadline(preset)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface-container hover:bg-indigo-50 hover:text-indigo-600 border border-outline-variant/10 transition-colors"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        value={appQRHeadline}
                        onChange={(e) => setAppQRHeadline(e.target.value.toUpperCase())}
                        placeholder="Headline e.g. SCAN TO ORDER NOW"
                        className="w-full bg-surface-container px-4 py-3 rounded-xl border border-outline-variant/20 focus:border-indigo-500 outline-none text-sm font-black uppercase tracking-wide"
                      />
                    </div>

                    <div className="space-y-2">
                      <textarea
                        value={appQRSubline}
                        onChange={(e) => setAppQRSubline(e.target.value)}
                        rows={2}
                        placeholder="Subline e.g. Order directly from your phone..."
                        className="w-full bg-surface-container px-4 py-3 rounded-xl border border-outline-variant/20 focus:border-indigo-500 outline-none text-xs font-medium resize-none"
                      />
                    </div>

                    {/* Table / Location Stand Identifier */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[11px] font-bold text-on-surface-variant mb-1 block">
                          Table / Stand Label (Optional)
                        </label>
                        <input
                          type="text"
                          value={appQRLocationTag}
                          onChange={(e) => setAppQRLocationTag(e.target.value)}
                          placeholder="e.g. Table #04 or Main Bar"
                          className="w-full bg-surface-container px-3.5 py-2.5 rounded-xl border border-outline-variant/20 focus:border-indigo-500 outline-none text-xs font-bold"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-surface-container rounded-xl border border-outline-variant/10 mt-5">
                        <span className="text-xs font-bold text-on-surface">Show Perk Badges</span>
                        <input
                          type="checkbox"
                          checked={appQRIncludePerks}
                          onChange={(e) => setAppQRIncludePerks(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="p-6 border-t border-outline-variant/10 bg-surface flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  onClick={() => setShowAppQRFlyerModal(false)}
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
                >
                  Close Studio
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleDownloadAppQRPNG}
                    className="flex-1 sm:flex-none px-5 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 border border-outline-variant/20"
                  >
                    <Download size={14} /> Download PNG Image
                  </button>

                  <button
                    onClick={handleGenerateAppQRPDF}
                    disabled={qrGenerating}
                    className="flex-1 sm:flex-none px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-black shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {qrGenerating ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    {qrGenerating ? "Generating Print PDF..." : "Export Print PDF"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
`;

content = content.substring(0, startIndex) + replacementCode + content.substring(endIndex);
fs.writeFileSync("src/App.tsx", content, "utf-8");
console.log("Successfully updated App.tsx with high-engagement Direct App QR Flyer Studio!");
