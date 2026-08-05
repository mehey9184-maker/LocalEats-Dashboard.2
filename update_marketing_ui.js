import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf-8');

// Find the return statement of Marketing component
const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes('const Marketing = ({'));
let returnIdx = -1;
for(let i = startIdx; i < lines.length; i++) {
  if (lines[i].trim() === 'return (') {
    returnIdx = i;
    break;
  }
}

// Find the end of Marketing (just before `const Coupons =`)
let endIdx = -1;
for(let i = returnIdx; i < lines.length; i++) {
  if (lines[i].includes('const Coupons = ({')) {
    endIdx = i - 2; // the `};` before it
    break;
  }
}

const before = lines.slice(0, returnIdx).join('\n');
const after = lines.slice(endIdx + 1).join('\n');

const newUI = `  return (
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

      {/* MARKETING TOOLS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="marketing_primary_tools">
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

        {/* App QR Flyer */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-500">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">App QR Flyer</h3>
              <p className="text-xs text-on-surface-variant/80 mt-1 leading-relaxed">
                Generate a ready-to-print poster with a QR code for direct customer orders.
              </p>
            </div>
          </div>
          <button
            onClick={handleGenerateAppQRPDF}
            className="mt-6 w-full py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-xl text-xs transition-colors text-center"
          >
            Download PDF
          </button>
        </motion.div>

        {/* AI Copywriter */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-500">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">AI Campaign</h3>
              <p className="text-xs text-on-surface-variant/80 mt-1 leading-relaxed">
                Draft professional emails, SMS, or social captions to boost weekend sales.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setCampaignType("email");
              setShowCampaignModal(true);
            }}
            className="mt-6 w-full py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-xl text-xs transition-colors text-center"
          >
            Draft Campaign
          </button>
        </motion.div>

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
      </div>

      <AnimatePresence>
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
      </AnimatePresence>
    </div>
  );
`;

const finalContent = before + '\n' + newUI + '\n' + after;

fs.writeFileSync('src/App.tsx', finalContent);
console.log("Updated Marketing UI!");
