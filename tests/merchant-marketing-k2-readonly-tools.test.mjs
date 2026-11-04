import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {merchantMarketingPublishingEnabled} from "../src/services/merchantMarketingTrust.ts";

const marketing=readFileSync(new URL("../src/components/Marketing.tsx",import.meta.url),"utf8");
const wrapper=readFileSync(new URL("../src/components/marketing/ReadOnlyMarketingPreview.tsx",import.meta.url),"utf8");
const builder=readFileSync(new URL("../src/components/CampaignBuilder.tsx",import.meta.url),"utf8");
const flash=readFileSync(new URL("../src/components/marketing/FlashDealsStudio.tsx",import.meta.url),"utf8");
const table=readFileSync(new URL("../src/components/marketing/TableTentGenerator.tsx",import.meta.url),"utf8");

test("K2 lets merchants navigate all original tool pages without enabling publishing",()=>{
 assert.equal(merchantMarketingPublishingEnabled(),false);
 assert.match(marketing,/onClick=\{\(\) => setMainSegment\("campaign_builder"\)\}/);
 assert.match(marketing,/onClick=\{\(\) => setMainSegment\("tool_library"\)\}/);
 assert.match(marketing,/mainSegment === "campaign_builder" && \(/);
 assert.match(marketing,/mainSegment === "tool_library" && \(/);
 assert.match(marketing,/ReadOnlyMarketingPreview/);
 assert.match(marketing,/locked=\{!publishingEnabled\}/);
 assert.match(marketing,/Marketing Preview only/);
 for(const id of ["direct_reach","flash_deals","table_tents","qr_stands","whatsapp","social_studio","sms","playbook"]){
   assert.match(marketing,new RegExp('setActiveTool\\("'+id+'"\\)'));
 }
 assert.match(marketing,/grid grid-cols-2 lg:grid-cols-4 gap-4/);
});

test("previewed tool child elements are truly inert and cannot send, download or change data",()=>{
 assert.match(wrapper,/element\.inert=locked/);
 assert.match(wrapper,/pointer-events-none select-none/);
 assert.match(wrapper,/onClickCapture=\{locked\?/);
 assert.match(wrapper,/onKeyDownCapture=\{locked\?/);
 assert.match(wrapper,/onSubmitCapture=\{locked\?/);
 assert.match(marketing,/<CampaignBuilder[\s\S]*?previewOnly=\{!publishingEnabled\}/);
 assert.match(marketing,/<FlashDealsStudio[\s\S]*?previewOnly=\{!publishingEnabled\}/);
 assert.match(marketing,/<TableTentGenerator[\s\S]*?previewOnly=\{!publishingEnabled\}/);
 assert.match(marketing,/orders=\{publishingEnabled \? orders : \[\]\}/);
});

test("campaign builder never seeds fake active promos or copies/saves campaigns in preview",()=>{
 assert.match(builder,/previewOnly\?: boolean/);
 assert.match(builder,/if\(previewOnly\) return \[\]; \/\/ Never display old local drafts/);
 assert.match(builder,/!previewOnly && savedCampaigns.length > 0/);
 assert.match(builder,/const handleSaveCampaign = \(\) => \{\s*if\(previewOnly\) return;/);
 assert.match(builder,/const handleToggleCampaignStatus = \(id: string\) => \{\s*if\(previewOnly\) return;/);
 assert.match(builder,/const handleDeleteCampaign = \(id: string\) => \{\s*if\(previewOnly\) return;/);
 assert.match(builder,/const handleCopyPayload = \(\) => \{\s*if\(previewOnly\) return;/);
 assert.match(builder,/Campaign Impact — Unverified/);
 assert.match(builder,/previewOnly \? "Not Validated"/);
 assert.match(builder,/previewOnly \? "—" : "~350\+ Users"/);
 assert.match(builder,/previewOnly \? "—" : "\+28% Orders"/);
 assert.match(builder,/previewOnly \? "—" : "~R165\.00"/);
 assert.match(builder,/No discount is active/);
});

test("flash deals neither read nor overwrite browser-stored deals in preview",()=>{
 assert.match(flash,/previewOnly\?: boolean/);
 assert.match(flash,/if\(previewOnly\) return \[\]; \/\/ Old local deal records/);
 assert.match(flash,/useEffect\(\(\) => \{\s*if\(previewOnly\) return;\s*try \{\s*localStorage\.setItem/);
 for(const method of ["handleLaunchDeal","handleShareWhatsApp","handleCopyDealBroadcast"]){
   assert.match(flash,new RegExp('const '+method+' = \\([^\\n]*\\) => \\{\\s*if\\(previewOnly\\) return;'));
 }
 assert.match(flash,/No discounts, countdown offers or customer sharing are active/);
});

test("QR codes in marketing preview lead only to non-operational example.invalid",()=>{
 assert.match(marketing,/previewQrTarget = publishingEnabled \? storeUrl : "https:\/\/example\.invalid\/localeats-marketing-preview"/);
 assert.match(marketing,/QRCodeLib\.toDataURL\(previewQrTarget, \{/);
 assert.match(marketing,/storeUrl=\{publishingEnabled \? storeUrl : "https:\/\/example\.invalid\/localeats-marketing-preview"\}/);
 assert.match(table,/if\(previewOnly\) return \`https:\/\/example\.invalid\/localeats-table-preview\?table=\$\{tableNum\}\`/);
 assert.match(table,/const handleDownloadBatchPdf = async \(\) => \{\s*if\(previewOnly\) return;/);
 assert.match(table,/QR codes cannot place orders and PDF export is disabled/);
});

test("K1 storefront and backend activation guard remain unchanged",()=>{
 assert.match(marketing,/● Ordering Not Activated/);
 assert.match(marketing,/QR Preview Only — Not for Distribution/);
 assert.match(marketing,/disabled=\{!publishingEnabled\}/);
 assert.match(marketing,/const publishingEnabled = merchantMarketingPublishingEnabled\(\)/);
 assert.doesNotMatch(marketing,/Your Live Online Storefront|● Live & Accepting Orders/);
});
