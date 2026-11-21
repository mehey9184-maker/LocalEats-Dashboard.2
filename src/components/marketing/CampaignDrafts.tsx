import React, { useMemo, useState } from "react";
import { Copy, FileText, Save } from "lucide-react";
import { toast } from "sonner";
import type { Shop, MenuItem } from "../../types";
import { menuSpotlight } from "./campaignDraft";

type Draft = { text: string; savedAt: string };
export function CampaignBuilder({ activeShop, storeMenuItems, storeUrl }: { activeShop?: Shop; storeMenuItems: MenuItem[]; storeUrl: string }) {
  const items = useMemo(() => storeMenuItems.filter(item => activeShop && String(item.shop_id) === String(activeShop.id) && item.is_available !== false && Number.isFinite(Number(item.price)) && Number(item.price) >= 0), [activeShop, storeMenuItems]);
  const [itemId, setItemId] = useState("");
  const [edited, setEdited] = useState<string | null>(null);
  const key = activeShop ? `localeats_marketing_drafts_v1_${activeShop.id}` : "";
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    try { const stored = key ? JSON.parse(localStorage.getItem(key) || "[]") : []; return Array.isArray(stored) ? stored.filter(d => typeof d.text === "string" && d.text.length <= 1200 && typeof d.savedAt === "string").slice(0, 20) : []; } catch { return []; }
  });
  const item = items.find(row => String(row.id) === itemId);
  let generated = "";
  if (activeShop) { try { generated = menuSpotlight(activeShop.name, storeUrl, item); } catch { /* No draft for an invalid shop link. */ } }
  const message = edited ?? generated;
  async function copy() {
    try { await navigator.clipboard.writeText(message); toast.success("Draft copied. Review it before sharing."); }
    catch { toast.error("Could not copy. Select the message to copy it manually."); }
  }
  function save() {
    if (!key || !generated || !message.trim()) return;
    const next = [{ text: message.trim(), savedAt: new Date().toISOString() }, ...drafts].slice(0, 20);
    try { localStorage.setItem(key, JSON.stringify(next)); setDrafts(next); toast.success("Draft saved on this device. Nothing was published or sent."); }
    catch { toast.error("This device could not save the draft. Copy it instead."); }
  }
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5 sm:p-6 space-y-5">
      <h3 className="font-extrabold text-lg flex items-center gap-2"><FileText size={20} className="text-primary" /> Menu message drafts</h3>
      <p className="text-sm text-on-surface-variant">Start with a real menu item. Keep it short, review the price, and share it yourself.</p>
      <div role="note" className="rounded-2xl bg-primary/5 border border-primary/20 p-4 text-sm">Draft only. Discounts, timed offers and customer campaigns are not activated here. Saving does not send a notification or change checkout prices.</div>
      <label className="block text-sm font-bold">Spotlight an item
        <select value={itemId} onChange={e => { setItemId(e.target.value); setEdited(null); }} className="mt-2 w-full rounded-xl p-3 bg-surface-container-high">
          <option value="">Share the shop menu</option>{items.map(row => <option key={row.id} value={String(row.id)}>{row.name} · R{Number(row.price).toFixed(2)}</option>)}
        </select>
      </label>
      <label className="block text-sm font-bold">Your message
        <textarea value={message} maxLength={1200} rows={7} onChange={e => setEdited(e.target.value)} disabled={!generated} className="mt-2 w-full rounded-2xl p-4 bg-surface-container-high font-normal text-sm" />
      </label>
      <p className="text-xs text-on-surface-variant">Use current prices and genuine offers only. Customer order contact details do not establish promotional permission. SMS or mobile data charges may apply when you share through another app.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!generated || !message.trim()} onClick={copy} className="min-h-[48px] px-5 rounded-2xl bg-primary text-on-primary font-bold text-sm flex items-center gap-2 disabled:opacity-50"><Copy size={16} /> Copy message</button>
        <button type="button" disabled={!generated || !message.trim()} onClick={save} className="min-h-[48px] px-5 rounded-2xl border border-outline-variant/20 font-bold text-sm flex items-center gap-2 disabled:opacity-50"><Save size={16} /> Save draft</button>
      </div>
    </div>
    <div className="space-y-4 min-w-0"><h3 className="font-extrabold">Saved on this device</h3><p className="text-xs text-on-surface-variant">These drafts are private to this browser. They are not active customer offers.</p>
      {!drafts.length && <p className="text-sm text-on-surface-variant p-5 border border-dashed border-outline-variant/30 rounded-2xl">Your saved messages will appear here.</p>}
      {drafts.map((draft, index) => <div key={`${draft.savedAt}-${index}`} className="rounded-2xl border border-outline-variant/15 p-4 space-y-3"><span className="text-xs font-bold text-primary">DRAFT · NOT PUBLISHED</span><p className="whitespace-pre-wrap break-words text-sm">{draft.text}</p><button type="button" onClick={() => setEdited(draft.text)} className="min-h-[44px] underline text-sm font-bold">Edit this draft</button></div>)}
    </div>
  </div>;
}
