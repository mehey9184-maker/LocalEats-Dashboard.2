import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import {makeCatalogRouter,type CatalogRepository} from "./catalog.js";

const shop={
 id:"shop-safe",name:"Kota",location:"Ivory Park",description:"Fresh",
 category:"Kota",logo_url:"https://example.invalid/logo.png",
 is_active:false,lat:-25.98,lng:28.2,
 phone:"+27-SYNTHETIC-PRIVATE",owner_id:"uid-private",
 owner_email:"private@example.invalid",approval_status:"approved",
 availability_revision:900,private_notes:"do not expose",
 access_token:"synthetic-token",
};
const item={
 id:"item-1",shop_id:"shop-safe",name:"Kota",price:25,is_available:true,
 supplier_cost:10,private_notes:"internal",owner_email:"private@example.invalid",
 customizations:[{cost_internal:9}],bank_account:"not-public",
};
const fixtures:CatalogRepository={
 getApprovedShops:async()=>[shop],
 getApprovedShopById:async id=>id==="shop-safe"?shop:null,
 getMenuByShopId:async()=>[item],
};
async function serve(run:(base:string)=>Promise<void>){
 const app=express();app.use("/api/v1/catalog",makeCatalogRouter(fixtures));
 const server=http.createServer(app);
 await new Promise<void>(ok=>server.listen(0,"127.0.0.1",ok));
 try {
  const addr=server.address();
  if(!addr || typeof addr==="string")throw Error("bad local test server");
  await run("http://127.0.0.1:"+addr.port);
 } finally {await new Promise<void>(ok=>server.close(()=>ok()));}
}
const mustNotLeak=["owner_id","owner_email","phone","approval_status",
  "availability_revision","private_notes","access_token","supplier_cost",
  "bank_account","customizations"];
const assertClean=(obj:Record<string,unknown>)=>{
 for(const key of mustNotLeak)assert.equal(Object.hasOwn(obj,key),false,key);
 assert.equal(JSON.stringify(obj).includes("private@example.invalid"),false);
 assert.equal(JSON.stringify(obj).includes("SYNTHETIC-PRIVATE"),false);
};
test("N8L mounted GET /shops returns only approved scalar display fields",async()=>{
 await serve(async base=>{
  const response=await fetch(base+"/api/v1/catalog/shops");
  assert.equal(response.status,200);
  const json=await response.json();
  assert.equal(json.success,true);
  assert.equal(json.shops[0].name,"Kota");
  assert.equal(json.shops[0].is_active,false);
  assertClean(json.shops[0]);
 });
});
test("N8L shop detail and private menu metadata never escape public catalog",async()=>{
 await serve(async base=>{
  const detail=await (await fetch(base+"/api/v1/catalog/shops/shop-safe")).json();
  assert.equal(detail.shop.id,"shop-safe");
  assertClean(detail.shop);
  const menu=await (await fetch(base+"/api/v1/catalog/shops/shop-safe/menu")).json();
  assert.equal(menu.menu_items[0].price,25);
  assertClean(menu.menu_items[0]);
  assert.equal(menu.menu_items[0].customizations,undefined);
 });
});
test("N8L pickup geo-filtered public catalog cannot reintroduce private shop fields",async()=>{
 await serve(async base=>{
  const r=await fetch(base+"/api/v1/catalog/pickup-shops?lat=-25.98&lng=28.2");
  assert.equal(r.status,200);
  const result=await r.json();
  assert.equal(result.shops.length,1);
  assert.equal(result.shops[0].distance_km,0);
  assert.equal(result.shops[0].is_active,false);
  assertClean(result.shops[0]);
  const invalid=await fetch(base+"/api/v1/catalog/pickup-shops?lat=nan&lng=28.2");
  assert.equal(invalid.status,400);
 });
});
test("N8L unapproved/unmatched shop detail cannot leak a menu",async()=>{
 await serve(async base=>{
  assert.equal((await fetch(base+"/api/v1/catalog/shops/no-such-shop")).status,404);
  assert.equal((await fetch(base+"/api/v1/catalog/shops/no-such-shop/menu")).status,404);
 });
});
