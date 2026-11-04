import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  merchantRiderPreviewOnly,
  merchantRiderActionsEnabled,
  merchantRiderPreviewNotice,
  merchantRiderNoRecordsNotice,
} from "../src/services/merchantRiderPreviewPolicy.ts";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const riders=read("src/components/RiderManagement.tsx");
const app=read("src/App.tsx");

test("Riders R1 does not activate rider workflows or report invented zeros",()=>{
 assert.equal(merchantRiderPreviewOnly(),true);
 assert.equal(merchantRiderActionsEnabled(),false);
 assert.match(merchantRiderPreviewNotice(),/read-only design Preview/);
 assert.match(merchantRiderNoRecordsNotice(),/This does not confirm there are no riders/);
 assert.match(riders,/Preview Only/);
 assert.match(riders,/Rider Data Unavailable/);
 assert.match(riders,/Missions Unavailable/);
 assert.match(riders,/Cash Records Unavailable/);
 assert.match(riders,/no reconciliation conclusion is possible/);
 assert.match(riders,/— Riders/);
 assert.match(riders,/— Unverified/);
 assert.match(riders,/— Unavailable/);
 assert.match(riders,/Cash and COD are not|COD and cash settlements are not loaded or verified/);
});

test("App passes no real Orders or dispatch callbacks to the read-only Riders page",()=>{
 assert.match(app,/import \{ merchantRiderPreviewOnly \} from "\.\/services\/merchantRiderPreviewPolicy"/);
 assert.match(app,/<RiderManagement[\s\S]*?previewOnly=\{merchantRiderPreviewOnly\(\)\}/);
 assert.match(app,/orders=\{merchantRiderPreviewOnly\(\) \? \[\] : orders\}/);
 assert.match(app,/onRequestRider=\{merchantRiderPreviewOnly\(\) \? \(\) => \{\} : requestRider\}/);
 assert.match(app,/sendRiderNudge=\{merchantRiderPreviewOnly\(\) \? async \(\) => \{\} : sendRiderNudge\}/);
 assert.match(app,/Storefront unavailable in Preview/);
});

test("Rider contacts, device locations and local cash records are not loaded on initial render",()=>{
 assert.match(riders,/if \(previewOnly \|\| typeof window === "undefined"\) return \[\]/);
 assert.match(riders,/!previewOnly && connections\.length === 0/);
 assert.match(riders,/const \[settledCodOrders, setSettledCodOrders\] = useState<string\[\]>\(\(\) => \{\s*if \(previewOnly\) return \[\]/);
 for(const name of ["cashTrustEnabled","allowExternalRiders","autoLookForRider"]){
   const at=riders.indexOf("const ["+name+", ");
   assert.ok(at>=0,"Missing cache state: "+name);
   assert.ok(riders.slice(at,at+230).includes("if (previewOnly) return false;"),"Cache access not protected: "+name);
 }
 assert.match(riders,/const fetchAndCacheRiders = useCallback\(async \(forceRefresh = false\) => \{\s*if \(previewOnly\) \{ setLoading\(false\); return; \}/);
 assert.match(riders,/useEffect\(\(\) => \{\s*if \(previewOnly\) return;\s*fetchConnections\(\)/);
 assert.match(riders,/\[fetchConnections, currentShop\?\.id, selectedTrackId, previewOnly\]/);
 for(const name of ["dbCashTrust","dbAllowExternal","dbAutoLookForRider"]){
   const at=riders.indexOf("if ("+name+" !== undefined)");
   assert.ok(at>=0,"Missing cache effect: "+name);
   assert.ok(riders.slice(Math.max(0,at-80),at).includes("if (previewOnly) return;"),"Cache effect not protected: "+name);
 }
});

test("Every legacy sensitive rider action has an explicit hard-disabled Preview guard",()=>{
 const names=[
  "handleSendBroadcast","generateRiderPerformanceReport","handleSettleRiderCash",
  "handleSettleAllCash","toggleCashTrust","toggleAllowExternalRiders",
  "toggleAutoLookForRider","generateCode","addInHouseRider","deleteConnection",
  "invalidateAndRegenerate","syncCodeToSupabase","claimPairingCode",
  "toggleRiderOnlineStatus","toggleAllRidersOnline"
 ];
 for(const name of names){
   const at=riders.indexOf("const "+name+" =");
   assert.ok(at>=0,"Expected action: "+name);
   const head=riders.slice(at,at+320);
   assert.match(head,/if \(previewOnly\) return; \/\/ No rider writes/,"Missing preview guard: "+name);
 }
 assert.match(riders,/disabled=\{previewOnly\}\s*onClick=\{generateRiderPerformanceReport\}/);
 assert.match(riders,/disabled=\{previewOnly\}\s*onClick=\{toggleCashTrust\}/);
 assert.match(riders,/disabled=\{previewOnly\}\s*onClick=\{toggleAllowExternalRiders\}/);
 assert.match(riders,/disabled=\{previewOnly\}\s*onClick=\{toggleAutoLookForRider\}/);
});

test("Root event capture blocks unsafe actions, while original three tabs and safe filters still work",()=>{
 assert.match(riders,/onClickCapture=\{\(event\) => \{/);
 assert.match(riders,/onChangeCapture=\{\(event\) => \{/);
 assert.match(riders,/onKeyDownCapture=\{\(event\) => \{/);
 assert.match(riders,/onSubmitCapture=\{\(event\) => \{/);
 assert.match(riders,/event\.preventDefault\(\); event\.stopPropagation\(\)/);
 assert.match(riders,/data-rider-preview-safe="true"/);
 assert.match(riders,/Rider Fleet/);
 assert.match(riders,/Deliveries \(Deferred\)/);
 assert.match(riders,/Dispatch Settings/);
 assert.match(riders,/statusFilter === chip\.id/);
 assert.match(riders,/setActiveSubTab\(tab\.id/);
 assert.match(riders,/Fleet Command Center/);
 assert.match(riders,/grid grid-cols-2 lg:grid-cols-4 gap-3/);
});

test("Pairing, broadcasts, COD reports and promises are clearly unavailable",()=>{
 assert.match(riders,/Pairing Unavailable/);
 assert.match(riders,/Broadcast Unavailable/);
 assert.match(riders,/Financial export unavailable without a verified settlement ledger/);
 assert.match(riders,/Rider records are not loaded in Preview/);
 assert.match(riders,/No COD guarantee, banner, dispatch or checkout feature is activated/);
 assert.match(riders,/Preview Only — Not a Plan Benefit/);
 assert.match(riders,/External riders cannot be activated or assigned from this Preview/);
 assert.match(riders,/Automatic rider dispatch is unavailable/);
 assert.match(riders,/Rider and delivery features are deferred|Fleet layout only/);
});
