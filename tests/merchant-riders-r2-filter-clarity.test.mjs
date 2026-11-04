import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {merchantRiderPreviewOnly,merchantRiderActionsEnabled} from "../src/services/merchantRiderPreviewPolicy.ts";
const rider=readFileSync(new URL("../src/components/RiderManagement.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");

test("R2 makes only local search, status filter and tab navigation safe",()=>{
 assert.equal(merchantRiderPreviewOnly(),true);
 assert.equal(merchantRiderActionsEnabled(),false);
 assert.match(rider,/data-rider-preview-safe="true"\s*onClick=\{\(\) => setStatusFilter\("all"\)\}/);
 assert.match(rider,/data-rider-preview-safe="true"\s*aria-pressed=\{statusFilter === "online"\}\s*onClick=\{\(\) => setStatusFilter\(statusFilter === "online" \? "all" : "online"\)\}/);
 assert.match(rider,/data-rider-preview-safe="true"\s*aria-pressed=\{statusFilter === chip\.id\}\s*onClick=\{\(\) => setStatusFilter\(chip\.id/);
 assert.match(rider,/data-rider-preview-safe="true"\s*aria-pressed=\{isActive\}\s*onClick=\{\(\) => setActiveSubTab\(tab\.id/);
 assert.match(rider,/data-rider-preview-safe="true"\s*value=\{searchQuery\}\s*onChange=\{\(e\) => setSearchQuery\(e.target.value\)\}/);
});

test("Online summary filters safely, but nested fleet activation never runs in Preview",()=>{
 assert.match(rider,/if \(previewOnly\) return;\s*const allOnline = connections.every/);
 assert.match(rider,/aria-disabled=\{previewOnly\}/);
 assert.match(rider,/Fleet Status Unavailable/);
 assert.match(rider,/Fleet status changes require live delivery activation/);
 assert.match(rider,/const toggleAllRidersOnline = async \(targetStatus = true\) => \{\s*if \(previewOnly\) return;/);
 assert.match(rider,/onClickCapture=\{\(event\) => \{/);
 assert.match(rider,/!target\.closest\('\[data-rider-preview-safe="true"\]'\)/);
});

test("Rider empty state explains not-loaded data instead of false zero or no matches",()=>{
 assert.match(rider,/previewOnly\s*\? "Rider Data Unavailable"/);
 assert.match(rider,/Filters are for reviewing this layout only; no rider records are loaded/);
 assert.match(rider,/This does not mean your shop has no riders/);
 assert.match(rider,/previewOnly \? "Records unavailable"/);
 assert.match(rider,/previewOnly \? "— Unverified"/);
 assert.match(rider,/previewOnly \? "— Unavailable"/);
 assert.match(rider,/previewOnly \? "Unverified"/);
 assert.match(rider,/previewOnly \? "🟢 Online \(—\)"/);
 assert.match(rider,/placeholder=\{previewOnly \? "Search layout \(rider records unavailable\)"/);
});

test("Clear filters works for status or search-only and keeps customer/rider data isolated",()=>{
 assert.match(rider,/\(statusFilter !== "all" \|\| \(previewOnly && searchQuery\.trim\(\)\.length > 0\)\)/);
 assert.match(rider,/data-rider-preview-safe="true"\s*onClick=\{\(\) => \{ setSearchQuery\(""\); setStatusFilter\("all"\); \}\}/);
 assert.match(rider,/previewOnly \? "Clear filters"/);
 assert.match(rider,/Rider records are not loaded in Preview/);
 assert.doesNotMatch(app,/<RiderManagement\b/);
 assert.match(app,/Rider management is not available yet/);
});

test("R2 clearly describes unavailable pairing, communication, staff and GPS without changes",()=>{
 assert.match(rider,/disabled=\{previewOnly\}\s*onClick=\{generateRiderPerformanceReport\}/);
 assert.match(rider,/Rider pairing is unavailable in Preview/);
 assert.match(rider,/Rider messaging is unavailable in Preview/);
 assert.match(rider,/QR pairing requires delivery activation/);
 assert.match(rider,/Staff registration requires an authorised rider workflow/);
 assert.match(rider,/Staff Registration Unavailable/);
 assert.match(rider,/Live GPS refresh is unavailable in Preview/);
 assert.match(rider,/disabled=\{previewOnly\}\s*onClick=\{\(\) => \{ if\(!previewOnly\)void fetchConnections\(\); \}\}/);
 assert.match(rider,/disabled=\{previewOnly\}\s*onClick=\{toggleCashTrust\}/);
 assert.match(rider,/disabled=\{previewOnly\}\s*onClick=\{toggleAllowExternalRiders\}/);
 assert.match(rider,/disabled=\{previewOnly\}\s*onClick=\{toggleAutoLookForRider\}/);
});

test("R2 preserves original Rider layout, three tabs and approved subscription separation",()=>{
 assert.match(rider,/Fleet Command Center/);
 assert.match(rider,/grid grid-cols-2 lg:grid-cols-4 gap-3/);
 assert.match(rider,/Rider Fleet/);
 assert.match(rider,/Deliveries \(Deferred\)/);
 assert.match(rider,/Dispatch Settings/);
 assert.match(rider,/No COD guarantee, banner, dispatch or checkout feature is activated/);
 assert.match(rider,/Preview Only — Not a Plan Benefit/);
 assert.match(rider,/const fetchAndCacheRiders = useCallback\(async \(forceRefresh = false\) => \{\s*if \(previewOnly\)/);
 assert.match(rider,/useEffect\(\(\) => \{\s*if \(previewOnly\) return;\s*fetchConnections\(\)/);
});
