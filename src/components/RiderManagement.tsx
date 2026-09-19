import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bike, Check, Copy, Download, Megaphone, Phone, QrCode, RefreshCw, Search, Send, Share2, ShieldCheck, Star, UserPlus, Users, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { Order, Shop } from "../types";
import { MerchantApi, MerchantApiError, MerchantRiderConnection, MerchantRiderConnectionStatus, MerchantRiderPairingCode } from "../services/MerchantApi";

type RiderManagementProps = {
  currentShop: Shop;
  orders: Order[];
  onRequestRider: (id: string, riderId?: string, riderName?: string, riderPhone?: string) => void;
  sendRiderNudge: (riderId: string, message: string) => Promise<void>;
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof MerchantApiError)) return fallback;
  if (error.status === 401) return "Your session has expired. Sign in again to manage riders.";
  if (error.status === 403) return "This shop is not permitted to manage rider access.";
  if (error.status === 409) return "The rider connection changed. Refresh and try again.";
  return error.message || fallback;
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const statusLabel: Record<MerchantRiderConnectionStatus, string> = {
  pending: "Pending approval", approved: "Approved", rejected: "Rejected",
};
const statusClasses: Record<MerchantRiderConnectionStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  rejected: "bg-rose-500/10 text-rose-700 border-rose-500/20",
};

export const RiderManagement = ({ currentShop, orders, sendRiderNudge }: RiderManagementProps) => {
  const [connections, setConnections] = useState<MerchantRiderConnection[]>([]);
  const [pairingCode, setPairingCode] = useState<MerchantRiderPairingCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [issuingCode, setIssuingCode] = useState(false);
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | MerchantRiderConnectionStatus>("all");
  const [qrUrl, setQrUrl] = useState("");
  const [showPairing, setShowPairing] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);

  const loadAuthority = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const [code, riderConnections] = await Promise.all([
        MerchantApi.getRiderPairingCode(), MerchantApi.getRiderConnections(),
      ]);
      setPairingCode(code);
      setConnections(riderConnections);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to refresh rider access."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setConnections([]);
    setPairingCode(null);
    setLoading(true);
    void loadAuthority(true);
  }, [currentShop.id, loadAuthority]);

  useEffect(() => {
    const refreshOnFocus = () => void loadAuthority(true);
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [loadAuthority]);

  useEffect(() => {
    let cancelled = false;
    if (!pairingCode) { setQrUrl(""); return; }
    void import("qrcode")
      .then((QRCode) => QRCode.toDataURL(pairingCode.code, { margin: 1, scale: 8, color: { dark: "#171717", light: "#ffffff" } }))
      .then((url) => { if (!cancelled) setQrUrl(url); })
      .catch(() => { if (!cancelled) setQrUrl(""); });
    return () => { cancelled = true; };
  }, [pairingCode]);

  const issuePairingCode = async () => {
    setIssuingCode(true);
    try {
      const code = await MerchantApi.issueRiderPairingCode();
      setPairingCode(code);
      setShowPairing(true);
      toast.success("A new 24-hour pairing code is ready.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to issue a pairing code."));
    } finally { setIssuingCode(false); }
  };

  const openOrIssuePairingCode = () => {
    if (pairingCode) {
      setShowPairing(true);
      return;
    }
    void issuePairingCode();
  };

  const decideConnection = async (item: MerchantRiderConnection, decision: "approve" | "reject") => {
    const id = String(item.connection.id);
    setDecisionId(id);
    try {
      const confirmed = await MerchantApi.decideRiderConnection(id, decision);
      setConnections((current) => current.map((connection) =>
        String(connection.connection.id) === id
          ? { ...connection, connection: confirmed }
          : connection,
      ));
      toast.success(decision === "approve" ? "Rider approved." : "Rider access rejected.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update rider access."));
      setDecisionId(null);
      return;
    }

    try {
      setConnections(await MerchantApi.getRiderConnections());
    } catch {
      toast.error("Decision saved, but the rider list could not be refreshed.");
    } finally {
      setDecisionId(null);
    }
  };

  const visibleConnections = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return connections.filter(({ connection, rider }) => {
      if (filter !== "all" && connection.status !== filter) return false;
      if (!normalized) return true;
      return [rider?.full_name, rider?.phone, rider?.vehicle_type, connection.status]
        .some((value) => value?.toLowerCase().includes(normalized));
    });
  }, [connections, filter, query]);

  const approvedConnections = useMemo(
    () => connections.filter(({ connection, rider }) => connection.status === "approved" && rider), [connections],
  );
  const pendingCount = connections.filter(({ connection }) => connection.status === "pending").length;
  const onlineCount = approvedConnections.filter(({ rider }) => rider?.is_online).length;
  const activeMissions = orders.filter((order) =>
    ["finding_rider", "rider_assigned", "picked_up", "delivering"].includes(order.delivery_status ?? "") &&
    order.delivery_type !== "collection" &&
    order.order_type !== "collection" &&
    order.order_type !== "pickup");

  const exportRoster = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`${currentShop.name} rider access`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated ${new Date().toLocaleString("en-ZA")}`, 14, 25);
    autoTable(doc, {
      startY: 32,
      head: [["Rider", "Phone", "Vehicle", "Approval", "Availability", "Deliveries"]],
      body: connections.map(({ connection, rider }) => [
        rider?.full_name ?? "Profile unavailable", rider?.phone ?? "—", rider?.vehicle_type ?? "—",
        statusLabel[connection.status], rider ? (rider.is_online ? "Online" : "Offline") : "Unavailable",
        rider?.total_deliveries ?? "—",
      ]),
    });
    doc.save(`localeats-rider-access-${String(currentShop.id)}.pdf`);
  };

  const sendBroadcast = async () => {
    const message = broadcastText.trim();
    if (!message) return;
    const recipients = approvedConnections.filter(({ rider }) => rider?.is_online);
    if (recipients.length === 0) { toast.error("No approved online riders are available for this broadcast."); return; }
    setBroadcasting(true);
    try {
      await Promise.all(recipients.map(({ rider }) => sendRiderNudge(String(rider!.id), message)));
      toast.success(`Broadcast sent to ${recipients.length} approved online rider${recipients.length === 1 ? "" : "s"}.`);
      setBroadcastText("");
      setShowBroadcast(false);
    } catch { toast.error("The broadcast could not be confirmed for every rider."); }
    finally { setBroadcasting(false); }
  };

  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary"><Bike size={20} /><span className="text-xs font-black uppercase tracking-[0.18em]">Rider network</span></div>
            <h1 className="text-2xl font-black text-on-surface sm:text-3xl">Merchant-approved rider access</h1>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">Drivers register in the Rider App, request access with your 24-hour code, and wait for your approval.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadAuthority()} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-outline-variant/30 px-4 text-sm font-bold hover:bg-on-surface/5 disabled:opacity-50"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />Refresh</button>
            <button type="button" onClick={openOrIssuePairingCode} disabled={issuingCode} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-on-primary shadow-lg shadow-primary/20 disabled:opacity-50"><QrCode size={17} />{issuingCode ? "Issuing…" : pairingCode ? "View pairing code" : "Pair a driver"}</button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["All requests", connections.length, Users], ["Pending review", pendingCount, UserPlus], ["Approved riders", approvedConnections.length, ShieldCheck], ["Online now", onlineCount, Bike]].map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{String(label)}</span><Icon size={18} className="text-primary" /></div><p className="mt-2 text-3xl font-black text-on-surface">{String(value)}</p></div>
        ))}
      </section>

      <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div><h2 className="text-lg font-black text-on-surface">Rider access requests</h2><p className="text-xs text-on-surface-variant">Approval controls future mission access. Availability is controlled by each rider.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowBroadcast(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline-variant/20 px-3 text-xs font-bold hover:bg-on-surface/5"><Megaphone size={15} />Broadcast</button>
            <button type="button" onClick={exportRoster} disabled={connections.length === 0} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline-variant/20 px-3 text-xs font-bold hover:bg-on-surface/5 disabled:opacity-40"><Download size={15} />Export PDF</button>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface px-3"><Search size={16} className="text-on-surface-variant" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rider, phone, vehicle…" className="w-full bg-transparent text-sm outline-none" /></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="min-h-11 rounded-xl border border-outline-variant/20 bg-surface px-3 text-sm font-bold"><option value="all">All decisions</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
        </div>
        <div className="mt-5 space-y-3">
          {loading ? <div className="py-12 text-center text-sm text-on-surface-variant">Loading rider access…</div> : visibleConnections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/30 py-12 text-center"><Users size={28} className="mx-auto mb-3 text-on-surface-variant/50" /><p className="font-bold text-on-surface">No matching rider requests</p><p className="mt-1 text-xs text-on-surface-variant">Drivers must register in the Rider App and submit your pairing code.</p></div>
          ) : visibleConnections.map((item) => {
            const { connection, rider } = item;
            const busy = decisionId === String(connection.id);
            return <article key={String(connection.id)} className="rounded-2xl border border-outline-variant/15 bg-surface p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-black text-primary">{(rider?.full_name?.trim().charAt(0) || "R").toUpperCase()}</div><div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black text-on-surface">{rider?.full_name || "Rider profile unavailable"}</h3><span className={cn("rounded-full border px-2 py-1 text-[10px] font-black uppercase", statusClasses[connection.status])}>{statusLabel[connection.status]}</span>{rider && <span className={cn("rounded-full px-2 py-1 text-[10px] font-bold", rider.is_online ? "bg-emerald-500/10 text-emerald-700" : "bg-zinc-500/10 text-zinc-600")}>{rider.is_online ? "Online" : "Offline"}</span>}</div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">{rider?.phone && <span className="inline-flex items-center gap-1"><Phone size={12} />{rider.phone}</span>}{rider?.vehicle_type && <span>{rider.vehicle_type}</span>}{rider?.rating !== null && rider?.rating !== undefined && <span className="inline-flex items-center gap-1"><Star size={12} />{rider.rating.toFixed(1)}</span>}{rider && <span>{rider.total_deliveries} deliveries</span>}<span>Requested {formatDateTime(connection.created_at)}</span></div>
                </div></div>
                <div className="flex flex-wrap gap-2 lg:justify-end">{connection.status !== "approved" && <button type="button" disabled={busy} onClick={() => void decideConnection(item, "approve")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-50"><Check size={14} />Approve</button>}{connection.status !== "rejected" && <button type="button" disabled={busy} onClick={() => void decideConnection(item, "reject")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-rose-500/30 px-3 text-xs font-black text-rose-700 hover:bg-rose-500/10 disabled:opacity-50"><X size={14} />{connection.status === "approved" ? "Revoke" : "Reject"}</button>}</div>
              </div>
            </article>;
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-5 sm:p-6">
        <h2 className="text-lg font-black text-on-surface">Current delivery missions</h2><p className="mt-1 text-xs text-on-surface-variant">Riders claim eligible delivery missions through the Rider App. Merchant Rider Management does not assign them directly.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">{activeMissions.length === 0 ? <p className="text-sm text-on-surface-variant">No active delivery missions.</p> : activeMissions.slice(0, 8).map((order) => <div key={order.id} className="rounded-2xl border border-outline-variant/15 bg-surface p-4"><div className="flex items-center justify-between gap-3"><p className="font-black text-on-surface">Order #{order.id}</p><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black uppercase text-primary">{order.delivery_status || order.status}</span></div><p className="mt-2 text-xs text-on-surface-variant">{order.customer_name} · {order.address}</p></div>)}</div>
      </section>

      <AnimatePresence>{showPairing && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={() => setShowPairing(false)}><motion.div initial={{ scale: 0.96, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 15 }} onClick={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-2xl">
        <div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Pair a driver</h2><p className="text-xs text-on-surface-variant">Valid for 24 hours; submitting it creates a pending request.</p></div><button type="button" onClick={() => setShowPairing(false)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-on-surface/5"><X size={18} /></button></div>
        {pairingCode ? <div className="mt-6 space-y-5"><div className="rounded-2xl border border-primary/20 bg-surface p-5 text-center"><p className="text-4xl font-black tracking-[0.22em] text-primary sm:text-5xl">{pairingCode.code}</p><p className="mt-3 text-xs text-on-surface-variant">Expires {formatDateTime(pairingCode.expires_at)}</p></div><div className="flex flex-col items-center gap-4 rounded-2xl bg-on-surface/5 p-4 sm:flex-row">{qrUrl ? <img src={qrUrl} alt="Rider pairing QR code" className="h-28 w-28 rounded-xl bg-white p-1" /> : <div className="flex h-28 w-28 items-center justify-center rounded-xl bg-white text-xs text-zinc-600">QR unavailable</div>}<div className="flex-1 text-center sm:text-left"><p className="text-sm font-bold">Drivers register in the Rider App, then pair with this shop using the code.</p><div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start"><button type="button" onClick={() => void navigator.clipboard.writeText(pairingCode.code).then(() => toast.success("Pairing code copied."))} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline-variant/20 px-3 text-xs font-bold"><Copy size={14} />Copy</button><a href={`https://wa.me/?text=${encodeURIComponent(`Use LocalEats Rider App to request access to ${currentShop.name}. Pairing code: ${pairingCode.code}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white"><Share2 size={14} />WhatsApp</a></div></div></div><button type="button" onClick={() => void issuePairingCode()} disabled={issuingCode} className="min-h-11 w-full rounded-xl border border-primary/30 font-black text-primary hover:bg-primary/5 disabled:opacity-50">{issuingCode ? "Issuing…" : "Invalidate and generate a new code"}</button></div> : <p className="mt-6 text-sm text-on-surface-variant">No active pairing code.</p>}
      </motion.div></motion.div>}</AnimatePresence>

      <AnimatePresence>{showBroadcast && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={() => setShowBroadcast(false)}><motion.div initial={{ scale: 0.96, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 15 }} onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Fleet broadcast</h2><p className="text-xs text-on-surface-variant">Approved online riders only</p></div><button type="button" onClick={() => setShowBroadcast(false)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-on-surface/5"><X size={18} /></button></div><textarea rows={4} value={broadcastText} onChange={(event) => setBroadcastText(event.target.value)} placeholder="Write a short operational message…" className="mt-5 w-full rounded-xl border border-outline-variant/20 bg-surface p-3 text-sm outline-none focus:border-primary" /><button type="button" onClick={() => void sendBroadcast()} disabled={broadcasting || !broadcastText.trim()} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-black text-on-primary disabled:opacity-50"><Send size={16} />{broadcasting ? "Sending…" : "Send broadcast"}</button></motion.div></motion.div>}</AnimatePresence>
    </div>
  );
};

export default RiderManagement;
