import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {merchantMarketingPublishingEnabled} from "../src/services/merchantMarketingTrust.ts";
const marketing=readFileSync(new URL("../src/components/Marketing.tsx",import.meta.url),"utf8");

test("Marketing remains visually inspectable while publishing is disabled",()=>{
 assert.equal(merchantMarketingPublishingEnabled(),false);
 assert.match(marketing,/mainSegment === "campaign_builder" && \(/);
 assert.match(marketing,/mainSegment === "tool_library" && \(/);
 assert.match(marketing,/locked=\{!publishingEnabled\}/);
 assert.match(marketing,/SAMPLE VOUCHER — NOT VALID/);
});

test("QR download link is absent when marketing publishing is off",()=>{
 assert.match(marketing,/\{publishingEnabled \? \(\s*<a\s+href=\{qrDataUrl\}/);
 assert.match(marketing,/aria-disabled="true" title="QR export is unavailable before launch"/);
 assert.match(marketing,/Export Unavailable/);
 assert.match(marketing,/const previewQrTarget = publishingEnabled \? storeUrl : "https:\/\/example\.invalid\/localeats-marketing-preview"/);
});

test("direct print, SMS/caption copying and navigation to coupons fail closed",()=>{
 assert.match(marketing,/const handleDirectPrint = \(\) => \{\s*if\(!publishingEnabled\) return;\s*window\.print\(\)/);
 assert.match(marketing,/onClick=\{\(\) => \{\s*if\(!publishingEnabled\) return;\s*navigator\.clipboard\.writeText\(smsText\)/);
 assert.match(marketing,/onClick=\{\(\) => \{\s*if\(!publishingEnabled\) return;\s*navigator\.clipboard\.writeText\(socialCaption\)/);
 assert.match(marketing,/disabled=\{!publishingEnabled\}\s*title="Coupons are unavailable while marketing is in Preview"/);
 assert.match(marketing,/if\(publishingEnabled\) onNavigateTab\("coupons"\)/);
 assert.match(marketing,/const generatePdfFlyer = \(\) => \{\s*if\(!publishingEnabled\) return;/);
 assert.match(marketing,/const handleDownloadSocialGraphic = \(\) => \{\s*if\(!publishingEnabled\) return;/);
});

test("Marketing original card design, confirmed metrics, and sample-only wording are maintained",()=>{
 assert.match(marketing,/grid grid-cols-2 lg:grid-cols-4 gap-4/);
 assert.match(marketing,/verifiedMarketingStats\(orders, activeShop\?\.id, ordersReadState\)/);
 assert.match(marketing,/Campaign Builder/);
 assert.match(marketing,/Tool Library \(8\)/);
 assert.match(marketing,/Delivery Not Active/);
 assert.doesNotMatch(marketing,/● Live & Accepting Orders/);
});
