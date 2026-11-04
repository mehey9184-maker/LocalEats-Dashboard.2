import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {merchantSettingsS4ActionsEnabled,merchantSettingsS4Notice} from "../src/services/merchantSettingsS4Preview.ts";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("src/App.tsx");
const diagnostics=read("src/components/ShopDiagnosticPanel.tsx");
const language=read("src/components/LanguageSwitcher.tsx");
const section=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
const storefront=section('{settingsCategory === "storefront" && (','{settingsCategory === "operations" && (');
const prefs=section('{settingsCategory === "preferences" && (', '{settingsCategory === "account" && (');
const preferencesMain=app.slice(app.indexOf('{settingsCategory === "billing" && <SettingsBillingPreview />}'),app.indexOf('{settingsCategory === "account" && (',app.indexOf('{settingsCategory === "billing" && <SettingsBillingPreview />}')));

test("S4 keeps all Settings panels navigable but never enables writes",()=>{
 assert.equal(merchantSettingsS4ActionsEnabled(),false);
 assert.match(merchantSettingsS4Notice(),/Settings Preview only/);
 assert.match(app,/settingsPreviewPanelRef/);
 assert.match(app,/element.inert = true/);
 assert.match(app,/onClick=\{\(\) => setSettingsCategory\(category.id\)\}/);
 for(const name of ["account","storefront","pickup-payments","operations","delivery","hardware","billing","preferences","diagnostics"]){
   assert.match(app,new RegExp('id: "'+name+'"'));
 }
});

test("Storefront location does not claim verified GPS or invoke write/navigation callbacks in Preview",()=>{
 assert.match(storefront,/previewOnly=\{!merchantSettingsS4ActionsEnabled\(\)\}/);
 assert.match(storefront,/onDetectGPS=\{merchantSettingsS4ActionsEnabled\(\) \? detectShopGPS : undefined\}/);
 assert.match(storefront,/onAutoAlign=\{merchantSettingsS4ActionsEnabled\(\) \? autoAlignShopCity : undefined\}/);
 assert.match(storefront,/onSave=\{merchantSettingsS4ActionsEnabled\(\) \? \(\) => saveShopLocationSettings\(\) : undefined\}/);
 assert.match(storefront,/onOpenStorefrontMap=\{merchantSettingsS4ActionsEnabled\(\) \? \(\) => setActiveTab\("storefront"\) : undefined\}/);
 assert.match(storefront,/Profile changes are unavailable in read-only Preview/);
 assert.match(storefront,/disabled=\{!merchantSettingsS4ActionsEnabled\(\)\}/);
 assert.doesNotMatch(storefront,/href="https:\/\/rider\.localeatssa\.co\.za\/"/);
 assert.match(storefront,/Rider missions and delivery are deferred/);
 assert.match(storefront,/aria-disabled="true"/);
});

test("Account and Staff actions have direct safety guards and remain same cards",()=>{
 assert.match(app,/onClick=\{\(\) => \{ if\(merchantSettingsS4ActionsEnabled\(\)\) setIsEditingProfile\(true\); \}\}/);
 assert.match(app,/Profile editing is not available in this Preview/);
 assert.match(app,/Staff access management is not activated or verified/);
 assert.match(app,/Staff accounts require a separate permissions review/);
 assert.match(app,/Staff permissions require an authorised server-side access review/);
 assert.match(app,/disabled=\{!merchantSettingsS4ActionsEnabled\(\)\}/);
 assert.match(app,/Sign Out/);
 assert.match(app,/if\(merchantSettingsS4ActionsEnabled\(\)\) void handleSignOut\(\)/);
});

test("Diagnostics never renders sensitive raw owner data or incorrectly claims verified Firestore",()=>{
 assert.match(diagnostics,/Shop Record Diagnostics — Preview/);
 assert.match(diagnostics,/No live Firestore verification, permission check or customer-order availability/);
 assert.match(diagnostics,/Owner identifier/);
 assert.match(diagnostics,/Hidden in merchant Preview/);
 assert.match(diagnostics,/Raw JSON data/);
 assert.match(diagnostics,/Not displayed here to protect internal/);
 assert.doesNotMatch(diagnostics,/JSON\.stringify\(currentShop|currentShop\.owner_id|\{currentShop\.id\}|<pre\b/);
 assert.match(app,/Shop Diagnostics — Preview/);
 assert.match(app,/<ShopDiagnosticPanel currentShop=\{currentShop\}/);
});

test("Language view makes no third-party script request in Settings Preview",()=>{
 assert.match(app,/<LanguageSwitcher previewOnly=\{!merchantSettingsS4ActionsEnabled\(\)\}/);
 assert.match(language,/previewOnly\?:boolean/);
 assert.match(language,/if\(previewOnly\)return; \/\/ Never fetch or run/);
 assert.match(language,/Translation control unavailable in Preview/);
 assert.match(language,/Language translation is not activated or verified in this Preview/);
 assert.match(language,/document\.body\.appendChild\(script\)/); // Preserved outside Preview
});

test("Preferences cannot change sound/theme or request browser push in Preview",()=>{
 assert.match(preferencesMain,/Preferences are design-only in this Preview/);
 assert.match(preferencesMain,/no order alert is guaranteed/);
 assert.match(preferencesMain,/disabled=\{!merchantSettingsS4ActionsEnabled\(\)\}/);
 assert.match(preferencesMain,/if\(!merchantSettingsS4ActionsEnabled\(\)\)return;\s*setSoundStyle\(theme\.id\)/);
 assert.match(preferencesMain,/if\(!merchantSettingsS4ActionsEnabled\(\)\)return;\s*const v = parseInt\(e\.target\.value\)/);
 assert.match(preferencesMain,/if\(!merchantSettingsS4ActionsEnabled\(\)\)return;\s*if \(!pushEnabled\)/);
 assert.match(preferencesMain,/Browser push is not verified in Preview/);
 assert.match(preferencesMain,/if\(merchantSettingsS4ActionsEnabled\(\)\)setDarkMode\(!darkMode\)/);
 assert.match(prefs,/Walkthrough controls are unavailable while Settings is read-only/);
});

test("Help avoids unsupported live order, rider, payout, and background alert claims",()=>{
 assert.match(app,/Marketing campaigns and discount codes are design previews/);
 assert.match(app,/Delivery, live rider tracking and dispatch are deferred/);
 assert.match(app,/Bank payouts and live settlement reports are not supported or verified/);
 assert.match(app,/Background delivery is not guaranteed/);
 assert.match(app,/Payment settlement, payout verification and delivery-location privacy need a separate production security review/);
 assert.doesNotMatch(app,/All transactions are encrypted and secured\. We use multi-factor verification for payouts/);
 assert.doesNotMatch(app,/ensure you hear\s*every new order even when the tab is in the background/);
});
