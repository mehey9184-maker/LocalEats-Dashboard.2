import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  drawRecommendedLocalEatsPoster,
  LOCALEATS_DOMAIN,
  LOCALEATS_POSTER_HEADLINE,
} from "../src/components/marketing/localEatsBrandedPoster.ts";

const source = readFileSync(new URL("../src/components/Marketing.tsx", import.meta.url), "utf8");
const branded = readFileSync(new URL("../src/components/marketing/localEatsBrandedPoster.ts", import.meta.url), "utf8");

test("M4.2 QR uses the owned-shop link, brand icon, high error correction, and quiet zone", () => {
  assert.match(branded, /storeUrl\.startsWith\("https:\/\/www\.localeatssa\.co\.za\/\?shopId="/);
  assert.match(branded, /QRCodeLib\.toCanvas\(canvas, storeUrl/);
  assert.match(branded, /errorCorrectionLevel: "H"/);
  assert.match(branded, /margin: 4/);
  assert.match(branded, /img\.src = "\/icon\.svg"/);
  assert.match(branded, /ctx\.drawImage\(mark, left \+ 7, top \+ 7, box - 14, box - 14\)/);
  assert.match(source, /qrState\?\.sourceUrl === storeUrl \? qrState\.image : ""/);
  assert.match(source, /setQrState\(\{ sourceUrl: storeUrl, image: url \}\)/);
});

test("M4.2 renders a truthful, legible, branded poster with the fallback domain", () => {
  const captions = [];
  const draws = [];
  const ctx = {
    fillStyle: "", font: "", textAlign: "left",
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, roundRect() {},
    fillText(value, x, y) { captions.push({ value: String(value), x, y }); },
    drawImage(...args) { draws.push(args); },
  };
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  const qrImage = {};
  drawRecommendedLocalEatsPoster(canvas, {
    shopName: "My Kota",
    shopLocation: "Tembisa",
    headline: LOCALEATS_POSTER_HEADLINE,
    theme: "coral",
    featuredItem: null,
    qrImage,
  });
  assert.equal(canvas.width, 1080);
  assert.equal(canvas.height, 1080);
  const lines = captions.map(c => c.value);
  assert.ok(lines.includes(LOCALEATS_DOMAIN));
  assert.ok(lines.includes("Serving local flavour since 2023"));
  assert.ok(lines.includes(LOCALEATS_POSTER_HEADLINE));
  assert.ok(lines.some(t => t.includes("deals & offers")));
  assert.ok(lines.some(t => t.includes("when available")));
  assert.ok(lines.some(t => t.includes("Can't scan? Visit " + LOCALEATS_DOMAIN)));
  assert.ok(lines.some(t => t.includes("SCAN TO EXPLORE")));
  assert.ok(lines.some(t => t.includes("Find My Kota")));
  assert.ok(draws.some(([image]) => image === qrImage));
  assert.ok(!lines.some(t => /ORDER NOW|DISCOUNT ACTIVE|FREE DELIVERY|ORDER ONLINE/i.test(t)));
});

test("M4.2 presents one default poster with optional editing and no blank QR download", () => {
  assert.match(source, /useState<string>\(LOCALEATS_POSTER_HEADLINE\)/);
  assert.match(source, /useState\(false\);\n  const \[posterRevision/);
  assert.match(source, /Ready-to-share poster/);
  assert.match(source, /Download Poster \(PNG\)/);
  assert.match(source, /Regenerate/);
  assert.match(source, /Edit Text/);
  assert.match(source, /\{posterEditorOpen && \(/);
  assert.match(source, /disabled=\{!posterReady \|\| !activeShop\}/);
  assert.match(source, /if \(!canvas \|\| !posterReady \|\| !activeShop \|\| !qrDataUrl\)/);
  assert.match(source, /drawRecommendedLocalEatsPoster\(canvasRef\.current/);
  assert.match(source, /if \(!featuredSocialItemId\) return null/);
  assert.doesNotMatch(source, /TO ORDER NOW/);
});
