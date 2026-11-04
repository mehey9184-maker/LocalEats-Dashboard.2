import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {merchantMarketingPublishingEnabled} from "../src/services/merchantMarketingTrust.ts";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const marketing=read("src/components/Marketing.tsx");
const builder=read("src/components/CampaignBuilder.tsx");
const flash=read("src/components/marketing/FlashDealsStudio.tsx");
const table=read("src/components/marketing/TableTentGenerator.tsx");
const customers=read("src/components/marketing/CustomerReEngagement.tsx");
const wrapper=read("src/components/marketing/ReadOnlyMarketingPreview.tsx");

test("Marketing K3 previews cannot announce launch, rider delivery or online card payment",()=>{
 assert.match(marketing,/SAMPLE LAUNCH MESSAGE/);
 assert.match(marketing,/COLLECTION-ONLY PLAN/);
 assert.match(marketing,/SAMPLE VOUCHER — NOT VALID/);
 assert.match(marketing,/No discount exists or can be redeemed/);
 assert.match(marketing,/pay at the shop \(cash or the shop card machine\)/);
 assert.match(marketing,/Sample Store Preview/);
 assert.match(marketing,/Delivery Deferred/);
 assert.match(marketing,/Delivery Not Active/);
 assert.doesNotMatch(marketing,/IS LIVE ON LOCALEATS|TOWNSHIP DELIVERY NOW AVAILABLE|Fast Local Delivery|Pay Cash on Arrival|11:30 AM sharp/);
 assert.doesNotMatch(marketing,/SCAN TO ORDER ONLINE|Ready to post on Facebook/);
});

test("marketing generated WhatsApp, SMS, canvas, QR and flyer are labelled non-operational",()=>{
 assert.match(marketing,/previewQrTarget = publishingEnabled \? storeUrl : "https:\/\/example\.invalid\/localeats-marketing-preview"/);
 assert.match(marketing,/SAMPLE SOCIAL POST/);
 assert.match(marketing,/SAMPLE LUNCH POST/);
 assert.match(marketing,/SAMPLE WEEKEND MESSAGE/);
 assert.match(marketing,/ctx\.fillText\("MARKETING"/);
 assert.match(marketing,/ctx\.fillText\("PREVIEW ONLY"/);
 assert.match(marketing,/ctx\.fillText\("NOT A LIVE ORDER"/);
 assert.match(marketing,/FUTURE COLLECTION FLOW \(NOT ACTIVE\)/);
 assert.match(marketing,/SMS text only. Sending is disabled/);
 assert.match(marketing,/segment count not verified/);
 assert.doesNotMatch(marketing,/Math\.ceil\(smsText\.length \/ 160\)|single-credit SMS/);
 assert.match(marketing,/Test Lunch-Time Posting/);
 assert.match(marketing,/Do not share inactive order links/);
 assert.match(marketing,/Community Groups — With Permission/);
});

test("Campaign Builder presets and voucher previews show sample-only copy",()=>{
 assert.match(builder,/previewOnly \? "SAMPLE LUNCH OFFER — NOT ACTIVE"/);
 assert.match(builder,/previewOnly \? "SAMPLE20"/);
 assert.match(builder,/previewOnly \? "EXAMPLE — NOT VALID"/);
 assert.match(builder,/previewOnly \? "🚫 Delivery Not Available"/);
 assert.match(builder,/DELIVERY IS NOT AVAILABLE/);
 assert.match(builder,/Riders and delivery are deferred/);
 assert.match(builder,/no first-order discount is active/);
 assert.match(builder,/no free gifts or codes are available/);
 assert.match(builder,/Sample Code — Not Redeemable/);
 assert.match(builder,/Customer Design Mockup — Not Live/);
 assert.match(builder,/Sample voucher design only/);
 assert.match(builder,/Example minimum:/);
 assert.match(builder,/Geographic targeting unavailable/);
 assert.match(builder,/Example date — not active/);
 assert.match(builder,/Campaign Impact — Unverified/);
 assert.match(builder,/Not Redeemable/);
});

test("Flash Deals distinguish hypothetical prices from actual promotions",()=>{
 assert.match(flash,/No Live Flash Deals/);
 assert.match(flash,/Example Flash Deal Setup/);
 assert.match(flash,/Example Price/);
 assert.match(flash,/hypothetical/);
 assert.match(flash,/Deal Activation Unavailable/);
 assert.match(flash,/No Published Flash Deals/);
 assert.match(flash,/if\(previewOnly\) return \[\]; \/\/ Old local deal records/);
 assert.match(flash,/if\(previewOnly\) return;\s*try \{\s*localStorage\.setItem/);
});

test("Table QR designs cannot imply table ordering or online card payment",()=>{
 assert.match(table,/EXAMPLE TABLE CARD — NOT LIVE/);
 assert.match(table,/Example Table Card Layout/);
 assert.match(table,/Example Table \$\{previewTableNum\} — Ordering Disabled/);
 assert.match(table,/No table checkout or online payments/);
 assert.match(table,/if\(previewOnly\) return \`https:\/\/example\.invalid\/localeats-table-preview/);
 assert.match(table,/if\(previewOnly\) return;/);
 assert.doesNotMatch(table,/Pay Cash to Waiter or Pay Card online|Pay Cash to waiter or Card online/);
});

test("Customer Reach preview never exposes or pretends to count customers",()=>{
 assert.match(marketing,/orders=\{publishingEnabled \? orders : \[\]\}/);
 assert.match(marketing,/<CustomerReEngagement[\s\S]*?previewOnly=\{!publishingEnabled\}/);
 assert.match(customers,/if\(previewOnly\) return \[\]; \/\/ Do not collect contact records/);
 assert.match(customers,/previewOnly \? "—" : metrics\.totalDiners/);
 assert.match(customers,/previewOnly \? "—" : metrics\.repeatDiners/);
 assert.match(customers,/previewOnly \? "—" : metrics\.activePast14Days/);
 assert.match(customers,/Customer Contacts Not Loaded/);
 assert.match(customers,/No contact records are loaded and customer messaging is not available/);
 assert.match(customers,/const handleSendWhatsApp = \(customer: CustomerProfile\) => \{\s*if\(previewOnly\) return;/);
 assert.match(customers,/const handleCopyPhone = \(customer: CustomerProfile\) => \{\s*if\(previewOnly\) return;/);
});

test("K3 retains read-only tool navigation, inert subtree, and no go-live gate",()=>{
 assert.equal(merchantMarketingPublishingEnabled(),false);
 assert.match(marketing,/mainSegment === "campaign_builder" && \(/);
 assert.match(marketing,/mainSegment === "tool_library" && \(/);
 assert.match(marketing,/locked=\{!publishingEnabled\}/);
 assert.match(marketing,/previewOnly=\{!publishingEnabled\}/);
 assert.match(wrapper,/element\.inert=locked/);
 assert.match(wrapper,/pointer-events-none select-none/);
});
