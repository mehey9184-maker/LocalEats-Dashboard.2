import React, { useEffect, useState } from "react";
import { Copy, Download, QrCode } from "lucide-react";
import { toast } from "sonner";
import { COUNTER_HEADLINES, CUSTOMER_ADDRESS, CUSTOMER_ORIGIN, counterSignPdf, createCounterDesign, shopMenuUrl, type CounterQrStyle } from "./counterSign";

export function CounterSignStudio({ shopId, shopName }: { shopId?: string | number; shopName?: string }) {
  const [headline, setHeadline] = useState(COUNTER_HEADLINES[0]);
  const [withLogo, setWithLogo] = useState(true);
  const [style, setStyle] = useState<CounterQrStyle>("dots");
  const [qr, setQr] = useState<{ url: string; logo: boolean; style: CounterQrStyle; image: string; artwork: string } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  let url = "";
  try { url = shopMenuUrl(shopId); } catch { /* Unverified shops cannot export a sign. */ }
  const readyQr = qr?.url === url && qr.logo === withLogo && qr.style === style ? qr.image : "";
  const readyArtwork = readyQr ? qr!.artwork : "";
  const ready = !!readyArtwork && !!shopName?.trim();
  useEffect(() => {
    let current = true;
    if (!url) return;
    createCounterDesign(url, withLogo, style).then(design => { if (current) { setError(""); setQr({ url, logo: withLogo, style, image: design.qr, artwork: design.artwork }); } })
      .catch(() => { if (current) setError("The QR code could not load. Retry, or turn off the centre logo."); });
    return () => { current = false; };
  }, [url, withLogo, style, retry]);
  function download(format: "a4" | "a5") {
    if (!ready) return;
    try {
      counterSignPdf({ shopName: shopName!, url, qr: readyQr, artwork: readyArtwork, headline }, format)
        .save(`LocalEats_${shopName!.replace(/[^a-z0-9]/gi, "_")}_Counter_${format.toUpperCase()}.pdf`);
      toast.success("Counter sign downloaded. Print at actual size and test with your phone.");
    } catch { toast.error("The counter sign could not be downloaded. Please retry."); }
  }
  return <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <div className="lg:col-span-5 space-y-5">
      <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-3xl border border-outline-variant/15 space-y-5">
        <h3 className="font-extrabold text-base flex items-center gap-2"><QrCode size={20} className="text-primary" /> Your shop's counter sign</h3>
        <p className="text-sm text-on-surface-variant">Put your menu one scan away. Print a sign for the counter or shop window.</p>
        <label className="block text-sm font-bold">Choose a short invitation
          <select value={headline} onChange={e => setHeadline(e.target.value)} className="mt-2 w-full rounded-xl p-3 bg-surface-container-high text-on-surface">
            {COUNTER_HEADLINES.map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="block text-sm font-bold">QR pattern
          <select value={style} onChange={e => { setError(""); setStyle(e.target.value as CounterQrStyle); }} className="mt-2 w-full rounded-xl p-3 bg-surface-container-high text-on-surface">
            <option value="dots">Dots & rounded corners</option><option value="classic">Classic squares</option>
          </select>
        </label>
        <label className="flex items-center gap-3 min-h-[44px] text-sm font-bold"><input type="checkbox" checked={withLogo} onChange={e => { setError(""); setWithLogo(e.target.checked); }} /> LocalEats logo in the centre</label>
        <p className="text-xs text-on-surface-variant">Dark QR on white for contrast. The small logo leaves the scanning corners clear. Choose classic squares or turn off the logo if your printer struggles.</p>
        <div className="rounded-2xl bg-surface-container-low p-4 space-y-2">
          <p className="text-xs font-bold">Scan destination</p><p className="text-xs break-all select-all">{url || "Select your verified shop first."}</p>
          <button type="button" disabled={!url} onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success("Shop menu link copied."); } catch { toast.error("Copy failed. Select the link above to copy it."); } }} className="min-h-[44px] text-primary text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"><Copy size={15} /> Copy shop link</button>
        </div>
        {error && <div role="alert" className="text-sm text-error">{error} <button type="button" className="underline min-h-[44px]" onClick={() => { setError(""); setRetry(v => v + 1); }}>Retry QR</button></div>}
        <div className="grid grid-cols-2 gap-3">
          {(["a4", "a5"] as const).map(format => <button type="button" key={format} disabled={!ready} onClick={() => download(format)} className="min-h-[48px] rounded-2xl bg-primary text-on-primary text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"><Download size={16} /> {format.toUpperCase()} PDF</button>)}
        </div>
        {ready && <a href={readyArtwork} download="LocalEats-counter-sign.png" className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-outline-variant/20 text-sm font-bold"><Download size={16} /> Download framed PNG</a>}
        {ready && <a href={readyQr} download="LocalEats-shop-QR.png" className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-outline-variant/20 text-sm font-bold"><Download size={16} /> Download QR only</a>}
        <p className="text-xs text-on-surface-variant">Print the PDF at 100% / actual size. Do not shrink below A5. Keep the white border, avoid folds and glare, and scan the printed copy before displaying it. Saving a sign does not enable ordering.</p>
      </div>
    </div>
    <div className="lg:col-span-7 min-w-0">
      <p className="text-xs font-bold text-on-surface-variant mb-3 text-center">YOUR PRINT PREVIEW</p>
      <div className="mx-auto max-w-md bg-white text-slate-900 rounded-3xl border border-slate-200 overflow-hidden text-center" data-testid="counter-sign-preview">
        <div className="h-2 bg-orange-600" />
        <div className="px-5 sm:px-8 py-6 space-y-5">
          <div><p className="text-[10px] font-bold tracking-widest text-slate-500">VISIT</p><a href={CUSTOMER_ORIGIN} target="_blank" rel="noopener noreferrer" className="text-base sm:text-lg font-extrabold underline underline-offset-4 break-words">{CUSTOMER_ADDRESS}</a></div>
          <p className="text-xl font-extrabold break-words">{shopName || "Select your shop"}</p>
          <h4 className="text-3xl font-black tracking-tight text-orange-800 leading-tight">{headline}</h4>
          <p className="text-sm">Open your camera. Point. Tap the link.</p>
          {readyArtwork ? <img src={readyArtwork} alt={`LocalEats serving-dome QR: scan to browse ${shopName}'s menu`} className="w-full max-w-[360px] aspect-square mx-auto" /> : <div role="status" className="aspect-square max-w-[280px] mx-auto flex items-center justify-center bg-slate-50 text-sm">{error ? "QR unavailable" : url ? "Preparing your shop QR…" : "Shop link required"}</div>}
          <p className="font-bold text-sm">Browse the menu. Find your favourite.</p>
          <p className="font-bold text-orange-800 text-sm">Pickup only · Pay at the shop</p>
          <p className="text-xs text-slate-600">Ordering depends on your location and shop availability.</p>
          <p className="text-xs text-slate-600">Camera not scanning? Visit the website above and choose this shop.</p>

        </div>
      </div>
    </div>
  </div>;
}
