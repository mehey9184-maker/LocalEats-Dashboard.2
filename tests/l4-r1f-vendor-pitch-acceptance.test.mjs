import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isApprovedMerchantDemoHostname} from "../src/services/merchantPreviewSimulator.ts";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const tour=read("src/components/OnboardingTour.tsx");
const preview=read("src/services/merchantPreviewSimulator.ts");
const fakeOrders=read("src/components/PreviewFakeOrders.tsx");
const app=read("src/App.tsx");
const onboarding=read("src/components/CreateShopOnboarding.tsx");
const pending=read("src/components/PendingShopApproval.tsx");
const signUp=read("src/components/SignUp.tsx");
const apiGate=read("localeats-api/src/middleware/previewReadOnlyGate.ts");

test("vendor demo hostname: Vercel pattern and explicitly configured Cloudflare Pages only",()=>{
  const vercel="local-eats-dashboard-2-6m8o-abc123-mehey9184-makers-projects.vercel.app";
  assert.equal(isApprovedMerchantDemoHostname(vercel),true);
  const cf="preview.localeats-workshop.pages.dev";
  assert.equal(isApprovedMerchantDemoHostname(cf,cf),true);
  const projectHost="localeats-workshop.pages.dev";
  assert.equal(isApprovedMerchantDemoHostname(projectHost,projectHost),true);
  for(const other of [
    "dashboard.localeatssa.co.za","www.localeatssa.co.za","localeatssa.co.za",
    "my-private-workshop.pages.dev","preview.localeats-workshop.pages.dev.evil.tld",
    "local-eats-dashboard-2-6m8o-abc123-mehey9184-makers-projects.vercel.app.evil.tld",
    "localhost","local-eats-dashboard-2-6m8o-mehey9184-makers-projects.vercel.app",
  ])assert.equal(isApprovedMerchantDemoHostname(other,cf),false,other);
  for(const unsafe of ["", "dashboard.localeatssa.co.za","*.pages.dev","pages.dev","preview.localeats-workshop.pages.dev.evil.tld"])
    assert.equal(isApprovedMerchantDemoHostname(cf,unsafe),false,unsafe);
});

test("demo requires three independent no-write/frontend flags and exact hostname",()=>{
 assert.match(preview,/VITE_MERCHANT_PREVIEW_READ_ONLY\s*===\s*"true"/);
 assert.match(preview,/VITE_MERCHANT_FAKE_ORDERS_ENABLED\s*===\s*"true"/);
 assert.match(preview,/VITE_PICKUP_ORDERING_ENABLED\s*!==\s*"true"/);
 assert.match(preview,/VITE_MERCHANT_PREVIEW_CLOUDFLARE_HOSTNAME/);
 assert.match(preview,/isApprovedMerchantDemoHostname\(/);
 assert.match(apiGate,/LOCALEATS_PREVIEW_READ_ONLY/);
 assert.match(apiGate,/\"POST\",\"PUT\",\"PATCH\",\"DELETE\"/);
});

test("fictional sample order never goes to database, live queue, payment or notification transport",()=>{
 assert.match(fakeOrders,/id:\x60FAKE-L1C3-/);
 assert.match(fakeOrders,/shop_id:"FAKE-NO-SHOP"/);
 assert.match(fakeOrders,/Fake · Test only/);
 assert.match(fakeOrders,/No real order was created/);
 assert.match(fakeOrders,/itemsRef\.current/);
 for(const prohibited of [/await fetch\(/,/supabase\.from/,/updateFirestoreOrder/,/createFirestoreOrder/,/sendPush/,/localStorage\.setItem/,/merchant_set_availability/])
  assert.doesNotMatch(fakeOrders,prohibited);
 assert.match(fakeOrders,/pickupCommand\(order,action,extra\)/);
 assert.match(fakeOrders,/slice\(0,60\)/);
});

test("vendor tour describes only pickup-first, QR/marketing, and non-guaranteed notification capabilities",()=>{
 assert.match(tour,/PICKUP-FIRST TOUR/);
 assert.match(tour,/FAKE TICKETS ONLY/);
 assert.match(tour,/No real order or payment is created/);
 assert.match(tour,/tab: "marketing"/);
 assert.match(tour,/tab: "orders"/);
 assert.match(tour,/Rider dispatch and delivery are not enabled/);
 assert.match(tour,/A simulated alert is not proof/);
 assert.match(tour,/Tour completion is not shop approval/);
 assert.doesNotMatch(tour,/tab: "riders"/);
 for(const falsePromise of ["intelligent rider pool","stream delivery dispatches","hourly revenue charts","Fine-tune alert decibels","See couriers live","instant inventory decrementers"])
  assert.equal(tour.includes(falsePromise),false,falsePromise);
});

test("tour can be read on narrow mobile screens and exposes an accessible dialog/close",()=>{
 assert.match(tour,/role="dialog"/);
 assert.match(tour,/aria-modal="true"/);
 assert.match(tour,/aria-label="LocalEats pickup-first merchant tour"/);
 assert.match(tour,/max-h-\[calc\(100dvh-1\.5rem\)\]/);
 assert.match(tour,/overflow-y-auto/);
 assert.match(tour,/flex-wrap items-center/);
 assert.match(tour,/aria-label="Skip tour"/);
});

test("new vendor journey validates business/GPS/image then creates only a pending shop through the API",()=>{
 assert.match(signUp,/firebaseSignUp\(email, password/);
 assert.match(signUp,/isValidSouthAfricanPhone/);
 assert.match(onboarding,/getBusinessErrors\(/);
 assert.match(onboarding,/getLocationErrors\(/);
 assert.match(onboarding,/hasConfirmedLocation/);
 assert.match(onboarding,/if \(!logoFile\)/);
 assert.match(onboarding,/MerchantApi\.createShop\(payload\)/);
 assert.match(onboarding,/onCreated\(createdShop as Shop\)/);
 assert.match(onboarding,/not be visible to customers until LocalEats approves/);
 assert.doesNotMatch(onboarding,/updateFirestoreShop/);
 assert.doesNotMatch(onboarding,/supabase\.from\("shops"\)/);
});

test("unapproved vendors stay behind approval gate and cannot reach an active merchant dashboard",()=>{
 const noShop=app.indexOf('merchantShopGate.status === "no-shop"');
 const approval=app.indexOf('merchantShopGate.status === "approval-required"');
 const error=app.indexOf('merchantShopGate.status === "error"');
 assert.ok(noShop>=0&&approval>noShop&&error>approval);
 assert.match(app.slice(noShop,approval),/<CreateShopOnboarding/);
 assert.match(app.slice(approval,error),/<PendingShopApproval/);
 assert.match(pending,/not visible to customers/);
 assert.match(pending,/temporarily paused/);
 assert.match(pending,/onRefresh/);
});
