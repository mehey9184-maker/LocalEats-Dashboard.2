import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const marketing = readFileSync(new URL("../src/components/Marketing.tsx", import.meta.url), "utf8");

test("M4.1 presents only four direct owner marketing actions", () => {
  for (const label of ["Share My Shop", "Create Poster", "QR & Flyers", "Marketing Tips"]) {
    assert.match(marketing, new RegExp('label: "' + label.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&") + '"'));
  }
  assert.match(marketing, /useState<MainSegment>\("tool_library"\)/);
  assert.match(marketing, /useState<ToolSubTab>\("whatsapp"\)/);
  assert.match(marketing, /aria-pressed=\{activeTool === key\}/);
  assert.match(marketing, /disabled=\{!activeShop\}/);
});

test("M4.1 hides unsupported campaigns, analytics and direct outreach", () => {
  assert.match(marketing, /false && mainSegment === "dashboard"/);
  assert.match(marketing, /false && mainSegment === "campaign_builder"/);
  for (const tool of ["direct_reach","flash_deals","table_tents","sms"]) {
    assert.ok(marketing.includes('false && activeTool === "' + tool + '"'));
  }
  assert.ok(!marketing.includes("Tool Library (8)"));
  assert.ok(!marketing.includes("Dashboard Summary</span>"));
  assert.ok(!marketing.includes("Campaign Builder</span>"));
});

test("M4.1 retains working generators but isolates shop-specific material", () => {
  for(const marker of ["generatePdfFlyer", "generateRewardsTeaserPdf", "renderSocialGraphic", "handleOpenWhatsApp", "QRCodeLib.toDataURL", "shop_id"]) {
    assert.ok(marketing.includes(marker), marker);
  }
  assert.ok(marketing.includes("isShopOwnedByUser(currentShop, user)"));
  assert.ok(marketing.includes('if (!activeShop) return [];'));
  assert.ok(marketing.includes('if (!activeShop) return "";'));
  assert.ok(marketing.includes("shopOrders.length > 0 ? Math.round(totalRevenue / shopOrders.length)"));
});

test("M4.1 wires shop link copy to an existing handler, preventing runtime ReferenceError", () => {
  assert.match(marketing, /const copyStoreUrl = \(\) => \{/);
  assert.match(marketing, /onClick=\{copyStoreUrl\}/);
  assert.doesNotMatch(marketing, /handleCopyLink/);
});
