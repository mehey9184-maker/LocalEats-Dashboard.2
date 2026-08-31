import React, { useState, useEffect, useCallback } from "react";
import {
  QrCode,
  Download,
  Printer,
  Layers,
  Eye,
  Utensils,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import QRCodeLib from "qrcode";
import { Shop } from "../../types";

interface TableTentGeneratorProps {
  activeShop: Shop | undefined;
  storeUrl: string;
}

export const TableTentGenerator: React.FC<TableTentGeneratorProps> = ({
  activeShop,
  storeUrl,
}) => {
  const shopName = activeShop?.name || "LocalEats Store";
  const [startTable, setStartTable] = useState<number>(1);
  const [endTable, setEndTable] = useState<number>(10);
  const [previewTableNum, setPreviewTableNum] = useState<number>(1);
  const [headerTitle, setHeaderTitle] = useState<string>("TABLE SERVICE • SCAN TO ORDER");
  const [themeColor, setThemeColor] = useState<"coral" | "midnight" | "amber" | "emerald">("coral");
  const [wifiInfo, setWifiInfo] = useState<string>("");
  const [previewQrDataUrl, setPreviewQrDataUrl] = useState<string>("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<number>(0);

  // Theme palettes
  const themes = {
    coral: {
      primary: "#EA580C",
      secondary: "#FFF7ED",
      accent: "#9A3412",
      border: "#FDBA74",
      label: "Township Coral",
    },
    midnight: {
      primary: "#0F172A",
      secondary: "#F8FAFC",
      accent: "#334155",
      border: "#CBD5E1",
      label: "Midnight Charcoal",
    },
    amber: {
      primary: "#D97706",
      secondary: "#FFFBEB",
      accent: "#B45309",
      border: "#FDE68A",
      label: "Golden Amber",
    },
    emerald: {
      primary: "#059669",
      secondary: "#ECFDF5",
      accent: "#047857",
      border: "#A7F3D0",
      label: "Emerald Fresh",
    },
  };

  const activeTheme = themes[themeColor];

  // Helper to generate dynamic URL with table parameter
  const getTableOrderUrl = useCallback((tableNum: number) => {
    const base = storeUrl || `https://www.localeatssa.co.za/?shopId=${activeShop?.id || "demo"}`;
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}table=${tableNum}&dineIn=true`;
  }, [storeUrl, activeShop?.id]);

  // Generate QR for preview table number
  useEffect(() => {
    let isMounted = true;
    const url = getTableOrderUrl(previewTableNum);

    QRCodeLib.toDataURL(url, {
      width: 400,
      margin: 1.5,
      color: {
        dark: themeColor === "midnight" ? "#0F172A" : themeColor === "coral" ? "#EA580C" : "#000000",
        light: "#FFFFFF",
      },
    })
      .then((dataUrl) => {
        if (isMounted) setPreviewQrDataUrl(dataUrl);
      })
      .catch((err) => {
        console.error("Failed to generate preview table QR:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [previewTableNum, getTableOrderUrl, themeColor]);

  // Generate Batch Multi-Page A4 PDF
  const handleDownloadBatchPdf = async () => {
    const totalCount = endTable - startTable + 1;
    if (totalCount <= 0 || totalCount > 50) {
      toast.error("Please select between 1 and 50 tables.");
      return;
    }

    setIsGeneratingPdf(true);
    setPdfProgress(0);

    try {
      // Create A4 PDF (Portrait: 210mm x 297mm)
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      for (let i = 0; i < totalCount; i++) {
        const tableNum = startTable + i;
        setPdfProgress(Math.round(((i + 1) / totalCount) * 100));

        if (i > 0) {
          doc.addPage();
        }

        // Generate high-res QR for this table
        const tableUrl = getTableOrderUrl(tableNum);
        const qrData = await QRCodeLib.toDataURL(tableUrl, {
          width: 600,
          margin: 1,
          color: {
            dark: themeColor === "midnight" ? "#0F172A" : "#1E293B",
            light: "#FFFFFF",
          },
        });

        const pageWidth = 210;

        // Top Half (Fold side A)
        // Background banner
        doc.setFillColor(activeTheme.primary);
        doc.rect(15, 15, pageWidth - 30, 24, "F");

        // Header Title
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(headerTitle, pageWidth / 2, 25, { align: "center" });

        doc.setFontSize(15);
        doc.text(shopName.toUpperCase(), pageWidth / 2, 33, { align: "center" });

        // Table Number Big Badge
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pageWidth / 2 - 35, 45, 70, 22, 4, 4, "F");
        doc.setDrawColor(activeTheme.primary);
        doc.setLineWidth(0.8);
        doc.roundedRect(pageWidth / 2 - 35, 45, 70, 22, 4, 4, "S");

        doc.setTextColor(activeTheme.primary);
        doc.setFontSize(10);
        doc.text("DINE-IN ORDERING", pageWidth / 2, 52, { align: "center" });
        doc.setFontSize(18);
        doc.text(`TABLE ${tableNum < 10 ? "0" + tableNum : tableNum}`, pageWidth / 2, 62, { align: "center" });

        // Center QR code (75mm x 75mm)
        doc.addImage(qrData, "PNG", pageWidth / 2 - 38, 72, 76, 76);

        // Ordering Instructions Box
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(25, 152, pageWidth - 50, 42, 3, 3, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(25, 152, pageWidth - 50, 42, 3, 3, "S");

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("HOW TO ORDER FROM YOUR TABLE:", pageWidth / 2, 160, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("1. Open your phone camera & point at the QR Code", pageWidth / 2, 168, { align: "center" });
        doc.text(`2. Select your meals & Kota specials (Table #${tableNum} is auto-linked)`, pageWidth / 2, 175, { align: "center" });
        doc.text("3. Submit order — Pay Cash to Waiter or Pay Card online!", pageWidth / 2, 182, { align: "center" });

        // Optional WiFi Footer
        if (wifiInfo.trim()) {
          doc.setTextColor(activeTheme.primary);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(`📶 ${wifiInfo}`, pageWidth / 2, 202, { align: "center" });
        }

        // Center Fold Guide Line (at 210mm)
        doc.setDrawColor(148, 163, 184);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(10, 215, pageWidth - 10, 215);

        doc.setTextColor(148, 163, 184);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.text("✂️ Fold or cut along this line to stand on Table " + tableNum, pageWidth / 2, 220, { align: "center" });

        // Bottom Half Summary / Stand Base
        doc.setFillColor(activeTheme.primary);
        doc.roundedRect(30, 230, pageWidth - 60, 40, 4, 4, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(`TABLE ${tableNum} • ${shopName}`, pageWidth / 2, 245, { align: "center" });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Powered by LocalEats Township Digital Ordering", pageWidth / 2, 255, { align: "center" });
      }

      // Save PDF file
      doc.save(`${shopName.toLowerCase().replace(/\s+/g, "_")}_table_tents_${startTable}_to_${endTable}.pdf`);
      toast.success(`Successfully generated PDF for Tables ${startTable} to ${endTable}!`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-gradient-to-br from-emerald-500/10 via-surface-container-lowest to-surface-container-lowest p-6 rounded-3xl border border-emerald-500/20 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                <Utensils size={12} /> Dine-In QR Tables
              </span>
              <span className="text-xs font-bold text-on-surface-variant">
                Batch Table Tent & Stand Generator
              </span>
            </div>
            <h3 className="text-lg font-black text-on-surface font-headline">
              Batch Dine-In Table Tent Card Generator
            </h3>
            <p className="text-xs text-on-surface-variant max-w-2xl leading-relaxed">
              Generate numbered table QR codes for tables 1 through 20 with embedded table parameters. Diners scan from their table and their order automatically includes their table number!
            </p>
          </div>

          <button
            onClick={handleDownloadBatchPdf}
            disabled={isGeneratingPdf}
            className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer shrink-0"
          >
            <Printer size={16} />
            <span>
              {isGeneratingPdf
                ? `Generating PDF (${pdfProgress}%)...`
                : `Export All Tables PDF (Tables ${startTable} - ${endTable})`}
            </span>
          </button>
        </div>
      </div>

      {/* Main Grid: Customizer Controls + Live Table Tent Mockup */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Customizer & Table Range */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-5">
            <h4 className="font-black text-base text-on-surface flex items-center gap-2">
              <Layers size={18} className="text-emerald-600" />
              <span>Table Range & Settings</span>
            </h4>

            {/* Table Range Selector */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-2">
                Table Numbers to Generate
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-on-surface-variant mb-1 block">From Table #</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={startTable}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      setStartTable(val);
                      if (previewTableNum < val) setPreviewTableNum(val);
                    }}
                    className="w-full bg-surface-container-high border-none rounded-xl px-3 py-2.5 text-xs font-bold text-on-surface outline-none"
                  />
                </div>

                <div>
                  <span className="text-[11px] text-on-surface-variant mb-1 block">To Table #</span>
                  <input
                    type="number"
                    min={startTable}
                    max={50}
                    value={endTable}
                    onChange={(e) => {
                      const val = Math.max(startTable, parseInt(e.target.value) || startTable);
                      setEndTable(val);
                      if (previewTableNum > val) setPreviewTableNum(val);
                    }}
                    className="w-full bg-surface-container-high border-none rounded-xl px-3 py-2.5 text-xs font-bold text-on-surface outline-none"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-4 gap-2 mt-2.5">
                {[
                  { label: "1 - 5", s: 1, e: 5 },
                  { label: "1 - 10", s: 1, e: 10 },
                  { label: "1 - 20", s: 1, e: 20 },
                  { label: "1 - 30", s: 1, e: 30 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setStartTable(preset.s);
                      setEndTable(preset.e);
                    }}
                    className={`py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      startTable === preset.s && endTable === preset.e
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Selector */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-2">
                Card Color Theme
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(themes) as (keyof typeof themes)[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setThemeColor(key)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      themeColor === key
                        ? "border-emerald-600 bg-emerald-500/10 font-bold shadow-xs"
                        : "border-outline-variant/15 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full shadow-xs"
                      style={{ backgroundColor: themes[key].primary }}
                    />
                    <span className="text-xs text-on-surface">{themes[key].label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Header Text */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Header Tagline
              </label>
              <input
                type="text"
                value={headerTitle}
                onChange={(e) => setHeaderTitle(e.target.value)}
                className="w-full bg-surface-container-high border-none rounded-xl px-3.5 py-2.5 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary outline-none"
                placeholder="e.g. TABLE SERVICE • SCAN TO ORDER"
              />
            </div>

            {/* WiFi Note */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Optional WiFi Info (Printed on Bottom)
              </label>
              <input
                type="text"
                value={wifiInfo}
                onChange={(e) => setWifiInfo(e.target.value)}
                className="w-full bg-surface-container-high border-none rounded-xl px-3.5 py-2.5 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary outline-none"
                placeholder="e.g. WiFi: LocalEats_Guest | Pass: hotkota123"
              />
            </div>

            {/* Download PDF Trigger */}
            <button
              onClick={handleDownloadBatchPdf}
              disabled={isGeneratingPdf}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Download size={16} />
              <span>
                {isGeneratingPdf
                  ? `Compiling PDF (${pdfProgress}%)...`
                  : `Download Multi-Page A4 PDF (${endTable - startTable + 1} Tables)`}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Live Interactive Table Tent Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-on-surface flex items-center gap-1.5">
                <Eye size={16} className="text-emerald-600" />
                <span>Live Table Tent Stand Preview</span>
              </span>

              {/* Preview Table Switcher */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-on-surface-variant font-bold">Preview Table:</span>
                <select
                  value={previewTableNum}
                  onChange={(e) => setPreviewTableNum(Number(e.target.value))}
                  className="bg-surface-container-high border-none rounded-lg px-2.5 py-1 text-xs font-bold text-on-surface outline-none"
                >
                  {Array.from({ length: endTable - startTable + 1 }, (_, i) => startTable + i).map((num) => (
                    <option key={num} value={num}>
                      Table {num}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table Tent Card Mockup */}
            <div className="max-w-md mx-auto bg-white text-slate-900 rounded-3xl shadow-xl border border-slate-200 overflow-hidden text-center">
              {/* Header Banner */}
              <div
                className="py-4 px-6 text-white"
                style={{ backgroundColor: activeTheme.primary }}
              >
                <p className="text-[10px] font-black uppercase tracking-widest opacity-90">
                  {headerTitle}
                </p>
                <h3 className="text-xl font-black font-headline tracking-tight mt-0.5">
                  {shopName}
                </h3>
              </div>

              {/* Table Number Pill */}
              <div className="p-6 space-y-4">
                <div
                  className="inline-block px-6 py-2 rounded-2xl border-2"
                  style={{
                    borderColor: activeTheme.primary,
                    backgroundColor: activeTheme.secondary,
                  }}
                >
                  <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: activeTheme.primary }}>
                    Dine-In Table
                  </p>
                  <p className="text-3xl font-black font-headline" style={{ color: activeTheme.primary }}>
                    TABLE {previewTableNum < 10 ? "0" + previewTableNum : previewTableNum}
                  </p>
                </div>

                {/* QR Code */}
                <div className="p-3 bg-white rounded-2xl shadow-inner border border-slate-100 inline-block">
                  {previewQrDataUrl ? (
                    <img
                      src={previewQrDataUrl}
                      alt={`Table ${previewTableNum} QR Code`}
                      className="w-48 h-48 rounded-xl object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-48 h-48 bg-slate-100 rounded-xl animate-pulse flex items-center justify-center text-slate-400">
                      <QrCode size={40} />
                    </div>
                  )}
                </div>

                {/* Steps */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-left space-y-1 text-xs text-slate-600">
                  <p className="font-extrabold text-slate-900 text-center mb-1">
                    How to order from Table {previewTableNum}:
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                    <span>Scan with your phone camera</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                    <span>Select meals & customize order</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                    <span>Pay Cash to waiter or Card online!</span>
                  </p>
                </div>

                {wifiInfo && (
                  <p className="text-xs font-bold flex items-center justify-center gap-1.5 text-slate-700">
                    <Wifi size={14} className="text-emerald-600" />
                    <span>{wifiInfo}</span>
                  </p>
                )}

                {/* Cut line indicator */}
                <div className="pt-3 border-t border-dashed border-slate-300 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                  <span>✂️ Fold line for A-Frame table tent standing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default TableTentGenerator;
