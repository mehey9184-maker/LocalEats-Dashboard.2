import React, { useState, useCallback } from "react";
import { MessageCircle, Copy, Share2, Phone, X, Check, ShieldCheck, Sparkles, AlertCircle, QrCode, BookmarkPlus, ListOrdered, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Order, Shop } from "../types";

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

// LocalStorage Helper for Dispatch Alert Offline Queue
function getQueuedAlerts(): QueuedAlert[] {
  try {
    const raw = localStorage.getItem("localeats_queued_dispatch_alerts");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueuedAlerts(alerts: QueuedAlert[]) {
  try {
    localStorage.setItem("localeats_queued_dispatch_alerts", JSON.stringify(alerts));
  } catch (e) {
    console.warn("Failed to persist dispatch queue:", e);
  }
}

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
  const [activeTemplate, setActiveTemplate] = useState<string>("default");
  const [copied, setCopied] = useState<boolean>(false);
  const [queuedAlerts, setQueuedAlerts] = useState<QueuedAlert[]>(getQueuedAlerts);

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
    (
      currentRecipient: "rider" | "customer" | "custom",
      tpl: string
    ) => {
      const shopName = currentShop?.name || "LocalEats Merchant";
      const shopPhone = currentShop?.phone || currentShop?.whatsapp || "";
      const orderId = order?.id ? String(order.id).slice(-6) : "1001";
      const customerName = order?.customer_name || "Valued Customer";
      const address = order?.address || "Address provided in app";
      const amount = order?.total_amount ? order.total_amount.toFixed(2) : "0.00";
      const paymentMethod = order?.payment_method?.toUpperCase() || "CASH";
      const itemsSummary = order?.items
        ? order.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")
        : "Standard Meal Order";

      let mapsUrl = "";
      if (order?.lat && order?.lng) {
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lng}`;
      }

      if (type === "rider_pairing" || (currentRecipient === "rider" && connectionCode)) {
        const code = connectionCode || "123456";
        const pairingUrl = `${window.location.origin}/rider/pair?code=${code}&shop=${currentShop?.id || ""}`;
        return (
          `🚨 *LocalEats Rider Fleet Invitation*\n` +
          `Shop: *${shopName}*\n` +
          `Pairing Code: *${code}*\n\n` +
          `Enter this 6-digit code in your LocalEats Rider app to accept dispatch missions!\n` +
          `Direct Link: ${pairingUrl}`
        );
      }

      if (currentRecipient === "rider") {
        const landmarkNotes = order?.notes ? `🏡 Landmark / Local Directions: *${order.notes}*\n` : "";
        return (
          `🛵 *NEW DELIVERY MISSION - ${shopName.toUpperCase()}*\n\n` +
          `Order ID: *#${orderId}*\n` +
          `Customer: *${customerName}* (${order?.phone || "No phone"})\n` +
          `Delivery Address: *${address}*\n` +
          landmarkNotes +
          `Items: ${itemsSummary}\n` +
          `Total to Collect: *R${amount}* (${paymentMethod})\n` +
          (mapsUrl ? `📍 Navigation Pin: ${mapsUrl}\n\n` : "\n") +
          `Please confirm acceptance in your Rider App when en route!`
        );
      } else if (currentRecipient === "customer") {
        if (tpl === "ready_pickup") {
          return (
            `📦 *ORDER READY FOR PICKUP - ${shopName.toUpperCase()}*\n\n` +
            `Hi ${customerName}! Your order *#${orderId}* is hot and ready for pickup.\n` +
            `Items: ${itemsSummary}\n` +
            `Shop Location: ${currentShop?.address || "Local Merchant Hub"}\n` +
            `Phone: ${shopPhone}\n\n` +
            `Thank you for supporting local business!`
          );
        } else if (tpl === "out_for_delivery") {
          return (
            `🛵 *ORDER OUT FOR DELIVERY - ${shopName.toUpperCase()}*\n\n` +
            `Hi ${customerName}! Order *#${orderId}* is on its way with our driver *${riderName}*.\n` +
            `Rider Phone: ${riderPhone || "Contact via app"}\n` +
            `Delivery Address: ${address}\n` +
            `Total: R${amount} (${paymentMethod})\n\n` +
            `Please ensure someone is available at the door!`
          );
        } else {
          return (
            `🍳 *ORDER ACCEPTED & PREPARING - ${shopName.toUpperCase()}*\n\n` +
            `Hi ${customerName}! Order *#${orderId}* has been accepted and is currently being prepared.\n` +
            `Items: ${itemsSummary}\n` +
            `Estimated ETA: ~${order?.estimated_delivery_time || "25-35"} mins\n\n` +
            `Questions? Reply to this message or call ${shopPhone}.`
          );
        }
      } else {
        return (
          `📢 *LocalEats Order Update - ${shopName}*\n` +
          `Order #${orderId} status: ${order?.status || "Processing"}\n` +
          `Total: R${amount}`
        );
      }
    },
    [currentShop, order, type, connectionCode, riderName, riderPhone]
  );

  const [messageText, setMessageText] = useState<string>(() => generateTemplateText(recipientType, activeTemplate));

  // Sync recipient type switch handler
  const handleSelectRecipient = (newType: "rider" | "customer" | "custom") => {
    setRecipientType(newType);
    setMessageText(generateTemplateText(newType, activeTemplate));
  };

  // Sync template switch handler
  const handleSelectTemplate = (tpl: string) => {
    setActiveTemplate(tpl);
    setMessageText(generateTemplateText(recipientType, tpl));
  };

  if (!isOpen) return null;

  const directWhatsAppUrl = formattedTarget.cleanDigits
    ? `https://wa.me/${formattedTarget.cleanDigits}?text=${encodeURIComponent(messageText)}`
    : "";

  const handleOpenWhatsApp = () => {
    if (!formattedTarget.cleanDigits) {
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
    if (!formattedTarget.cleanDigits) {
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
        toast.success("Message dispatched via Native Share!");
        onClose();
      } catch (err) {
        console.warn("Native share canceled/failed:", err);
      }
    } else {
      handleCopyText();
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    toast.success("Dispatch message copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
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
    saveQueuedAlerts(updated);
    toast.success("Saved to Dispatch Queue for later execution!");
  };

  const handleRemoveQueued = (id: string) => {
    const updated = queuedAlerts.filter((q) => q.id !== id);
    setQueuedAlerts(updated);
    saveQueuedAlerts(updated);
    toast.info("Alert removed from queue.");
  };

  const handleClearQueue = () => {
    setQueuedAlerts([]);
    saveQueuedAlerts([]);
    toast.info("Dispatch queue cleared.");
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
                  Zero Cost
                </span>
              </h3>
              <p className="text-xs text-emerald-100/90 font-medium">
                Direct native dispatch without paid API subscriptions
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
            <span>Queue</span>
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
                  <strong className="font-bold">No API Key Required:</strong> Launches WhatsApp Web / App or native SMS directly on your phone or desktop. Always 100% free and instant.
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

              {/* Customer Preset Selector */}
              {recipientType === "customer" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    Status Alert Preset:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectTemplate("default")}
                      className={`px-2.5 py-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        activeTemplate === "default"
                          ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                          : "bg-surface-container/40 border-outline-variant/10 text-on-surface-variant"
                      }`}
                    >
                      🍳 Preparing
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectTemplate("out_for_delivery")}
                      className={`px-2.5 py-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        activeTemplate === "out_for_delivery"
                          ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                          : "bg-surface-container/40 border-outline-variant/10 text-on-surface-variant"
                      }`}
                    >
                      🛵 En Route
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectTemplate("ready_pickup")}
                      className={`px-2.5 py-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        activeTemplate === "ready_pickup"
                          ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                          : "bg-surface-container/40 border-outline-variant/10 text-on-surface-variant"
                      }`}
                    >
                      📦 Ready Pickup
                    </button>
                  </div>
                </div>
              )}

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
            <div className="flex flex-col items-center justify-center p-4 text-center space-y-4">
              <div className="p-3 bg-white rounded-3xl border-2 border-emerald-500/30 shadow-xl">
                {directWhatsAppUrl ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                      directWhatsAppUrl
                    )}`}
                    alt="Scan for Direct WhatsApp Dispatch"
                    className="w-52 h-52 object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-xs text-amber-600 font-bold p-4 bg-amber-50 rounded-xl">
                    Please provide a valid recipient phone number in the Composer tab to generate QR.
                  </div>
                )}
              </div>
              <div className="space-y-1 max-w-xs">
                <h4 className="font-extrabold text-sm text-on-surface">Scan & Dispatch via Camera</h4>
                <p className="text-xs text-on-surface-variant leading-snug">
                  Customer or driver present at counter? Scan this QR code with any smartphone camera to launch the WhatsApp chat instantly.
                </p>
              </div>
              {directWhatsAppUrl && (
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="px-4 py-2 rounded-xl bg-surface-container-high border border-outline-variant/20 text-xs font-bold text-on-surface hover:bg-surface-container-highest cursor-pointer flex items-center gap-1.5"
                >
                  <Copy size={14} />
                  <span>Copy Direct WhatsApp Link</span>
                </button>
              )}
            </div>
          )}

          {activeTab === "queue" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-on-surface uppercase tracking-wider">
                  Pending Offline Alerts Queue ({queuedAlerts.length})
                </h4>
                {queuedAlerts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearQueue}
                    className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Clear Queue</span>
                  </button>
                )}
              </div>

              {queuedAlerts.length === 0 ? (
                <div className="p-8 text-center bg-surface-container-low rounded-2xl border border-outline-variant/15 text-xs text-on-surface-variant/70 space-y-2">
                  <BookmarkPlus size={28} className="mx-auto opacity-40 text-emerald-600" />
                  <p className="font-bold text-on-surface">No queued alerts right now.</p>
                  <p className="text-[11px]">
                    Use the "Queue Alert" button in the composer to store dispatch alerts for offline processing or batch execution.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {queuedAlerts.map((item) => {
                    const clean = formatPhoneForMessaging(item.recipientPhone).cleanDigits;
                    const waUrl = clean ? `https://wa.me/${clean}?text=${encodeURIComponent(item.messageText)}` : "";
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
                              onClick={() => handleRemoveQueued(item.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] flex items-center gap-1 shadow-xs"
                            >
                              <MessageCircle size={12} className="fill-current" />
                              <span>Dispatch WhatsApp Now</span>
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
              title="Queue alert for offline/later dispatching"
            >
              <BookmarkPlus size={14} />
              <span>Queue Alert</span>
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

