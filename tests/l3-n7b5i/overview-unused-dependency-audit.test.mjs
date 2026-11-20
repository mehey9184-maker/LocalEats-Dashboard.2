import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("../../src/components/DashboardOverview.tsx",import.meta.url),"utf8");
const ast=ts.createSourceFile("DashboardOverview.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const occurrences=new Map();
function traverse(node){
 if(ts.isIdentifier(node))occurrences.set(node.text,(occurrences.get(node.text)||0)+1);
 ts.forEachChild(node,traverse);
}
traverse(ast);
const hits=name=>occurrences.get(name)||0;
test("four dormant declarations are defined but never referenced or rendered",()=>{
 for(const name of ["ConnectionsSlider","DeliveryDispatchSuburbTrends","fetchRiders","driverAvailability"])
  assert.equal(hits(name),1,name+" is not actually unused");
});
test("Overview retains original protected Home layout and pickup-authority boundaries",()=>{
 assert.match(source,/export const DashboardOverview:/);
 assert.match(source,/pickupHomeOrders\(allOrders,currentShop\?\.id\)/);
 assert.match(source,/pickupReadyCount\(orders\)/);
 assert.match(source,/orderReadState==="fresh"/);
 assert.match(source,/menuReadState==="failed"/);
 assert.match(source,/onNavigate\("orders"\)/);
 assert.match(source,/onNavigate\("menu"\)/);
});
test("unused Rider dependency graph cannot safely be deleted in isolated declarations",()=>{
 assert(hits("connectedRidersCount")>=2,"driverAvailability depends on connected rider counts");
 assert(hits("connections")>=2,"connectedRidersCount depends on rider state");
 assert(hits("setConnections")>=2,"rider state writer currently lives only in unused fetchRiders");
 assert.match(source,/\.from\("rider_connections"\)/,"dead callback retains legacy data transport");
 assert.match(source,/localeats_rider_conns_/,"dead callback retains legacy rider local storage");
 assert.match(source,/Your secure cloud connection is active and backed up!/,"dead slider still has misleading demo text");
 assert.doesNotMatch(source,/<ConnectionsSlider\b|<DeliveryDispatchSuburbTrends\b/);
});
test("rendered Home preserves the existing Rider Fleet navigation instead of silently deleting UI",()=>{
 assert.match(source,/title: "Rider Fleet"/);
 assert.match(source,/onClick=\{\(\) => onNavigate\(action\.id\)\}/);
});
