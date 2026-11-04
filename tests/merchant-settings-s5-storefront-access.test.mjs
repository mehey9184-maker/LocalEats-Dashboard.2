import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { merchantSettingsS4ActionsEnabled } from "../src/services/merchantSettingsS4Preview.ts";

const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const app = read("src/App.tsx");
const storefront = read("src/components/MerchantStorefrontPreview.tsx");
const originalEditor = read("src/components/ShopProfile.tsx");

test("S5: Storefront navigation is accessible outside the locked settings panel", () => {
  assert.match(app, /const \[settingsCategory, setSettingsCategory\] = useState<string>\("storefront"\)/);
  assert.match(app, /Open Storefront &amp; Test Location/);
  assert.match(app, /onClick=\{\(\) => setActiveTab\("storefront"\)\}/);
  const open = app.indexOf("Open Storefront &amp; Test Location");
  const locked = app.indexOf('ref={settingsPreviewPanelRef}');
  assert.ok(open > 0 && open < locked, "Storefront entry must be outside inert Settings content");
  assert.match(app, /element\.inert = true/);
  assert.match(app, /onClickCapture=\{\(event\) => \{ event\.preventDefault\(\); event\.stopPropagation\(\); \}\}/);
});

test("S5: old direct-writing ShopProfile is never rendered in Storefront Preview", () => {
  assert.equal(merchantSettingsS4ActionsEnabled(), false);
  assert.match(originalEditor, /supabase/);
  assert.match(originalEditor, /onSubmit=\{handleUpdate\}/);
  assert.doesNotMatch(app, /<ShopProfile\b/);
  assert.match(app, /<MerchantStorefrontPreview key=\{String\(currentShop\.id\)\} shop=\{currentShop\}/);
  assert.match(storefront, /Read-only Preview/);
  assert.doesNotMatch(storefront, /\.from\(|MerchantApi|fetch\(|axios|updateFirestoreShop|onLocationSaved/);
});

test("S5: original map and registered location are preserved independently of a test pin", () => {
  assert.match(storefront, /import \{ LeafletMap \} from "\.\/LeafletMap"/);
  assert.match(storefront, /shop\?\.lat \?\? shop\?\.latitude/);
  assert.match(storefront, /shop\?\.lng \?\? shop\?\.longitude/);
  assert.match(storefront, /shop\.location \|\| shop\.address/);
  assert.match(storefront, /deliveryRadiusEnabled=\{false\}/);
  assert.match(storefront, /onLocationSelect=\{\(lat, lng\) =>/);
  assert.match(storefront, /Test pin only:/);
  assert.match(storefront, /No server, shop record or customer order is changed/);
});

test("S5: optional test pin is isolated to sessionStorage, never authoritative merchant data", () => {
  assert.match(storefront, /sessionStorage\.getItem\(key\)/);
  assert.match(storefront, /sessionStorage\.setItem\(storageKey, JSON\.stringify\(testPin\)\)/);
  assert.match(storefront, /sessionStorage\.removeItem\(storageKey\)/);
  assert.match(storefront, /getCurrentPosition/);
  assert.match(storefront, /Reset test pin/);
  assert.match(storefront, /Test map pin saved in this tab only/);
  assert.match(storefront, /String\(shop\.id\) === "shop-my-kota-ivory-park"/);
  assert.match(storefront, /The approved My-Kota Customer P7 Preview offers a separately validated virtual listing/);
  assert.doesNotMatch(storefront, /setShops\(|setCurrentShop\(|POST |PATCH |PUT /);
});

test("S5: frequent settings are visible while advanced categories remain accessible", () => {
  assert.match(app, /const \[settingsAdvancedExpanded, setSettingsAdvancedExpanded\] = useState\(false\)/);
  assert.match(app, /settingsAdvancedExpanded \|\| \["storefront", "account", "preferences"\]\.includes\(category\.id\)/);
  assert.match(app, /aria-expanded=\{settingsAdvancedExpanded\}/);
  assert.match(app, /More settings/);
  assert.match(app, /onClick=\{\(\) => setSettingsCategory\(category\.id\)\}/);
  for (const id of ["storefront", "account", "preferences", "pickup-payments", "operations", "delivery", "hardware", "billing", "diagnostics"]) {
    assert.ok(app.includes(`id: "${id}"`), id);
  }
  assert.match(app, /id="riders-coming-soon-title"/);
  assert.doesNotMatch(app, /<RiderManagement\b/);
});
