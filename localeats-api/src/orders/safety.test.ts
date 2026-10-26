import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { lifecycleStateFromOrder, type StoredOrder } from "./orderService.js";
import { assertAssignedDelivery, assertNewRiderWorkAllowed } from "./riderSafety.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { authAdmin } from "../lib/firebaseAdmin.js";
import { merchantOrderRoutes, customerOrderRoutes } from "../routes/orders.js";
import riderRoutes from "../routes/riderOrders.js";

const order = (): StoredOrder => ({id:"o", shop_id:"s", user_id:"customer", rider_id:null,
 status:"pending", delivery_status:"none", payment_method:"cash", price:25, total_price:27.5,
 delivery_fee:0, service_fee:2.5, discount_amount:0, tip_amount:0, items:[], lat:null, lng:null});

test("terminal, unknown and malformed pairs never become pending", () => {
 for (const status of ["cancelled", "collected", "completed", "rejected", "unknown", null, ""]) {
   for (const delivery_status of ["none", "finding_rider", "rider_assigned", "delivered"]) {
     assert.throws(() => lifecycleStateFromOrder({...order(), status, delivery_status}));
   }
 }
 for (const patch of [{status: ["pending"] as any}, {delivery_status:null}, {delivery_status:"delivering"}, {rider_id:"r"}, {status:"preparing", delivery_status:"finding_rider"}]) {
   assert.throws(() => lifecycleStateFromOrder({...order(), ...patch}));
 }
 assert.equal(lifecycleStateFromOrder(order()), "pending");
});

test("new work fails closed while coherent legacy assignments can drain", () => {
 assert.throws(assertNewRiderWorkAllowed);
 const assigned = {...order(), status:"ready_for_pickup", delivery_status:"rider_assigned", rider_id:"r", lat:-25.98, lng:28.2};
 assert.doesNotThrow(() => assertAssignedDelivery(assigned, "r"));
 for (const patch of [{delivery_type:"collection" as const}, {rider_id:"other"}, {lat:null}, {status:"cancelled"}]) {
   assert.throws(() => assertAssignedDelivery({...assigned, ...patch}, "r"));
 }
 assert.doesNotThrow(() => assertAssignedDelivery({...assigned, status:"delivered", delivery_status:"delivered", lat:null, lng:null}, "r"));
});

test("API ownership, race guards and Rider isolation use mocks only", async () => {
 const originalFrom = supabaseAdmin.from;
 const originalRpc = supabaseAdmin.rpc;
 const originalVerify = authAdmin.verifyIdToken;
 let saved = order(); let writes = 0; let rpcCalls = 0; let race = false; let raceTo = "cancelled";
 (authAdmin as any).verifyIdToken = async (token: string) => { if (token === "expired") throw new Error("expired"); return {uid:token}; };
 (supabaseAdmin as any).rpc = async () => {rpcCalls++; throw new Error("RPC must not run");};
 (supabaseAdmin as any).from = (table: string) => {
   const filters: Array<(row: any) => boolean> = []; let update: any;
   const query: any = {
     select: () => query, order: () => query, limit: () => query,
     eq: (key: string, value: unknown) => {filters.push(row => row[key] === value); return query;},
     is: (key: string, value: unknown) => {filters.push(row => row[key] === value); return query;},
     in: (key: string, values: unknown[]) => {filters.push(row => values.includes(row[key])); return query;},
     update: (value: unknown) => {update=value; return query;},
     maybeSingle: async () => {
       if (table === "rider_profiles") return {data:{id:"r", firebase_uid:"rider", verification_status:"approved", is_online:true}, error:null};
       if (table === "shops") return {data:{id:"s", owner_id:"merchant"}, error:null};
       if (race && update) {saved={...saved,status:raceTo}; race=false;}
       if (!filters.every(fn => fn(saved))) return {data:null,error:null};
       if (update) {writes++; saved={...saved,...update};}
       return {data:{...saved},error:null};
     }
   }; return query;
 };
 const app = express(); app.use(express.json());
 app.use("/merchant", merchantOrderRoutes); app.use("/customer", customerOrderRoutes); app.use("/rider", riderRoutes);
 const server=app.listen(0,"127.0.0.1"); await once(server,"listening");
 const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 const call=async (path:string, uid:string, method="POST") => fetch(base+path,{method,headers:{Authorization:`Bearer fb-${uid}`}});
 try {
   assert.equal((await call("/merchant/o/accept","other")).status,403);
   assert.equal((await call("/customer/o/cancel","other")).status,404);
   assert.equal(writes,0);
   saved={...order(),status:"cancelled"};
   assert.equal((await call("/merchant/o/accept","merchant")).status,409);
   saved=order(); race=true;
   assert.equal((await call("/merchant/o/accept","merchant")).status,409);
   assert.equal(writes,0);
   saved=order();
   assert.equal((await call("/merchant/o/accept","merchant")).status,200);
   assert.equal(saved.status,"preparing");
   assert.equal((await call("/customer/o/cancel","customer")).status,409);
   assert.equal((await call("/rider/available","rider","GET")).status,503);
   assert.equal((await call("/rider/o/claim","rider")).status,503);
   assert.equal((await call("/rider/o/picked-up","rider")).status,404);
   assert.equal((await call("/rider/o/delivered","rider")).status,404);
   assert.equal(rpcCalls,0);
   saved=order(); race=true; raceTo="preparing";
   assert.equal((await call("/customer/o/cancel","customer")).status,409);
   assert.equal((await call("/merchant/o/accept","expired")).status,401);
   saved={...order(), status:"ready_for_pickup", delivery_status:"rider_assigned", rider_id:"r", lat:-25.98,lng:28.2,delivery_type:"collection"};
   assert.equal((await call("/rider/o/picked-up","rider")).status,403);
   delete saved.delivery_type;
   assert.equal((await call("/rider/o/picked-up","rider")).status,200);
   assert.equal(saved.delivery_status,"picked_up");
   assert.equal((await call("/rider/o/delivering","rider")).status,200);
   assert.equal(saved.delivery_status,"delivering");
 } finally {
   supabaseAdmin.from=originalFrom; supabaseAdmin.rpc=originalRpc; authAdmin.verifyIdToken=originalVerify;
   server.close(); await once(server,"close");
 }
});
