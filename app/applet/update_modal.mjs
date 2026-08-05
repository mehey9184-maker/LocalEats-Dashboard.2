import fs from 'fs';

let text = fs.readFileSync('src/App.tsx', 'utf-8');

const oldModalStart = text.indexOf('{/* DIRECT APP QR FLYER INTERACTIVE BUILDER MODAL */}');
const oldModalEnd = text.indexOf('const Coupons = ({');

if (oldModalStart === -1 || oldModalEnd === -1) {
  console.error('Could not locate modal start/end!');
  process.exit(1);
}

const newModalCode = `{/* DIRECT APP QR FLYER INTERACTIVE BUILDER MODAL */}
        {showAppQRFlyerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/50 backdrop-blur-md overflow-hidden"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-surface w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-outline-variant/20 relative z-10"
            >
              {/* Modal Header - Steve Krug Don't Make Me Think Principles */}
              <div className="p-5 md:px-8 md:py-5 border-b border-outline-variant/10 bg-surface-container-lowest flex items-center justify-between shrink-0 z-20 relative">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <Sparkles size={12} /> Don't Make Me Think Studio
                    </span>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-on-surface tracking-tight flex items-center gap-2">
                      <QrCode className="text-indigo-600" size={24} /> Direct App QR Flyer & Culinary Guide Builder
                    </h2>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
                    Self-evident print studio • Click a preset to generate a ready-to-print poster, standee, or 2-page <strong className="text-indigo-600 font-bold">Culinary Journey Guide</strong>.
                  </p>
                </div>
                <button
                  onClick={() => setShowAppQRFlyerModal(false)}
                  className="p-2 bg-surface-container hover:bg-surface-container-high rounded-full transition-colors text-on-surface shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body - Grid layout */}
              <div className="p-5 md:p-8 flex-1 overflow-y-auto custom-scrollbar bg-surface-container-lowest/50 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start relative z-10">
                
                {/* LEFT: Live Interactive Poster / Guide Preview Stage */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-4 lg:sticky lg:top-0 static z-10 w-full">
                  <div className="w-full flex items-center justify-between gap-2">
                    <div className="text-xs font-black uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5 shrink-0">
                      <Sparkles size={14} className="text-indigo-500" /> Live Interactive Preview
                    </div>
                    {appQRIncludeCulinaryGuide && (
                      <div className="flex bg-surface-container p-1 rounded-xl text-[10px] font-bold shrink-0">
                        <button
                          onClick={() => setAppQRPreviewTab("poster")}
                          className={cn("px-2.5 py-1 rounded-lg transition-all", appQRPreviewTab === "poster" ? "bg-indigo-600 text-white font-black shadow-xs" : "text-on-surface-variant")}
                        >
                          📷 Page 1 (Poster)
                        </button>
                        <button
                          onClick={() => setAppQRPreviewTab("guide")}
                          className={cn("px-2.5 py-1 rounded-lg transition-all", appQRPreviewTab === "guide" ? "bg-indigo-600 text-white font-black shadow-xs" : "text-on-surface-variant")}
                        >
                          📖 Page 2 (Guide)
                        </button>
                      </div>
                    )}
                  </div>

                  {/* PREVIEW CONTAINER SWITCHER */}
                  {appQRPreviewTab === "poster" || !appQRIncludeCulinaryGuide ? (
                    /* Poster Mockup Container */
                    <div
                      className={cn(
                        "w-full rounded-3xl p-5 md:p-6 shadow-xl flex flex-col items-center text-center transition-all duration-300 relative overflow-hidden border space-y-3 min-h-[420px]",
                        appQRTheme === "sunset" ? "bg-gradient-to-b from-[#FF5A36] to-[#D9381E] text-white border-orange-400/30" :
                        appQRTheme === "midnight" ? "bg-slate-900 text-white border-slate-700/50" :
                        appQRTheme === "emerald" ? "bg-gradient-to-b from-emerald-600 to-emerald-800 text-white border-emerald-500/30" :
                        appQRTheme === "indigo" ? "bg-gradient-to-b from-indigo-600 to-indigo-900 text-white border-indigo-500/30" :
                        appQRTheme === "golden" ? "bg-gradient-to-b from-amber-600 to-amber-800 text-white border-amber-500/30" :
                        "bg-stone-50 text-slate-900 border-stone-200"
                      )}
                    >
                      {/* Top Watermark / Badge */}
                      <div className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-80 shrink-0">
                        <span className="flex items-center gap-1 truncate max-w-[180px]">
                          <Store size={12} className="shrink-0" /> <span className="truncate">{currentShop?.name || "Local Merchant"}</span>
                        </span>
                        <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full shrink-0">
                          {appQRFormat === "a4" ? "A4 Poster" : appQRFormat === "a5_tent" ? "Table Tent Fold" : "Square Sticker"}
                        </span>
                      </div>

                      {/* Header */}
                      <div className="space-y-1 w-full shrink-0">
                        <h3 className="text-lg md:text-xl font-headline font-black tracking-tight leading-tight uppercase">
                          {appQRHeadline}
                        </h3>
                        <p className="text-xs opacity-90 line-clamp-2 max-w-xs mx-auto leading-relaxed font-medium">
                          {appQRSubline}
                        </p>
                      </div>

                      {/* QR Box centerpiece */}
                      <div className="p-3 bg-white rounded-2xl shadow-lg flex flex-col items-center text-slate-900 relative group shrink-0">
                        {appQRPreviewUrl ? (
                          <img src={appQRPreviewUrl} alt="Live QR Preview" className="w-32 h-32 md:w-36 md:h-36 object-contain rounded-lg" />
                        ) : (
                          <div className="w-32 h-32 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                            <QrCode size={40} className="animate-pulse" />
                          </div>
                        )}
                        <div className="mt-2 bg-primary text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                          <span>📷 Scan with Camera App</span>
                        </div>
                      </div>

                      {/* Location Badge */}
                      {appQRLocationTag && (
                        <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold tracking-wide shrink-0">
                          📍 {appQRLocationTag}
                        </div>
                      )}

                      {/* Perks Footer */}
                      {appQRIncludePerks && appQRFormat === "a4" && (
                        <div className="text-[10px] font-bold opacity-85 pt-2 border-t border-white/20 w-full flex items-center justify-center gap-2 shrink-0">
                          <span>⚡ Instant Web App</span>
                          <span>•</span>
                          <span>💵 Cash Accepted</span>
                          <span>•</span>
                          <span>🎯 0% Markup</span>
                        </div>
                      )}

                      {/* Culinary Guide Page 2 Badge */}
                      {appQRIncludeCulinaryGuide && appQRFormat === "a4" && (
                        <div className="px-3 py-1 bg-black/20 backdrop-blur-md rounded-lg text-[10px] font-bold text-white flex items-center gap-1 shrink-0">
                          <BookOpen size={12} /> Includes Page 2: Discover Local Eats Guide
                        </div>
                      )}

                      <div className="text-[9px] font-medium opacity-60 shrink-0">
                        Powered by LocalEats • Direct Digital Menu
                      </div>
                    </div>
                  ) : (
                    /* Culinary Guide Page 2 Preview */
                    <div className="w-full rounded-3xl p-5 shadow-xl bg-slate-50 text-slate-900 border border-slate-200 text-left space-y-3 max-h-[460px] overflow-y-auto custom-scrollbar">
                      <div className="border-b pb-2 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Page 2 Preview</div>
                          <h4 className="text-xs font-black text-slate-900 uppercase">Discover Local Eats Guide</h4>
                        </div>
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                          {appQRSocialHashtag}
                        </span>
                      </div>

                      {/* Section 1 */}
                      <div className="bg-amber-500/10 p-2.5 rounded-2xl border border-amber-500/20 text-xs space-y-1">
                        <div className="font-black text-amber-900 flex items-center gap-1">
                          <Compass size={14} /> 1. Importance of Local Cuisine
                        </div>
                        <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                          Supports local chefs, preserves authentic heritage recipes, and fosters community connection.
                        </p>
                      </div>

                      {/* Section 2 */}
                      <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20 text-xs space-y-1.5">
                        <div className="font-black text-emerald-900 flex items-center gap-1">
                          <Sliders size={14} /> 2. Personal Customization Options
                        </div>
                        <div className="text-[10px] font-medium text-slate-800 space-y-0.5">
                          <div><strong className="text-slate-900">Dietary:</strong> Vegan, Gluten-Free, Halal, Nut-Free, Low Carb</div>
                          <div><strong className="text-slate-900">Flavors:</strong> Spicy 🔥, Savory 🧄, Sweet 🍩, Tangy 🍋, Umami 🍄</div>
                          <div><strong className="text-slate-900">Moods:</strong> Quick Bite ⚡, Comfort 🍲, Gourmet 🍷, Late Night 🌙</div>
                        </div>
                      </div>

                      {/* Section 3 */}
                      <div className="bg-indigo-500/10 p-2.5 rounded-2xl border border-indigo-500/20 text-xs space-y-1">
                        <div className="font-black text-indigo-900 flex items-center gap-1">
                          <Sparkles size={14} /> 3. Dining Psychology & Ambiance
                        </div>
                        <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                          Lighting, warm music, emotional comfort, and visual storytelling heighten dining pleasure.
                        </p>
                      </div>

                      {/* Section 4 */}
                      <div className="bg-slate-100 p-2.5 rounded-2xl border border-slate-300 text-xs space-y-1">
                        <div className="font-black text-slate-900 flex items-center gap-1">
                          <Share2 size={14} /> 4. Local Recommendations & Wishlist
                        </div>
                        <p className="text-[10px] text-slate-600 font-medium">
                          Highlights {currentShop?.name || "Merchant"} specials & provides printable note lines for customer favorites!
                        </p>
                      </div>
                    </div>
                  )}

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

                {/* RIGHT: Customization Controls Panel - Steve Krug Don't Make Me Think Structure */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* 1. Steve Krug Instant 1-Click Presets Bar */}
                  <div className="space-y-2 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-amber-50/50 p-4 rounded-3xl border border-indigo-100/80 shadow-xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={14} className="text-indigo-600" /> 1. Instant 1-Click Setup (Don't Make Me Think!)
                      </label>
                      <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                        Preset Engine
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      {/* Preset 1: Table Standee */}
                      <button
                        onClick={() => {
                          setAppQRFormat("a5_tent");
                          setAppQRTheme("sunset");
                          setAppQRHeadline("SCAN AT YOUR TABLE TO ORDER");
                          setAppQRSubline("Scan the QR code with your camera app to view our digital menu and order instantly.");
                          setAppQRLocationTag("Table #01");
                          setAppQRIncludePerks(true);
                          setAppQRIncludeCulinaryGuide(false);
                          setAppQRPreviewTab("poster");
                        }}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all hover:scale-[1.02] flex flex-col justify-between group",
                          appQRFormat === "a5_tent" && !appQRIncludeCulinaryGuide
                            ? "bg-white border-indigo-500 shadow-sm ring-2 ring-indigo-500/20"
                            : "bg-white/80 border-slate-200 hover:bg-white"
                        )}
                      >
                        <div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-indigo-600 flex items-center gap-1">
                            <span>🪑 Table Standee</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium mt-1">A5 Foldable Stand • Table Tag Enabled</p>
                        </div>
                        <span className="mt-2 text-[9px] font-extrabold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full w-fit">
                          Select Preset
                        </span>
                      </button>

                      {/* Preset 2: 2-Page Poster + Culinary Guide */}
                      <button
                        onClick={() => {
                          setAppQRFormat("a4");
                          setAppQRTheme("sunset");
                          setAppQRHeadline("SCAN FOR DIGITAL MENU & ORDERS");
                          setAppQRSubline("Discover local flavors, authentic recipes, and place your instant order.");
                          setAppQRIncludePerks(true);
                          setAppQRIncludeCulinaryGuide(true);
                          setAppQRPreviewTab("guide");
                        }}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all hover:scale-[1.02] flex flex-col justify-between group",
                          appQRFormat === "a4" && appQRIncludeCulinaryGuide
                            ? "bg-white border-indigo-500 shadow-sm ring-2 ring-indigo-500/20"
                            : "bg-white/80 border-slate-200 hover:bg-white"
                        )}
                      >
                        <div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-indigo-600 flex items-center gap-1">
                            <span>📖 Poster + Guide</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium mt-1">A4 Poster + Page 2 Culinary Journey</p>
                        </div>
                        <span className="mt-2 text-[9px] font-extrabold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full w-fit">
                          Select Preset
                        </span>
                      </button>

                      {/* Preset 3: Window / Counter Sticker */}
                      <button
                        onClick={() => {
                          setAppQRFormat("square");
                          setAppQRTheme("midnight");
                          setAppQRHeadline("SCAN TO ORDER & SKIP LINE");
                          setAppQRSubline("Instant digital ordering directly from your phone.");
                          setAppQRLocationTag("");
                          setAppQRIncludePerks(false);
                          setAppQRIncludeCulinaryGuide(false);
                          setAppQRPreviewTab("poster");
                        }}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all hover:scale-[1.02] flex flex-col justify-between group",
                          appQRFormat === "square"
                            ? "bg-white border-indigo-500 shadow-sm ring-2 ring-indigo-500/20"
                            : "bg-white/80 border-slate-200 hover:bg-white"
                        )}
                      >
                        <div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-indigo-600 flex items-center gap-1">
                            <span>🏷️ Counter Sticker</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium mt-1">Square Decal • High Impact Design</p>
                        </div>
                        <span className="mt-2 text-[9px] font-extrabold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full w-fit">
                          Select Preset
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Format Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                      <Layers size={14} className="text-primary" /> 2. Print Format & Layout
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { id: "a4", title: "A4 Poster", desc: "Wall / Window Display" },
                        { id: "a5_tent", title: "A5 Table Tent", desc: "Counter Standee Fold" },
                        { id: "square", title: "Square Badge", desc: "Table Sticker / Decal" },
                      ].map((fmt) => (
                        <button
                          key={fmt.id}
                          onClick={() => setAppQRFormat(fmt.id as "a4" | "a5_tent" | "square")}
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

                  {/* 3. Color Theme Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={14} className="text-primary" /> 3. Brand Theme Palette
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
                          onClick={() => setAppQRTheme(th.id as "sunset" | "midnight" | "emerald" | "indigo" | "golden" | "swiss")}
                          className={cn(
                            "p-2.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all",
                            appQRTheme === th.id
                              ? "border-indigo-600 bg-indigo-50/50 scale-105 shadow-xs"
                              : "border-outline-variant/20 bg-surface-container hover:bg-surface-container-high"
                          )}
                        >
                          <div className={cn("w-6 h-6 rounded-full shadow-inner shrink-0", th.color)} />
                          <span className="text-[10px] font-bold text-on-surface truncate w-full text-center">{th.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. Headline & Messaging */}
                  <div className="space-y-3">
                    <label className="text-xs font-black text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                      <Tag size={14} className="text-primary" /> 4. Poster Headline & Content
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

                      <div className="flex flex-col justify-end">
                        <div className="flex items-center justify-between p-2.5 bg-surface-container rounded-xl border border-outline-variant/10 h-[42px]">
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

                  {/* 5. Discover Local Eats Culinary Guide Builder */}
                  <div className="space-y-3 pt-3 border-t border-outline-variant/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-black text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                        <BookOpen size={14} className="text-indigo-600" /> 5. Page 2: Discover Local Eats Guide
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-full border border-indigo-200 transition-colors shrink-0">
                        <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wider">Include Page 2 Guide</span>
                        <input
                          type="checkbox"
                          checked={appQRIncludeCulinaryGuide}
                          onChange={(e) => {
                            setAppQRIncludeCulinaryGuide(e.target.checked);
                            if (e.target.checked) setAppQRPreviewTab("guide");
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </label>
                    </div>

                    {appQRIncludeCulinaryGuide && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="space-y-3 bg-surface-container/60 p-4 rounded-2xl border border-indigo-100"
                      >
                        <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                          Attaches Page 2 to your PDF: <strong className="text-on-surface">Discover Local Eats: A Personalized Culinary Journey</strong>. Incorporates local cuisine benefits, dietary/flavor checklists, dining psychology insights, and custom wishlist lines.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-black uppercase text-on-surface-variant mb-1 block">
                              Social Sharing Hashtag
                            </label>
                            <input
                              type="text"
                              value={appQRSocialHashtag}
                              onChange={(e) => setAppQRSocialHashtag(e.target.value)}
                              placeholder="#LocalEatsSA"
                              className="w-full bg-surface-container-highest/60 px-3 py-2 rounded-xl border border-outline-variant/20 text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-on-surface-variant mb-1 block">
                              Dining Psychology Focus
                            </label>
                            <input
                              type="text"
                              value={appQRPsychologyFocus}
                              onChange={(e) => setAppQRPsychologyFocus(e.target.value)}
                              placeholder="Ambiance, Emotion & Storytelling"
                              className="w-full bg-surface-container-highest/60 px-3 py-2 rounded-xl border border-outline-variant/20 text-xs font-bold"
                            />
                          </div>
                        </div>

                        {/* Guide Section Feature Badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <div className="p-2 bg-amber-500/10 rounded-xl text-[10px] font-bold text-amber-900 flex items-center gap-1.5">
                            <Compass size={12} className="text-amber-600 shrink-0" /> Section 1: Local Cuisine Roots
                          </div>
                          <div className="p-2 bg-emerald-500/10 rounded-xl text-[10px] font-bold text-emerald-900 flex items-center gap-1.5">
                            <Sliders size={12} className="text-emerald-600 shrink-0" /> Section 2: Dietary & Flavor Checklist
                          </div>
                          <div className="p-2 bg-indigo-500/10 rounded-xl text-[10px] font-bold text-indigo-900 flex items-center gap-1.5">
                            <Sparkles size={12} className="text-indigo-600 shrink-0" /> Section 3: Dining Psychology
                          </div>
                          <div className="p-2 bg-rose-500/10 rounded-xl text-[10px] font-bold text-rose-900 flex items-center gap-1.5">
                            <Share2 size={12} className="text-rose-600 shrink-0" /> Section 4: Spot Wishlist & CTA
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="p-5 md:px-8 md:py-5 border-t border-outline-variant/10 bg-surface flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 z-20 relative">
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
                    {qrGenerating ? "Generating Print PDF..." : appQRIncludeCulinaryGuide ? "Export 2-Page Print PDF" : "Export Print PDF"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};`;

text = text.substring(0, oldModalStart) + newModalCode + "\n\n" + text.substring(oldModalEnd);
fs.writeFileSync('src/App.tsx', text, 'utf-8');
console.log('Successfully updated modal with mjs script!');
