import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  merchantSettingsOperationalWritesEnabled,
  merchantSettingsOperationsNotice,
  merchantSettingsHardwareNotice,
} from "../src/services/merchantSettingsOperationalPreview.ts";

const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
const section=(begin,end)=>app.slice(app.indexOf(begin),app.indexOf(end,app.indexOf(begin)));
const ops=section('{settingsCategory === "operations" && (','{settingsCategory === "delivery" && (');
const hardware=section('{settingsCategory === "hardware" && (','{settingsCategory === "account" && (');

test("S1 read-only boundary still covers Settings while original navigation works",()=>{
 assert.equal(merchantSettingsOperationalWritesEnabled(),false);
 assert.match(app,/settingsPreviewPanelRef/);
 assert.match(app,/element\.inert = true/);
 assert.match(app,/onClickCapture=\{\(event\) => \{ event\.preventDefault\(\); event\.stopPropagation\(\); \}\}/);
 assert.match(app,/onClick=\{\(\) => setSettingsCategory\(category.id\)\}/);
 assert.match(app,/id: "operations"/);
 assert.match(app,/id: "hardware"/);
});

test("Operations no longer promises live ordering or a confirmed calendar",()=>{
 assert.match(merchantSettingsOperationsNotice(),/do not confirm online ordering/);
 assert.match(ops,/merchantSettingsOperationsNotice\(\)/);
 assert.match(ops,/Shop open\/closed setting only; real pickup ordering is not active/);
 assert.match(ops,/Preparation-time example only/);
 assert.match(ops,/Schedule status requires server verification/);
 assert.match(ops,/Holiday Date Range — Not Active/);
 assert.match(ops,/Operating Hours \(Preview\)/);
 assert.match(ops,/Save Hours — Unavailable/);
 assert.doesNotMatch(ops,/Are you currently accepting new orders\?|Holiday Mode disabled\. Your store is now accepting orders/);
});

test("Shop status, holiday control and opening-hour writes fail closed",()=>{
 assert.match(ops,/disabled=\{availabilityBusy \|\| !merchantSettingsOperationalWritesEnabled\(\)\}/);
 assert.match(ops,/if \(!currentShop \|\| availabilityBusy \|\| !merchantSettingsOperationalWritesEnabled\(\)\) return;/);
 assert.match(ops,/disabled=\{!merchantSettingsOperationalWritesEnabled\(\)\}/);
 assert.match(ops,/onChange=\{async \(e\) => \{\s*if\(!merchantSettingsOperationalWritesEnabled\(\)\) return;\s*const currentSchedule/);
 assert.match(ops,/onClick=\{async \(\) => \{\s*if\(!merchantSettingsOperationalWritesEnabled\(\)\) return;\s*const \{ data: updateRes, error \}/);
 assert.match(ops,/onClick=\{\(\) => \{\s*if\(!merchantSettingsOperationalWritesEnabled\(\)\) return;\s*const monday/);
 assert.match(ops,/type="date"\s*disabled=\{!merchantSettingsOperationalWritesEnabled\(\)\}/);
 assert.match(ops,/type="time"\s*disabled=\{!merchantSettingsOperationalWritesEnabled\(\)\}/);
});

test("Hardware does not claim card-terminal linking, order auto-accept or printer connection",()=>{
 assert.match(merchantSettingsHardwareNotice(),/No card-terminal pairing/);
 assert.match(hardware,/merchantSettingsHardwareNotice\(\)/);
 assert.match(hardware,/Terminal Integration — Not Connected/);
 assert.match(hardware,/Card Terminal Verification — Unavailable/);
 assert.match(hardware,/Terminal Provider \(Not Linked\)/);
 assert.match(hardware,/Terminal Serial \(Not Verified\)/);
 assert.match(hardware,/Order auto-accept is not activated/);
 assert.match(hardware,/Receipt auto-print is not connected or verified/);
 assert.match(hardware,/No printer configuration is saved/);
 assert.match(hardware,/Sample receipt layouts only/);
 assert.match(hardware,/Printer network address \(example only\)/);
 assert.doesNotMatch(hardware,/Attempting test print to network printer|Auto-print enabled|Auto-Accept disabled/);
});

test("Direct hardware actions cannot mutate settings, print, or announce success",()=>{
 assert.match(hardware,/type="checkbox"\s*disabled=\{!merchantSettingsOperationalWritesEnabled\(\)\}/);
 assert.match(hardware,/<select\s*disabled=\{!merchantSettingsOperationalWritesEnabled\(\)\}/);
 assert.match(hardware,/onBlur=\{async \(e\) => \{\s*if\(!merchantSettingsOperationalWritesEnabled\(\)\) return;/);
 assert.match(hardware,/disabled=\{!merchantSettingsOperationalWritesEnabled\(\)\}/);
 assert.match(hardware,/if\(!merchantSettingsOperationalWritesEnabled\(\)\) return;\s*if \(!autoAcceptOrders\)/);
 assert.match(hardware,/if\(!merchantSettingsOperationalWritesEnabled\(\)\) return;\s*const nextState = !autoPrint/);
 assert.match(hardware,/Test Print — Unavailable/);
 assert.match(hardware,/Printer test unavailable until a verified device integration exists/);
 assert.doesNotMatch(hardware,/onClick=\{\(\) => toast\.success\("Attempting test print/);
});
