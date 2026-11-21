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

export type CounterQrStyle = "dots" | "classic";

export async function createCounterQr(value: string, withLogo = true, style: CounterQrStyle = "dots"): Promise<string> {
  const url = validateMenuUrl(value);
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, QR_OPTIONS);
  if (style === "dots") {
    const matrix = QRCode.create(url, { errorCorrectionLevel: "H" }).modules;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("QR preview could not be created.");
    const unit = QR_OPTIONS.scale, offset = QR_OPTIONS.margin * unit, n = matrix.size;
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = QR_OPTIONS.color.dark;
    const finder = (row: number, col: number) => (row < 7 && col < 7) || (row < 7 && col >= n - 7) || (row >= n - 7 && col < 7);
    for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
      if (!matrix.get(row, col) || finder(row, col)) continue;
      const x = offset + col * unit, y = offset + row * unit;
      // Keep timing/alignment/format modules exact. Only data modules become dots.
      if (matrix.isReserved(row, col)) ctx.fillRect(x, y, unit, unit);
      else { ctx.beginPath(); ctx.arc(x + unit / 2, y + unit / 2, unit * 0.48, 0, Math.PI * 2); ctx.fill(); }
    }
    for (const [col, row] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      const x = offset + col * unit, y = offset + row * unit;
      for (const [inset, size, radius, color] of [[0, 7, 1.9, QR_OPTIONS.color.dark], [1, 5, 1.3, "#FFFFFF"], [2, 3, 0.8, QR_OPTIONS.color.dark]] as const) {
        ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x + inset * unit, y + inset * unit, size * unit, size * unit, radius * unit); ctx.fill();
      }
    }
  }
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

export async function createCounterDesign(value: string, withLogo = true, style: CounterQrStyle = "dots") {
  const qr = await createCounterQr(value, withLogo, style);
  const frame = new Image(), code = new Image();
  frame.src = "/marketing-cloche-frame.png"; code.src = qr;
  await Promise.all([frame.decode(), code.decode()]);
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The counter artwork could not be created.");
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, 1440, 1440);
  ctx.drawImage(frame, 0, 0, 1440, 1440);
  // White QR tile sits entirely inside the illustrated frame. Its quiet zone is part of the image.
  ctx.drawImage(code, 317, 367, 806, 806);
  return { qr, artwork: canvas.toDataURL("image/png") };
}

export type CounterSignContent = { shopName: string; url: string; qr: string; artwork?: string; headline: string };

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
  text(content.headline.trim().slice(0, 64) || COUNTER_HEADLINES[0], 67, 29, true, "#9A3412");
  text("Open your camera. Point. Tap the link.", 85, 13);
  if (content.artwork) {
    if (!content.artwork.startsWith("data:image/png;base64,")) throw new Error("The counter artwork is not ready.");
    doc.addImage(content.artwork, "PNG", 25 * scale, 91 * scale, 160 * scale, 160 * scale);
  } else {
    const qrSize = 112 * scale;
    doc.addImage(content.qr, "PNG", (w - qrSize) / 2, 102 * scale, qrSize, qrSize);
    text("Browse the menu. Find your favourite.", 229, 15, true);
    text("LocalEats", 245, 17, true);
  }
  text("Pickup only  |  Pay at the shop", 262, 13, true, "#9A3412");
  text("Ordering depends on your location and shop availability.", 275, 10);
  text("Camera not scanning? Visit the website above and choose this shop.", 287, 9);
  return doc;
}
