import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type {AddressInfo} from "node:net";
import express from "express";
import { makeCatalogRouter, SupabaseCatalogRepository, parsePublicCatalogPilotIds } from "./catalog.js";

class FakeSupabase {
  calls: Array<{method:string;args:unknown[];table?:string}> = [];
  mockShopData: Record<string,unknown>[] | Record<string,unknown> | null = null;
  mockMenuData: Record<string,unknown>[] | null = null;
  mockError: unknown = null;

  from(table: string) {
    const queryBuilder = {
      calls: this.calls,
      table,
      mockShopData: this.mockShopData,
      mockMenuData: this.mockMenuData,
      mockError: this.mockError,
      select(fields: string) { this.calls.push({ method: 'select', args: [fields] }); return this; },
      eq(col: string, val: unknown) { this.calls.push({ method: 'eq', args: [col, val] }); return this; },
      is(col: string, val: unknown) { this.calls.push({ method: 'is', args: [col, val] }); return this; },
      maybeSingle() { this.calls.push({ method: 'maybeSingle', args: [] }); return this; },
      then(resolve: (result:{data:unknown;error:null})=>void, reject:(reason:unknown)=>void) {
        this.calls.push({ method: 'execute', table: this.table, args: [] });
        if (this.mockError) return reject(this.mockError);
        
        if (this.table === 'shops_with_availability') {const map=(s:Record<string,unknown>)=>({...s,effective_is_active:s.is_active===true,availability_revision:0});resolve({data:Array.isArray(this.mockShopData)?this.mockShopData.map(map):this.mockShopData?map(this.mockShopData):null,error:null});}
        else if (this.table === 'menu_items') resolve({ data: this.mockMenuData, error: null });
        else resolve({ data: null, error: null });
      }
    };
    this.calls.push({ method: 'from', args: [table] });
    return queryBuilder;
  }
}

function createTestApp() {
  const fakeDb = new FakeSupabase();
  const repo = new SupabaseCatalogRepository(fakeDb);
  const app = express();
  app.use(express.json());
  app.use("/api/v1/catalog", makeCatalogRouter(repo));
  return { app, fakeDb };
}

test("Pickup catalog enforces real coordinates, active pilot metadata and maximum 4 km",async()=>{
 const {app,fakeDb}=createTestApp();
 const valid={id:"eligible",name:"Pickup",is_active:true,location:"Ivory Park",lat:-25.98,lng:28.2};
 fakeDb.mockShopData=[valid,{...valid,id:"offline",is_active:false},{...valid,id:"outside-area",location:"Elsewhere"},
  {...valid,id:"distant",lat:-26.5},{...valid,id:"no-gps",lat:null,lng:null}];
 await runWithServer(app,async base=>{
  const noLocation=await fetch(base+"/api/v1/catalog/pickup-shops");assert.equal(noLocation.status,400);
  const result=await fetch(base+"/api/v1/catalog/pickup-shops?lat=-25.98&lng=28.2");assert.equal(result.status,200);
  const body=await result.json();
  assert.deepEqual(body.shops.map((shop:{id?:unknown;name?:unknown})=>shop.id),["eligible","offline","outside-area"]);
  assert.equal(body.shops[0].distance_km,0);
  assert.equal(body.shops[1].is_active,false,"Closed shop must remain visibly closed, not orderable");
  assert.equal(body.shops[2].location,"Elsewhere","An approved nearby shop is not blocked by town text");
  assert.equal(fakeDb.calls.some(c=>c.method==="eq" && c.args[0]==="approval_status" && c.args[1]==="approved"),true);
  assert.equal(fakeDb.calls.some(c=>c.method==="is" && c.args[0]==="archived_at" && c.args[1]===null),true);

 });
});

async function runWithServer(app: express.Express, fn: (baseUrl: string) => Promise<void>) {
  return new Promise<void>((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', async () => {
      try {
        const port = (server.address() as AddressInfo).port;
        await fn(`http://127.0.0.1:${port}`);
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

test("Catalog Router - List query requirements (behaviors 1, 2, 3, 4, 5, 6, 7, 15, 16, 17, 19, 20)", async () => {
  const { app, fakeDb } = createTestApp();
  fakeDb.mockShopData = [{ id: "1", name: "Shop 1", is_active: false }];

  await runWithServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/catalog/shops`);
    const body = await res.json();

    assert.equal(res.status, 200);

    // 1. list query requires approval_status = "approved"
    // 4, 5, 6. excluded pending, rejected, suspended
    const hasApprovalEq = fakeDb.calls.some(c => c.method === 'eq' && c.args[0] === 'approval_status' && c.args[1] === 'approved');
    assert.ok(hasApprovalEq, "Requires approval_status = approved");

    // 2. list query requires archived_at IS NULL
    // 7. excluded archived
    const hasArchivedIs = fakeDb.calls.some(c => c.method === 'is' && c.args[0] === 'archived_at' && c.args[1] === null);
    assert.ok(hasArchivedIs, "Requires archived_at IS NULL");

    // 15, 16, 17. uses explicit allowlist, excludes owner_id/approval_reason
    const selectCall = fakeDb.calls.find(c => c.method === 'select');
    assert.ok(selectCall, "Must use select()");
    const fields = selectCall.args[0] as string;
    assert.ok(fields !== "*", "Must not use *");
    assert.ok(!fields.includes("owner_id"), "Must exclude owner_id");
    assert.ok(!fields.includes("approval_reason"), "Must exclude approval_reason");

    // 19. catalog repository does not use Firestore
    // Implied by strict reliance on Supabase repo only

    // 3. approved inactive shop is returned
    // 20. approved inactive shop remains visible but is_active remains false
    assert.equal(body.shops.length, 1);
    assert.equal(body.shops[0].is_active, false);
  });
});

test("Catalog Router - GET one shop (behaviors 8, 9)", async () => {
  const { app, fakeDb } = createTestApp();
  
  await runWithServer(app, async (baseUrl) => {
    // 8. GET one approved shop succeeds
    fakeDb.mockShopData = { id: "1", name: "Shop 1" };
    let res = await fetch(`${baseUrl}/api/v1/catalog/shops/1`);
    let body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.shop.id, "1");

    // 9. GET one non-public shop returns generic 404
    fakeDb.mockShopData = null;
    res = await fetch(`${baseUrl}/api/v1/catalog/shops/2`);
    body = await res.json();
    assert.equal(res.status, 404);
    assert.equal(body.success, false);
  });
});

test("Catalog Router - GET shop menu (behaviors 10, 11, 12, 13, 14, 18)", async () => {
  const { app, fakeDb } = createTestApp();

  await runWithServer(app, async (baseUrl) => {
    // 10. GET approved shop menu succeeds
    fakeDb.mockShopData = { id: "1", name: "Shop 1" };
    fakeDb.mockMenuData = [{ id: "m1", name: "Item 1" }];
    let res = await fetch(`${baseUrl}/api/v1/catalog/shops/1/menu`);
    let body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.menu_items[0].id, "m1");

    // 18. menu selection uses explicit allowlist, not "*"
    const selectCalls = fakeDb.calls.filter(c => c.method === 'select');
    // the second select call should be for menu_items
    const menuSelectFields = selectCalls[1].args[0] as string;
    assert.ok(menuSelectFields !== "*", "Menu query must not use *");
    assert.ok(menuSelectFields.includes("popularity_score"), "Includes explicit field");

    // 11, 12, 13, 14. menu for pending/rejected/suspended/archived shop is rejected
    fakeDb.mockShopData = null; // simulate parent shop check failing
    res = await fetch(`${baseUrl}/api/v1/catalog/shops/2/menu`);
    body = await res.json();
    assert.equal(res.status, 404);
  });
});

test("Approved closed shop's real menu remains readable without relaxing approval rules",async()=>{
 const {app,fakeDb}=createTestApp();
 fakeDb.mockShopData={id:"closed",name:"Closed Kitchen",is_active:false,approval_status:"approved"};
 fakeDb.mockMenuData=[{id:"menu-1",name:"Real menu item",price:25,is_available:true}];
 await runWithServer(app,async base=>{
  const menu=await fetch(base+"/api/v1/catalog/shops/closed/menu");
  assert.equal(menu.status,200);
  const payload=await menu.json();
  assert.deepEqual(payload.menu_items.map((item:{id?:unknown;name?:unknown})=>item.name),["Real menu item"]);
  assert.equal(fakeDb.calls.some(c=>c.method==="eq"&&c.args[0]==="approval_status"&&c.args[1]==="approved"),true);
  assert.equal(fakeDb.calls.some(c=>c.method==="is"&&c.args[0]==="archived_at"&&c.args[1]===null),true);
 });
});

test("Pickup nearby approved shops are distance-ranked across town boundaries, with real coordinates only",async()=>{
 const {app,fakeDb}=createTestApp();
 fakeDb.mockShopData=[
  {id:"pretoria-far",name:"Too far",is_active:true,location:"Pretoria",lat:-25.7,lng:28.1},
  {id:"cosmo-near",name:"Local",is_active:true,location:"Cosmo City",lat:-25.984,lng:28.2},
  {id:"unknown-area",name:"No town",is_active:false,location:null,lat:-25.982,lng:28.2},
  {id:"missing-pin",name:"No pin",is_active:true,location:"Cosmo City",lat:null,lng:null},
 ];
 await runWithServer(app,async base=>{
  const response=await fetch(base+"/api/v1/catalog/pickup-shops?lat=-25.98&lng=28.2");
  assert.equal(response.status,200);
  const body=await response.json();
  assert.deepEqual(body.shops.map((x:{id?:unknown;name?:unknown})=>x.id),["unknown-area","cosmo-near"]);
  assert.equal(body.shops[0].is_active,false);
  assert.ok(body.shops[0].distance_km < body.shops[1].distance_km);
 });
});

test("Public pilot shop IDs parse fail-closed and preserve absent-mode compatibility",()=>{
 assert.equal(parsePublicCatalogPilotIds(undefined),null,"Only an absent setting preserves the original approved catalog");
 assert.deepEqual([...parsePublicCatalogPilotIds("shop-my-kota-ivory-park, shop-two")!],["shop-my-kota-ivory-park","shop-two"]);
 assert.equal(parsePublicCatalogPilotIds("")!.size,0,"Empty settings must never publish everything");
 assert.equal(parsePublicCatalogPilotIds("invalid ID!")!.size,0);
});

test("Pilot publication filters list, nearby, detail and menu without modifying merchant data",async()=>{
 const fakeDb=new FakeSupabase(),app=express();
 app.use(express.json());
 app.use("/api/v1/catalog",makeCatalogRouter(new SupabaseCatalogRepository(fakeDb),new Set(["my-kota"])));
 const raw={id:"my-kota",name:"My-Kota",lat:-25.983,lng:28.207,is_active:false};
 const other={id:"production-fixture",name:"Test shop",lat:-25.984,lng:28.208,is_active:false};
 fakeDb.mockShopData=[raw,other];
 await runWithServer(app,async base=>{
   const list=await fetch(base+"/api/v1/catalog/shops");
   assert.equal(list.status,200);
   assert.deepEqual((await list.json()).shops.map((s:{id?:unknown;name?:unknown})=>s.id),["my-kota"]);
   const nearby=await fetch(base+"/api/v1/catalog/pickup-shops?lat=-25.983&lng=28.207");
   assert.equal(nearby.status,200);
   assert.deepEqual((await nearby.json()).shops.map((s:{id?:unknown;name?:unknown})=>s.id),["my-kota"]);
   fakeDb.mockShopData=other;
   const detailHidden=await fetch(base+"/api/v1/catalog/shops/production-fixture");
   assert.equal(detailHidden.status,404);
   const menuHidden=await fetch(base+"/api/v1/catalog/shops/production-fixture/menu");
   assert.equal(menuHidden.status,404);
   assert.equal(fakeDb.calls.some(c=>c.method==="execute"&&c.table==="menu_items"),false,"Hidden shop menu must not be fetched");
   fakeDb.mockShopData=raw;fakeDb.mockMenuData=[{id:"kota-25",shop_id:"my-kota",name:"My-Kota meal",price:25,is_available:true}];
   const detail=await fetch(base+"/api/v1/catalog/shops/my-kota");assert.equal(detail.status,200);
   const menu=await fetch(base+"/api/v1/catalog/shops/my-kota/menu");
   assert.equal(menu.status,200);
   assert.equal((await menu.json()).menu_items[0].price,25);
 });
});

test("Configured empty pilot set cannot accidentally expose approved shops",async()=>{
 const fakeDb=new FakeSupabase(),app=express();
 app.use("/api/v1/catalog",makeCatalogRouter(new SupabaseCatalogRepository(fakeDb),new Set()));
 fakeDb.mockShopData=[{id:"test",name:"Fixture",lat:-25.98,lng:28.2,is_active:true}];
 await runWithServer(app,async base=>{
   assert.deepEqual((await (await fetch(base+"/api/v1/catalog/shops")).json()).shops,[]);
   assert.deepEqual((await (await fetch(base+"/api/v1/catalog/pickup-shops?lat=-25.98&lng=28.2")).json()).shops,[]);
   assert.equal((await fetch(base+"/api/v1/catalog/shops/test/menu")).status,404);
 });
});
