import QRCode from "qrcode";
import { jsPDF } from "jspdf";

export const CUSTOMER_ORIGIN = "https://www.localeatssa.co.za";
export const CUSTOMER_ADDRESS = "www.localeatssa.co.za";
export const COUNTER_HEADLINES = ["Hungry? Scan the menu.", "Your next bite starts here.", "Local flavour. One scan away."];
export const QR_OPTIONS = { errorCorrectionLevel: "H" as const, margin: 4, scale: 16,
  color: { dark: "#0F172A", light: "#FFFFFF" } };

export function shopMenuUrl(id: string | number | null | undefined): string {
  if (id === null || id === undefined || !String(id).trim()) throw new Error("Select your verified shop first.");
  const url = new URL(CUSTOMER_ORIGIN);
  url.searchParams.set("shopId", String(id));
  return url.href;
}

export function validateMenuUrl(value: string): string {
  const url = new URL(value);
  if (url.origin !== CUSTOMER_ORIGIN || url.pathname !== "/" || !url.searchParams.get("shopId")?.trim() || url.searchParams.getAll("shopId").length !== 1
    || [...url.searchParams.keys()].some(key => key !== "shopId") || url.hash || url.username || url.password) {
    throw new Error("A verified LocalEats shop menu link is required.");
  }
  return url.href;
}

export function centreLogoBox(size: number) {
  // Small centre mark; the finder patterns and four-module quiet zone remain untouched.
  const outer = Math.floor(size * 0.16), inset = Math.ceil(size * 0.016);
  return { left: Math.floor((size - outer) / 2), top: Math.floor((size - outer) / 2), outer, inset };
}

export async function createCounterQr(value: string, withLogo = true): Promise<string> {
  const url = validateMenuUrl(value);
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, QR_OPTIONS);
  if (withLogo) {
    const logo = new Image();
    logo.src = "/icon.svg"; // Existing LocalEats brand asset, never a remote merchant image.
    await logo.decode();
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("QR preview could not be created.");
    const box = centreLogoBox(canvas.width);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(box.left, box.top, box.outer, box.outer);
    ctx.drawImage(logo, box.left + box.inset, box.top + box.inset, box.outer - 2 * box.inset, box.outer - 2 * box.inset);
  }
  return canvas.toDataURL("image/png");
}

export type CounterSignContent = { shopName: string; url: string; qr: string; headline: string };

export function counterSignPdf(content: CounterSignContent, format: "a4" | "a5" = "a4") {
  validateMenuUrl(content.url);
  if (!content.qr.startsWith("data:image/png;base64,")) throw new Error("Wait for the shop QR code before downloading.");
  if (!content.shopName.trim()) throw new Error("Your verified shop name is required.");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format });
  const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
  const scale = w / 210;
  const text = (value: string, y: number, size: number, bold = false, color = "#0F172A", max = 174) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size * scale); doc.setTextColor(color);
    doc.text(doc.splitTextToSize(value, max * scale), w / 2, y * scale, { align: "center" });
  };
  doc.setFillColor("#FFFFFF"); doc.rect(0, 0, w, h, "F");
  doc.setFillColor("#EA580C"); doc.rect(0, 0, w, 3 * scale, "F");
  text("VISIT", 15, 10, true, "#64748B");
  text(CUSTOMER_ADDRESS, 25, 19, true);
  doc.link(35 * scale, 18 * scale, 140 * scale, 10 * scale, { url: CUSTOMER_ORIGIN });
  text(content.shopName.trim().slice(0, 100), 46, 21, true);
  text(content.headline.trim().slice(0, 64) || COUNTER_HEADLINES[0], 71, 29, true, "#9A3412");
  text("Open your camera. Point. Tap the link.", 92, 13);
  const qrSize = 112 * scale;
  doc.addImage(content.qr, "PNG", (w - qrSize) / 2, 102 * scale, qrSize, qrSize);
  text("Browse the menu. Find your favourite.", 225, 15, true);
  text("Pickup only  |  Pay at the shop", 238, 13, true, "#9A3412");
  text("Ordering depends on your location and shop availability.", 251, 10);
  text("Camera not scanning? Visit the website above and choose this shop.", 263, 10);
  text("LocalEats", 284, 17, true);
  return doc;
}
