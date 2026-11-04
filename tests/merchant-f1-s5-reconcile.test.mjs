import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { merchantStorefrontPreviewOnly, merchantStorefrontWritesEnabled } from "../src/services/merchantStorefrontPreviewPolicy.ts";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const app = read("src/App.tsx");
const home = read("src/components/DashboardOverview.tsx");
const safeStorefront = read("src/components/MerchantStorefrontPreview.tsx");
const legacyStorefront = read("src/components/ShopProfile.tsx");

test("F1/S5: hardened Preview lock always denies shop availability/profile writes", () => {
  assert.equal(merchantStorefrontPreviewOnly(), true);
  assert.equal(merchantStorefrontWritesEnabled(), false);
  assert.match(app, /const handleSaveProfile = async \(data: ProfileData\) => \{\s*if \(!merchantStorefrontWritesEnabled\(\)\)/);
  assert.match(app, /if \(isEditingProfile && !merchantStorefrontPreviewOnly\(\)\)/);
  assert.match(app, /if \(merchantStorefrontPreviewOnly\(\)\) \{\s*return \(\s*<div/);
  assert.match(app, /Shop Onboarding — Preview Only/);
  assert.match(app, /disabled=\{availabilityBusy \|\| merchantStorefrontPreviewOnly\(\)\}/);
  assert.match(app, /if \(availabilityBusy \|\| merchantStorefrontPreviewOnly\(\)\) return/);
  assert.match(app, /<DashboardOverview\s+previewOnly=\{merchantStorefrontPreviewOnly\(\)\}/);
  assert.match(app, /onEditProfile=\{\(\) => \{ if \(merchantStorefrontPreviewOnly\(\)\)/);
});

test("F1/S5: single and bulk Dashboard status buttons are disabled and guarded", () => {
  assert.equal((home.match(/disabled=\{previewOnly \|\| isStatusToggling\}/g) || []).length, 2);
  assert.equal((home.match(/if \(previewOnly \|\| isStatusToggling\) return;/g) || []).length, 2);
  assert.match(home, /previewOnly = false/);
  assert.match(home, /Status Change Unavailable/);
  assert.match(home, /Bulk Status Unavailable/);
  assert.match(home, /Availability changes are disabled in Preview/);
});

test("F1/S5: new Storefront read-only map remains intact; legacy writer never mounted", () => {
  assert.match(app, /<MerchantStorefrontPreview key=\{String\(currentShop\.id\)\} shop=\{currentShop\}/);
  assert.doesNotMatch(app, /<ShopProfile\b/);
  assert.match(legacyStorefront, /supabase/); // Guard against accidentally remounting it.
  assert.match(safeStorefront, /sessionStorage\.setItem\(storageKey/);
  assert.match(safeStorefront, /Test pin only:/);
  assert.match(app, /settingsPreviewPanelRef/);
  assert.match(app, /id="riders-coming-soon-title"/);
  assert.doesNotMatch(app, /<RiderManagement\b/);
});
