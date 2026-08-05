import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// I will insert states for the Flyer Builder inside the Marketing component.
// Before that, I will also insert the Flyer Builder UI.

const newStates = `
  // Flyer Studio customizer states
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [flyerTheme, setFlyerTheme] = useState<"orange" | "emerald" | "midnight" | "rose" | "purple">("orange");
  const [flyerSize, setFlyerSize] = useState<"A4" | "Tent" | "Stand">("A4");
  const [flyerHeadline, setFlyerHeadline] = useState("Order Online & Skip the Queue!");
  const [flyerSubline, setFlyerSubline] = useState("Scan to view our live, fresh, handcrafted menu items.");
  const [flyerCTA, setFlyerCTA] = useState("Fast bicycle delivery, direct service.");
  const [flyerCouponCode, setFlyerCouponCode] = useState("");
  const [flyerMobileTab, setFlyerMobileTab] = useState<"edit" | "preview">("edit");

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
`;

content = content.replace(
  '  const [qrGenerating, setQrGenerating] = useState(false);',
  '  const [qrGenerating, setQrGenerating] = useState(false);\n' + newStates
);

const newCard = `
        {/* Flyer Builder */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-500">
              <Printer size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">Flyer Builder</h3>
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
`;

content = content.replace(
  '        {/* App QR Flyer */}',
  newCard + '\n        {/* App QR Flyer */}'
);

content = content.replace(
  'className="grid grid-cols-1 md:grid-cols-2 gap-6"',
  'className="grid grid-cols-1 md:grid-cols-3 gap-6"'
);


const newModal = `
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
`;

content = content.replace(
  '        {/* HIRING RIDER MODAL */}',
  newModal + '\n        {/* HIRING RIDER MODAL */}'
);

fs.writeFileSync('src/App.tsx', content);
