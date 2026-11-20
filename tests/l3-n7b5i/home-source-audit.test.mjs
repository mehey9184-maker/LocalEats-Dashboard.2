import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const clean=readFileSync(new URL("../../src/components/DashboardOverview.tsx",import.meta.url),"utf8");
test("four old Rider/delivery Overview declarations are no longer bundled",()=>{
 for(const legacy of ["ConnectionsSlider","DeliveryDispatchSuburbTrends","fetchRiders","driverAvailability","connectedRidersCount","setConnections","RiderConnection"]){
  assert(!new RegExp("\\b"+legacy+"\\b").test(clean),"Inactive code remains: "+legacy);
 }
});
test("original pickup Home component, recovery buttons, reporting and onboarding are still present",()=>{
 for(const used of ["export const DashboardOverview","const OnboardingChecklist","pickupHomeOrders","pickupReadyCount","pickupReportCsv","onNavigate","onRefresh","onEditProfile","const exportWeeklyCSV","const trendData","const activeMenuItemsCount"]){
  assert(clean.includes(used),"Original Home contract missing "+used);
 }
 assert.match(clean,/if\(orderReadState!=="fresh"\)/);
 assert.match(clean,/menuReadState==="ready"/);
});
test("no live pickup, FCM, Rider or payment operations introduced by cleanup",()=>{
 assert.doesNotMatch(clean,/(?:sendEachForMulticast|sendNotification\(|firebase\.messaging|confirmPayment\(|transitionPickupOrder\()/);
 assert(!clean.includes('from("rider_connections")'));
 assert(!clean.includes("localeats_rider_conns_"));
});
