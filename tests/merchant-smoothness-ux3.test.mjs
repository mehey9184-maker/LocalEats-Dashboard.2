import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const marketing=read("src/components/Marketing.tsx");
const payments=read("src/components/PaymentHistory.tsx");
const plans=read("src/components/MerchantSubscriptionPlans.tsx");
const profile=read("src/components/ShopProfile.tsx");
const editProfile=read("src/components/EditProfile.tsx");
const app=read("src/App.tsx");
const css=read("src/index.css");

test("UX3 Marketing copy feedback is truthful and tabs retain existing destinations",()=>{
  assert.match(marketing,/const copyMarketingText = async/);
  assert.match(marketing,/await navigator\.clipboard\.writeText\(value\)/);
  assert.match(marketing,/toast\.error\("Unable to copy/);
  assert.match(marketing,/void copyMarketingText\(storeUrl, setCopiedLink/);
  assert.match(marketing,/void copyMarketingText\(activeMessage, setCopiedMsg/);
  assert.match(marketing,/copyMarketingText\(socialCaption, setCopiedCaption/);
  assert.match(marketing,/copyMarketingText\(smsText, setCopiedSms/);
  assert.doesNotMatch(marketing,/navigator\.clipboard\.writeText\(storeUrl\);\s+setCopiedLink\(true\)/);
  assert.match(marketing,/aria-pressed=\{mainSegment === "dashboard"\}/);
  assert.match(marketing,/aria-pressed=\{mainSegment === "campaign_builder"\}/);
  assert.match(marketing,/aria-pressed=\{mainSegment === "tool_library"\}/);
  assert.match(marketing,/setActiveTool\(tool\)/);
});

test("UX3 Payments keeps verified shop isolation and improves local pagination",()=>{
  assert.match(payments,/useEffect\(\(\)=>\{setLimit\(20\);\},\[shopId\]\)/);
  assert.match(payments,/const verified=shopVerified && ordersVerified/);
  assert.match(payments,/String\(order\.shop_id\)===String\(shopId\)/);
  assert.match(payments,/le-press-feedback min-h-11 px-4 py-2 rounded-xl/);
  assert.match(payments,/le-panel-enter/);
  assert.match(payments,/Payment flags in order records are/);
  assert.match(payments,/not cash receipts, bank statements or proof of settlement/);
});

test("UX3 subscription countdown pauses in hidden browser tabs and at deadline",()=>{
  assert.match(plans,/document\.visibilityState!=="visible"/);
  assert.match(plans,/document\.addEventListener\("visibilitychange",sync\)/);
  assert.match(plans,/document\.removeEventListener\("visibilitychange",sync\)/);
  assert.match(plans,/if\(tick>=deadline\)stop\(\)/);
  assert.match(plans,/window\.clearInterval\(interval\)/);
  assert.match(plans,/const current=useMemo\(\(\)=>planFromVerifiedShop\(verified\?shop:undefined\)/);
  assert.match(plans,/VITE_PAYMENTS_PLAN_DEMO_ENABLED==="true"/);
});

test("UX3 Settings gives real connection evidence and blocks Preview account/push writes",()=>{
  assert.match(app,/const verified = await MerchantApi\.getMerchantShop\(\)/);
  assert.match(app,/Merchant API and your shop connection were verified/);
  assert.doesNotMatch(app,/Connection to relay nodes is optimal/);
  assert.match(app,/const handleSaveProfile = async \(data: ProfileData\) => \{\s+if \(import\.meta\.env\.VITE_MERCHANT_PREVIEW_READ_ONLY === "true"\)/);
  assert.match(app,/Read-only Preview: push registration is disabled/);
  assert.match(app,/aria-pressed=\{selected\}/);
  assert.match(app,/le-press-feedback group flex items-center gap-3 min-h-14/);
});

test("UX3 Storefront preview blocks direct database, avatar and storage operations",()=>{
  assert.match(profile,/const isReadOnlyPreview = import\.meta\.env\.VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
  assert.match(profile,/const handleUpdate = async \(e: React\.FormEvent\) => \{\s+e\.preventDefault\(\);\s+if \(isReadOnlyPreview\)/);
  assert.match(profile,/const handleUpdateLocation = \(\) => \{\s+if \(isReadOnlyPreview\)/);
  assert.match(profile,/const handleImageUpload = async \([\s\S]*?\) => \{\s+if \(isReadOnlyPreview\)/);
  assert.match(profile,/onClick=\{async \(\) => \{\s+if \(isReadOnlyPreview\)[\s\S]*?shop_followers/);
  assert.match(profile,/disabled=\{isReadOnlyPreview \|\| isSaving \|\| isSuccess\}/);
  assert.match(profile,/disabled=\{!!uploadingType \|\| isReadOnlyPreview\}/);
  assert.match(profile,/disabled=\{isReadOnlyPreview \|\| isLocating\}/);
  assert.match(profile,/role="dialog"/);
  assert.match(profile,/aria-modal="true"/);
  assert.match(profile,/mapPinCancelRef\.current\?\.focus\(\)/);
  assert.match(editProfile,/const isReadOnlyPreview = import\.meta\.env\.VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
  assert.match(editProfile,/const uploadAvatarPhoto = async \(file: File\) => \{\s+if \(isReadOnlyPreview\)/);
  assert.match(editProfile,/const handleSave = \(\) => \{\s+if \(isReadOnlyPreview\)/);
  assert.match(editProfile,/disabled=\{isReadOnlyPreview \|\| isSaving \|\| isSuccess\}/);
});

test("UX3 respects reduced-motion and retains UX1/UX2 safety boundaries",()=>{
  assert.match(css,/le-ux3-panel-enter/);
  assert.match(css,/prefers-reduced-motion: no-preference/);
  assert.match(css,/\.le-press-feedback:active/);
  assert.match(app,/orderReadCoordinator\.current\.refresh\(orderReadScope/);
  assert.match(app,/merchantShopGate\.status === "ready"/);
  assert.match(app,/VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
  assert.match(app,/pickupOrderingEnabled\(\)/);
});
