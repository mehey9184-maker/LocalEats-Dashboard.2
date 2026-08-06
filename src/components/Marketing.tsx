import React, { useState, useEffect } from "react";
import { QrCode, Share2, Copy, Check, Download, Sparkles, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Shop } from "../types";

interface MarketingProps {
  currentShop: Shop | undefined;
  setShops: React.Dispatch<React.SetStateAction<Shop[]>>;
}

export const Marketing: React.FC<MarketingProps> = ({ currentShop }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const storeUrl = currentShop ? `https://www.localeatssa.co.za/?shopId=${currentShop.id}` : "https://www.localeatssa.co.za";

  useEffect(() => {
    let active = true;
    const generateQR = async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const url = await QRCode.toDataURL(storeUrl, {
          width: 350,
          margin: 1,
          color: { dark: "#0F172A", light: "#FFFFFF" },
        });
        if (active) setQrDataUrl(url);
      } catch (e) {
        console.error("QR Code Error:", e);
      }
    };
    generateQR();
    return () => {
      active = false;
    };
  }, [storeUrl]);

  const copyStoreUrl = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopiedLink(true);
    toast.success("Store link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="w-full space-y-6">
      <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs">
        <h2 className="text-xl font-extrabold text-on-surface flex items-center gap-2">
          <Megaphone className="text-primary" size={22} />
          <span>Marketing & Customer Growth Studio</span>
        </h2>
        <p className="text-xs text-on-surface-variant mt-1">
          Promote your digital store with custom QR codes, social shares, and recruitment flyers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Digital QR Code Stand */}
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 flex flex-col items-center text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <QrCode size={24} />
          </div>
          <h3 className="font-extrabold text-base text-on-surface">Store Digital QR Code</h3>
          <p className="text-xs text-on-surface-variant max-w-xs">
            Print or place this code on counter stands so customers can scan & order instantly.
          </p>

          {qrDataUrl ? (
            <div className="p-3 bg-white rounded-2xl shadow-md border border-outline-variant/10">
              <img src={qrDataUrl} alt="Store QR Code" className="w-48 h-48 rounded-xl object-contain" />
            </div>
          ) : (
            <div className="w-48 h-48 bg-surface-container rounded-2xl animate-pulse" />
          )}

          <div className="flex items-center gap-2 w-full pt-2">
            <button
              onClick={copyStoreUrl}
              className="flex-1 py-2.5 rounded-2xl bg-surface-container-high text-on-surface text-xs font-bold flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-all cursor-pointer border border-outline-variant/20"
            >
              {copiedLink ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              <span>{copiedLink ? "Copied" : "Copy Store Link"}</span>
            </button>
            <a
              href={qrDataUrl}
              download={`QR_Code_${currentShop?.name || "LocalEats"}.png`}
              className="px-4 py-2.5 rounded-2xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all cursor-pointer shadow-md"
            >
              <Download size={16} />
              <span>Download</span>
            </a>
          </div>
        </div>

        {/* Promotion Strategy & Social Kit */}
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 space-y-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 mb-4">
              <Sparkles size={24} />
            </div>
            <h3 className="font-extrabold text-base text-on-surface">Quick Social Media Pitch</h3>
            <p className="text-xs text-on-surface-variant mt-1">
              Share this ready-made promo message on WhatsApp Status, Facebook, and Instagram to boost orders.
            </p>

            <div className="mt-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 text-xs font-mono text-on-surface leading-relaxed">
              🔥 <strong>{currentShop?.name || "Our Shop"} is live on LocalEats!</strong>
              <br />
              Order fresh meals directly from your phone for instant pickup & delivery.
              <br />
              📍 Link: {storeUrl}
            </div>
          </div>

          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: currentShop?.name || "LocalEats Shop",
                  text: `Order online from ${currentShop?.name || "LocalEats"}!`,
                  url: storeUrl,
                });
              } else {
                copyStoreUrl();
              }
            }}
            className="w-full py-3 rounded-2xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-all cursor-pointer"
          >
            <Share2 size={16} />
            <span>Share Store Pitch</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Marketing;
