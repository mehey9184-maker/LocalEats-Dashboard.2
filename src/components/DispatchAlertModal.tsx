import React, { useState, useCallback } from "react";
import { MessageCircle, Copy, Share2, Phone, X, Check, ShieldCheck, Sparkles, AlertCircle, QrCode, BookmarkPlus, ListOrdered, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Order, Shop } from "../types";
import { merchantOrderMoney } from "../services/merchantOrdersTrust";

export interface DispatchAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: Order | null;
  riderName?: string;
  riderPhone?: string;
  connectionCode?: string;
  currentShop: Shop | undefined;
  type?: "rider_dispatch" | "customer_status" | "rider_pairing";
}

export interface QueuedAlert {
  id: string;
  recipientPhone: string;
  recipientName: string;
  recipientType: "rider" | "customer" | "custom";
  messageText: string;
  createdAt: string;
  orderId?: string;
}

// Utility to sanitize and format phone numbers for wa.me and sms: URIs
function formatPhoneForMessaging(phoneStr?: string): { raw: string; cleanDigits: string; isSA: boolean } {
  if (!phoneStr) return { raw: "", cleanDigits: "", isSA: false };
  const raw = phoneStr.trim();
  const digits = raw.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    const clean = digits.replace("+", "");
    return { raw, cleanDigits: clean, isSA: clean.startsWith("27") };
  }

  if (digits.startsWith("0") && digits.length === 10) {
    const clean = "27" + digits.slice(1);
    return { raw, cleanDigits: clean, isSA: true };
  }

  return { raw, cleanDigits: digits, isSA: digits.startsWith("27") };
}

// Unsent drafts live only in this mounted tab. No automatic dispatch or persistent storage.
export const DispatchAlertModal: React.FC<DispatchAlertModalProps> = ({
  isOpen,
  onClose,
  order,
  riderName = "Rider",
  riderPhone = "",
  connectionCode = "",
  currentShop,
  type = "rider_dispatch",
}) => {
  const [activeTab, setActiveTab] = useState<"composer" | "qr" | "queue">("composer");
  const [recipientType, setRecipientType] = useState<"rider" | "customer" | "custom">(
    type === "customer_status" ? "customer" : type === "rider_pairing" ? "rider" : "rider"
  );
  const [customPhone, setCustomPhone] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [queuedAlerts, setQueuedAlerts] = useState<QueuedAlert[]>([]);

  // Target phone determination
  const targetPhoneRaw =
    recipientType === "rider"
      ? riderPhone || order?.rider_phone || ""
      : recipientType === "customer"
      ? order?.phone || ""
      : customPhone;

  const formattedTarget = formatPhoneForMessaging(targetPhoneRaw);

  // Helper to generate template message
  const generateTemplateText = useCallback(
    (currentRecipient: "rider" | "customer" | "custom") => {
      const shopName = currentShop?.name || "LocalEats Merchant";
      const orderId = order?.id ? String(order.id).slice(-6) : "Unavailable";
      const amount = order ? merchantOrderMoney(order.total_price) : "Total unavailable";
      const itemsSummary = Array.isArray(order?.items)
        ? order.items.map((i: Record<string, unknown> | string) => typeof i === "string" ? i : `${(i as { quantity?: number; name?: string })?.quantity || 1}x ${(i as { quantity?: number; name?: string })?.name || "Item"}`).join(", ")
        : "Standard Meal Order";

      if (type === "rider_pairing" || (currentRecipient === "rider" && connectionCode)) {
        if (!connectionCode) return "No verified pairing code is available. Open Rider pairing to obtain one.";
        return `LocalEats rider pairing invitation\nShop: ${shopName}\nPairing code: ${connectionCode}\nUse this code only in the official Rider app. This message does not assign a delivery.`;
      }
      if (currentRecipient === "rider") {
        return `LocalEats delivery update from ${shopName}\nOrder reference: #${orderId}\nPlease check your authorized assignments in the Rider app. This message does not assign an order or disclose customer information.`;
      }
      const recordedStatus = String(order?.status || "Unavailable").replaceAll("_", " ");
      const recordedDelivery = order?.delivery_status ? `\nRecorded delivery status: ${String(order.delivery_status).replaceAll("_", " ")}` : "";
      // User-editable messages must not invent payment status, rider movement or ETA.
      return `LocalEats order update — ${shopName}\nOrder #${orderId}\nRecorded order status: ${recordedStatus}${recordedDelivery}\nItems: ${itemsSummary}\nRecorded order total: ${amount}\nPlease check the LocalEats app for the latest confirmed order information.`;
    },
    [currentShop, order, type, connectionCode]
  );

  const [messageText, setMessageText] = useState<string>(() => generateTemplateText(recipientType));

  // Sync recipient type switch handler
  const handleSelectRecipient = (newType: "rider" | "customer" | "custom") => {
    setRecipientType(newType);
    setMessageText(generateTemplateText(newType));
  };

  if (!isOpen) return null;

  const handleOpenWhatsApp = () => {
    if (!/^\d{8,15}$/.test(formattedTarget.cleanDigits)) {
      toast.error("Please enter a valid target phone number first.");
      return;
    }
    const encoded = encodeURIComponent(messageText);
    const url = `https://wa.me/${formattedTarget.cleanDigits}?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success(`Opening WhatsApp Chat with +${formattedTarget.cleanDigits}...`);
    onClose();
  };

  const handleSendSMS = () => {
    if (!/^\d{8,15}$/.test(formattedTarget.cleanDigits)) {
      toast.error("Please enter a valid target phone number first.");
      return;
    }
    const encoded = encodeURIComponent(messageText);
    const url = `sms:+${formattedTarget.cleanDigits}?body=${encoded}`;
    window.location.href = url;
    toast.success(`Opening SMS composer for +${formattedTarget.cleanDigits}...`);
    onClose();
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `LocalEats Dispatch - Order #${order?.id ? String(order.id).slice(-6) : ""}`,
          text: messageText,
        });
        toast.info("Share sheet completed; delivery is not confirmed here.");
        onClose();
      } catch (err) {
        console.warn("Native share canceled/failed:", err);
      }
    } else {
      handleCopyText();
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      toast.info("Message text copied. Nothing was sent.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Clipboard unavailable. Copy the draft text manually.");
    }
  };

  const handleSaveToOfflineQueue = () => {
    const newAlert: QueuedAlert = {
      id: "ALERT-" + Date.now(),
      recipientPhone: targetPhoneRaw,
      recipientName: recipientType === "rider" ? riderName : order?.customer_name || "Customer",
      recipientType,
      messageText,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      orderId: order?.id ? String(order.id) : undefined,
    };
    const updated = [newAlert, ...queuedAlerts];
    setQueuedAlerts(updated);
    toast.info("Draft saved in this tab only. Nothing has been sent.");
  };

  const handleRemoveQueued = (id: string) => {
    const updated = queuedAlerts.filter((q) => q.id !== id);
    setQueuedAlerts(updated);
    toast.info("Draft removed.");
  };

  const handleClearQueue = () => {
    setQueuedAlerts([]);
    toast.info("Saved drafts cleared.");
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest dark:bg-zinc-900 border border-outline-variant/20 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center font-bold text-xl shadow-inner">
              💬
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight flex items-center gap-2">
                <span>SMS & WhatsApp Dispatch Studio</span>
                <span className="bg-emerald-400/30 text-white text-[10px] uppercase font-black px-2 py-0.5 rounded-full border border-white/20">
                  Manual share
                </span>
              </h3>
              <p className="text-xs text-emerald-100/90 font-medium">
                Opens a messaging app; review and send the message yourself.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation Controls */}
        <div className="grid grid-cols-3 bg-surface-container-low border-b border-outline-variant/15 p-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("composer")}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "composer"
                ? "bg-surface-container-lowest text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Sparkles size={14} />
            <span>Composer</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("qr")}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "qr"
                ? "bg-surface-container-lowest text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <QrCode size={14} />
            <span>On-Screen QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
              activeTab === "queue"
                ? "bg-surface-container-lowest text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <ListOrdered size={14} />
            <span>Drafts</span>
            {queuedAlerts.length > 0 && (
              <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                {queuedAlerts.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {activeTab === "composer" && (
            <>
              {/* Zero-Paid-API Informational Badge */}
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5 text-xs">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-snug font-medium">
                  <strong className="font-bold">Manual messages:</strong> Launches WhatsApp Web / App or native SMS directly on your phone or desktop. Nothing is sent automatically. SMS charges may apply.
                </p>
              </div>

              {/* Recipient Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  Send Alert To:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectRecipient("rider")}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      recipientType === "rider"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-surface-container/50 border-outline-variant/15 text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    <span>🛵 Assigned Rider</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRecipient("customer")}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      recipientType === "customer"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-surface-container/50 border-outline-variant/15 text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    <span>👤 Customer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRecipient("custom")}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      recipientType === "custom"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-surface-container/50 border-outline-variant/15 text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    <span>📞 Custom Number</span>
                  </button>
                </div>
              </div>

              {/* Phone Number Field */}
              {recipientType === "custom" ? (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface flex items-center gap-1">
                    <span>Enter Phone Number (e.g. 082 123 4567 or +27...)</span>
                  </label>
                  <input
                    type="tel"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="+27 82 000 0000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-low border border-outline-variant/15 text-xs">
                  <div>
                    <span className="text-on-surface-variant font-medium">Recipient Number: </span>
                    <span className="font-extrabold text-on-surface font-mono">
                      {targetPhoneRaw || "No phone number attached"}
                    </span>
                  </div>
                  {formattedTarget.cleanDigits && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      +{formattedTarget.cleanDigits}
                    </span>
                  )}
                </div>
              )}

              {!formattedTarget.cleanDigits && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>Warning: Recipient has no phone number attached. Please enter a custom number.</span>
                </div>
              )}

              <p className="text-[11px] text-on-surface-variant" role="note">
                Template wording reflects recorded order status only. Review and edit it before sending.
              </p>

              {/* Live Message Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={13} className="text-emerald-600" />
                    <span>Message Preview & Live Editor</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copied ? "Copied!" : "Copy Text"}</span>
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-xs font-mono text-on-surface leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-none resize-none shadow-inner"
                />
              </div>
            </>
          )}

          {activeTab === "qr" && (
            <div className="p-6 text-center space-y-2 bg-surface-container-low rounded-2xl" role="status">
              <p className="text-sm font-bold text-on-surface">QR sharing unavailable in this Preview</p>
              <p className="text-xs text-on-surface-variant">A third-party QR generator would receive the recipient number and message. Use the manual WhatsApp or SMS buttons instead.</p>
            </div>
          )}

          {activeTab === "queue" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-on-surface uppercase tracking-wider">
                  Saved Drafts (not sent) ({queuedAlerts.length})
                </h4>
                {queuedAlerts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearQueue}
                    className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Clear Drafts</span>
                  </button>
                )}
              </div>

              {queuedAlerts.length === 0 ? (
                <div className="p-8 text-center bg-surface-container-low rounded-2xl border border-outline-variant/15 text-xs text-on-surface-variant/70 space-y-2">
                  <BookmarkPlus size={28} className="mx-auto opacity-40 text-emerald-600" />
                  <p className="font-bold text-on-surface">No saved drafts in this tab.</p>
                  <p className="text-[11px]">
                    Use "Save Draft" to keep a message while this tab is open. Drafts are never sent automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {queuedAlerts.map((item) => {
                    const clean = formatPhoneForMessaging(item.recipientPhone).cleanDigits;
                    const waUrl = /^\d{8,15}$/.test(clean) ? `https://wa.me/${clean}?text=${encodeURIComponent(item.messageText)}` : "";
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/15 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-on-surface font-extrabold">
                            {item.recipientName} ({item.recipientType})
                          </span>
                          <span className="text-[10px] text-on-surface-variant font-mono">{item.createdAt}</span>
                        </div>
                        <p className="text-[11px] font-mono line-clamp-2 text-on-surface-variant/90 bg-surface-container/50 p-2 rounded-xl">
                          {item.messageText}
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveQueued(item.id)}
                            className="text-[10px] font-bold text-rose-600 hover:underline"
                          >
                            Remove
                          </button>
                          {waUrl ? (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => toast.info("WhatsApp opened; delivery is not confirmed here.")}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] flex items-center gap-1 shadow-xs"
                            >
                              <MessageCircle size={12} className="fill-current" />
                              <span>Open WhatsApp Draft</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-amber-600 font-bold">No Phone</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Buttons */}
        <div className="p-4 sm:p-5 bg-surface-container-low border-t border-outline-variant/15 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-2.5 rounded-xl border border-outline-variant/20 hover:bg-surface-container text-xs font-bold flex items-center gap-1.5 cursor-pointer text-on-surface"
              title="Copy plain-text to clipboard"
            >
              <Copy size={14} />
              <span>Copy</span>
            </button>

            <button
              type="button"
              onClick={handleSaveToOfflineQueue}
              className="px-3 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer text-emerald-800 dark:text-emerald-300"
              title="Save an unsent draft while this tab is open"
            >
              <BookmarkPlus size={14} />
              <span>Save Draft</span>
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {"share" in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="px-3.5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-extrabold flex items-center gap-1.5 cursor-pointer border border-outline-variant/20 transition-transform active:scale-95"
              >
                <Share2 size={14} />
                <span>Share</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSendSMS}
              className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md transition-transform active:scale-95"
            >
              <Phone size={14} />
              <span>SMS</span>
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/20 transition-transform active:scale-95"
            >
              <MessageCircle size={15} className="fill-current" />
              <span>Open WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

