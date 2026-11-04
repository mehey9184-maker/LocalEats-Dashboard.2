import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  merchantSettingsS3WritesEnabled,pickupMethodRecordLabel,
  merchantSettingsS3PickupNotice,merchantSettingsS3DeliveryNotice
} from "../src/services/merchantSettingsS3Trust.ts";
import {merchantSettingsOperationalWritesEnabled} from "../src/services/merchantSettingsOperationalPreview.ts";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("src/App.tsx"),location=read("src/components/LocationSyncIndicator.tsx");
const section=(begin,end)=>app.slice(app.indexOf(begin),app.indexOf(end,app.indexOf(begin)));
const pickup=section('{settingsCategory === "pickup-payments" && currentShop && (','{settingsCategory === "diagnostics" && (');
const delivery=section('{settingsCategory === "delivery" && (','{settingsCategory === "hardware" && (');

test("S3 never enables shop writes, payment settings or delivery",()=>{
 assert.equal(merchantSettingsS3WritesEnabled(),false);
 assert.equal(merchantSettingsOperationalWritesEnabled(),false);
 assert.match(app,/settingsPreviewPanelRef/);
 assert.match(app,/element.inert = true/);
 assert.match(pickup,/merchantSettingsS3PickupNotice\(\)/);
 assert.match(delivery,/merchantSettingsS3DeliveryNotice\(\)/);
 assert.match(merchantSettingsS3PickupNotice(),/not verified card-terminal connections/);
 assert.match(merchantSettingsS3DeliveryNotice(),/Delivery and riders are deferred/);
});

test("pickup methods label only supported shop records without inferring payments",()=>{
 assert.equal(pickupMethodRecordLabel(undefined),"No verified pickup methods available");
 assert.equal(pickupMethodRecordLabel(null),"No verified pickup methods available");
 assert.equal(pickupMethodRecordLabel([]),"No verified pickup methods available");
 assert.equal(pickupMethodRecordLabel(["cash"]),"Shop record lists cash at shop");
 assert.equal(pickupMethodRecordLabel(["card_machine"]),"Shop record lists physical card machine at shop");
 assert.equal(pickupMethodRecordLabel(["card_machine","cash"]),"Shop record lists cash or physical card machine");
 for(const bad of [["cod"],["cash","cash"],["cash","card_machine","other"],["credit"],[null]]){
  assert.equal(pickupMethodRecordLabel(bad),"Pickup methods unavailable or unsupported");
 }
 assert.match(pickup,/Recorded settings \(not proof of payment\): \{pickupMethodRecordLabel\(currentShop.pickup_payment_methods\)\}/);
 assert.doesNotMatch(pickup,/Saved:|Card only|Payment methods are not configured yet/);
});

test("pickup-payment radio selection and API save fail closed even if env activation later changes",()=>{
 assert.match(pickup,/disabled=\{!merchantSettingsS3WritesEnabled\(\)\}/);
 assert.match(pickup,/onChange=\{\(\)=>\{if\(merchantSettingsS3WritesEnabled\(\)\)setPickupPaymentChoice\(value\);\}\}/);
 assert.match(pickup,/disabled=\{savingPickupPayments \|\| !pickupPaymentSettingsEnabled\(\) \|\| !merchantSettingsS3WritesEnabled\(\)\}/);
 assert.match(pickup,/Save methods — Unavailable/);
 assert.match(app,/if\(!currentShop \|\| savingPickupPayments \|\| !pickupPaymentSettingsEnabled\(\) \|\| !merchantSettingsS3WritesEnabled\(\)\)return;/);
 assert.match(pickup,/This screen does not verify that a card terminal is connected/);
 assert.match(pickup,/real pickup ordering require separate approval/);
});

test("deferred delivery does not present mock fees, radius or minimum as live",()=>{
 assert.match(delivery,/Delivery Deferred/);
 assert.match(delivery,/Example Only/);
 assert.match(delivery,/Example radius control only/);
 assert.match(delivery,/Example Delivery Fee \(R\) — Not Charged/);
 assert.match(delivery,/Example Free-Delivery Threshold — Not Active/);
 assert.match(delivery,/Example Delivery Minimum — Not Enforced/);
 assert.match(delivery,/not a live service or collection radius/);
 assert.doesNotMatch(delivery,/Live Radius Engine|>Active<\/span>/);
});

test("delivery edit controls cannot change local or remote shop state in Preview",()=>{
 assert.match(delivery,/disabled=\{!merchantSettingsS3WritesEnabled\(\)\}/);
 assert.match(delivery,/if\(!merchantSettingsS3WritesEnabled\(\)\) return;\s*if \(!currentShop\?\.id\)/);
 assert.match(delivery,/Save Delivery — Unavailable/);
 assert.match(delivery,/onClick=\{\(\) => \{if\(merchantSettingsS3WritesEnabled\(\)\)setDeliverySettings/);
 assert.match(delivery,/onChange=\{\(e\) => \{if\(merchantSettingsS3WritesEnabled\(\)\)setDeliverySettings/);
 assert.match(delivery,/onSave=\{merchantSettingsS3WritesEnabled\(\) \? \(\) => saveShopLocationSettings\(\) : undefined\}/);
 assert.match(delivery,/onAutoAlign=\{merchantSettingsS3WritesEnabled\(\) \? autoAlignShopCity : undefined\}/);
 assert.match(delivery,/onDetectGPS=\{merchantSettingsS3WritesEnabled\(\) \? detectShopGPS : undefined\}/);
});

test("LocationSyncIndicator only claims verified or active zones outside preview",()=>{
 assert.match(location,/previewOnly\?: boolean/);
 assert.match(location,/previewOnly = false/);
 assert.match(location,/if\(previewOnly\)return \{/);
 assert.match(location,/title: "Location Preview — Not Verified"/);
 assert.match(location,/tag: "Not Activated"/);
 assert.match(location,/previewOnly \? "Shop location and area are shown for design inspection only/);
 assert.match(location,/previewOnly \? "Not active in Preview" : locationState.deliveryRadiusEnabled/);
 assert.match(location,/disabled=\{previewOnly \|\| isVerifying\}/);
 assert.match(location,/!previewOnly && showDetails/);
 assert.match(delivery,/previewOnly=\{!merchantSettingsS3WritesEnabled\(\)\}/);
});

test("S3 retains original tabs, cards and earlier subscription/billing safeguards",()=>{
 assert.match(app,/onClick=\{\(\) => setSettingsCategory\(category.id\)\}/);
 assert.match(app,/id: "pickup-payments"/);
 assert.match(app,/id: "delivery"/);
 assert.match(app,/id: "hardware"/);
 assert.match(pickup,/space-y-4 animate-in fade-in/);
 assert.match(delivery,/w-full flex flex-col p-5 bg-surface-container-low rounded-2xl/);
 assert.match(app,/SettingsBillingPreview/);
 assert.match(app,/merchantSettingsOperationsNotice\(\)/);
 assert.match(app,/merchantSettingsHardwareNotice\(\)/);
});
