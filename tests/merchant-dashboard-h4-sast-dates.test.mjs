import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {merchantJohannesburgDayKey,merchantDailyOrderCounts} from "../src/services/merchantDashboardLayout.ts";

test("merchant calendar day uses Johannesburg time rather than UTC or browser time",()=>{
  assert.equal(merchantJohannesburgDayKey("2026-11-03T21:59:00Z"),"2026-11-03");
  assert.equal(merchantJohannesburgDayKey("2026-11-03T22:00:00Z"),"2026-11-04");
  assert.equal(merchantJohannesburgDayKey("2026-11-03T00:15:00+02:00"),"2026-11-03");
  for(const raw of ["",null,undefined,"not-a-date"])assert.equal(merchantJohannesburgDayKey(raw),null);
});

test("today and yesterday reflect the same SAST date cutoffs",()=>{
  const orders=[
    {created_at:"2026-11-03T22:10:00Z"},
    {created_at:"2026-11-03T21:59:00Z"},
    {created_at:"2026-11-02T22:30:00Z"},
    {created_at:"2026-11-02T21:59:00Z"},
    {created_at:"invalid"},
  ];
  assert.deepEqual(
    merchantDailyOrderCounts(orders,new Date("2026-11-03T22:15:00Z")),
    {today:1,yesterday:2},
  );
});

test("Home totals use SAST helper and update at next verified read",()=>{
  const overview=readFileSync(new URL("../src/components/DashboardOverview.tsx",import.meta.url),"utf8");
  assert.match(overview,/merchantDailyOrderCounts\(orders\),\[orders,ordersVerifiedAt\]/);
  assert.doesNotMatch(overview,/yesterday\.toISOString\(\)\.split\("T"\)/);
});
