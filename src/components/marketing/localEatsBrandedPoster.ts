import QRCodeLib from "qrcode";

export type BrandQrTheme = "standard" | "coral" | "dark";
export const LOCALEATS_DOMAIN = "www.localeatssa.co.za";
export const LOCALEATS_POSTER_HEADLINE = "Big flavour. Local deals. One app.";

// The QR payload is the owned-shop URL, not the short fallback domain.
// Error correction H and a 4-module quiet zone protect scan reliability.
export async function createLocalEatsBrandedQr(storeUrl: string, theme: BrandQrTheme = "coral"): Promise<string> {
  if (!storeUrl.startsWith("https://www.localeatssa.co.za/?shopId=")) {
    throw new Error("A verified LocalEats shop URL is required.");
  }
  const canvas = document.createElement("canvas");
  const dark = theme === "coral" ? "#C2410C" : theme === "dark" ? "#020617" : "#0F172A";
  await QRCodeLib.toCanvas(canvas, storeUrl, {
    width: 500,
    margin: 4,
    errorCorrectionLevel: "H",
    color: { dark, light: "#FFFFFF" }
  });
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("QR image generation is unavailable.");
  const mark = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("LocalEats brand icon could not be loaded."));
    img.src = "/icon.svg";
  });
  // White backing protects the logo from QR modules. Keep it under 18% of width.
  const box = 82;
  const left = (canvas.width - box) / 2;
  const top = (canvas.height - box) / 2;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(left, top, box, box, 14);
  ctx.fill();
  ctx.drawImage(mark, left + 7, top + 7, box - 14, box - 14);
  return canvas.toDataURL("image/png");
}

export type PosterTheme = "coral" | "dark" | "golden" | "emerald";
export interface PosterOptions {
  shopName: string;
  shopLocation: string;
  headline: string;
  featuredItem?: { name: string; price: string | number } | null;
  theme: PosterTheme;
  qrImage: HTMLImageElement;
}
export const postableBrandCopy =
  "Discover local shops and meals. Check deals & offers when available in the app.";

export function drawRecommendedLocalEatsPoster(canvas: HTMLCanvasElement, options: PosterOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Poster canvas is unavailable.");
  canvas.width = 1080;
  canvas.height = 1080;

  const palettes: Record<PosterTheme, [string, string]> = {
    coral: ["#EA580C", "#9A3412"], dark: ["#172135", "#020617"],
    golden: ["#D97706", "#78350F"], emerald: ["#047857", "#064E3B"]
  };
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, palettes[options.theme][0]);
  gradient.addColorStop(1, palettes[options.theme][1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = "rgba(255,255,255,0.055)";
  ctx.beginPath(); ctx.arc(970, 125, 285, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(130, 1040, 250, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 31px system-ui, sans-serif";
  ctx.fillText(LOCALEATS_DOMAIN, 76, 93);
  ctx.fillStyle = "#FFEDD5";
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillText("Serving local flavour since 2023", 76, 127);

  ctx.font = "900 69px system-ui, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("Local", 76, 245);
  ctx.fillStyle = "#FED7AA";
  ctx.fillText("Eats", 249, 245);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 49px system-ui, sans-serif";
  const headline = options.headline.trim() || LOCALEATS_POSTER_HEADLINE;
  // Keep the recommended headline large and readable even for long custom text.
  ctx.fillText(headline, 76, 338, 928);

  ctx.font = "600 25px system-ui, sans-serif";
  ctx.fillStyle = "#FFF7ED";
  ctx.fillText("Explore local food and check deals & offers", 76, 396, 930);
  ctx.fillText("when available on LocalEats.", 76, 430, 930);

  // Left panel: verified shop identity and optional actual menu item.
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath(); ctx.roundRect(76, 477, 500, 414, 28); ctx.fill();
  ctx.fillStyle = "#FED7AA";
  ctx.font = "800 22px system-ui, sans-serif";
  ctx.fillText("DISCOVER THIS LOCAL SHOP", 110, 532);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 43px system-ui, sans-serif";
  ctx.fillText(options.shopName || "LocalEats shop", 110, 601, 435);

  if (options.featuredItem) {
    ctx.fillStyle = "#FFEDD5";
    ctx.font = "800 22px system-ui, sans-serif";
    ctx.fillText("MENU SPOTLIGHT", 110, 682);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 31px system-ui, sans-serif";
    ctx.fillText(options.featuredItem.name, 110, 731, 425);
    ctx.fillStyle = "#FED7AA";
    ctx.font = "800 29px system-ui, sans-serif";
    ctx.fillText("R" + options.featuredItem.price, 110, 777);
  } else {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "750 28px system-ui, sans-serif";
    ctx.fillText("Browse menus and prices.", 110, 708, 440);
    ctx.fillText("Find your next favourite meal.", 110, 759, 440);
  }
  ctx.fillStyle = "#FFEDD5";
  ctx.font = "600 21px system-ui, sans-serif";
  ctx.fillText("Pickup availability shown in-app.", 110, 844, 430);

  // Right panel: fully generated QR with the official LocalEats icon centered.
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath(); ctx.roundRect(604, 477, 400, 414, 28); ctx.fill();
  ctx.drawImage(options.qrImage, 639, 509, 330, 330);
  ctx.fillStyle = "#9A3412";
  ctx.textAlign = "center";
  ctx.font = "900 24px system-ui, sans-serif";
  ctx.fillText("SCAN TO EXPLORE", 804, 866);
  ctx.textAlign = "left";

  // Typing fallback: domain is real, but users must find the shop after visiting.
  ctx.fillStyle = "rgba(0,0,0,0.36)";
  ctx.beginPath(); ctx.roundRect(76, 929, 928, 106, 25); ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 27px system-ui, sans-serif";
  ctx.fillText("Can't scan? Visit " + LOCALEATS_DOMAIN, 102, 971, 874);
  ctx.fillStyle = "#FFEDD5";
  ctx.font = "600 21px system-ui, sans-serif";
  ctx.fillText("Find " + (options.shopName || "the shop") + " on LocalEats. Pickup only.", 102, 1008, 872);
}