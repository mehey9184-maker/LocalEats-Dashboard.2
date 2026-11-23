/**
 * L4-R1: Actual Customer pickup client + public browse adapter against the
 * actual compiled Merchant/API catalog router over loopback HTTP.
 * SYNTHETIC ONLY: no secrets, browser sign-in, real orders, remote services,
 * DNS, server writes, or fake GPS substituted into real browser sessions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {once} from "node:events";
import {makeCatalogRouter,parsePublicCatalogPilotIds} from "../dist/routes/catalog.js";

const customerFolder=process.env.L4_R1_CUSTOMER_CHECKOUT;
assert.ok(customerFolder,"L4-R1 Customer exact SHA checkout required");
const loadCustomer=async file=>import(pathToFileURL(join(resolve(customerFolder),file)).href);
const {createPickupApi,PickupApiError}=await loadCustomer("src/pickup/client.ts");
const {createPublicBrowseCatalogReader}=await loadCustomer("src/services/publicBrowseCatalog.ts");
const {mapPickupShop,isWithinPickupArea}=await loadCustomer("src/services/pickupMapping.ts");

const REAL_PILOT_ID="shop-my-kota-ivory-park"; // A synthetic identity label in this isolated test
const valid={id:REAL_PILOT_ID,name:"My-Kota example",location:"Fixture coordinates",category:"Kota",
  lat:-25.98,lng:28.20,is_active:false,effective_is_active:false,rating:4.8};
const excluded={...valid,id:"unverified-fixture",is_active:true,effective_is_active:true};
const menu=[{id:"synthetic-r25",shop_id:REAL_PILOT_ID,
  name:"Test kota",price:25,is_available:true}];
function repository(){
 return {
  getApprovedShops:async()=>[valid,excluded],
  getApprovedShopById:async id=>[valid,excluded].find(s=>s.id===id)??null,
  getMenuByShopId:async id=>id===REAL_PILOT_ID?menu:[]
 };
}
async function withServer(published,fn){
 const app=express(),requests=[];
 app.use((req,res,next)=>{
  requests.push({method:req.method,path:req.path,authorization:req.headers.authorization});
  if(req.method!=="GET"){res.status(405).json({success:false,error:"Test is public-read only"});return;}
  next();
 });
 app.use("/api/v1/catalog",makeCatalogRouter(repository(),published));
 const server=app.listen(0,"127.0.0.1");
 await once(server,"listening");
 const base="http://127.0.0.1:"+server.address().port;
 let tokenCount=0;
 const client=createPickupApi(base,async()=>{tokenCount++;throw Error("No auth for public discovery");},fetch);
 try {await fn({client,requests,getTokenCount:()=>tokenCount});}
 finally {server.closeAllConnections();await new Promise((ok,bad)=>server.close(e=>e?bad(e):ok()));}
}

test("Customer real public browse adapter consumes only allowed, closed My-Kota + R25 synthetic menu without ordering",async()=>{
 await withServer(new Set([REAL_PILOT_ID]),async({client,requests,getTokenCount})=>{
  const reader=createPublicBrowseCatalogReader(
    {shops:()=>client.approvedShops(),menu:(id,signal)=>client.menu(id,signal)},
    mapPickupShop,{},()=>1000);
  const result=await reader();
  assert.equal(result.incomplete,false);
  assert.equal(result.shops.length,1);
  assert.equal(result.shops[0].id,REAL_PILOT_ID);
  assert.equal(result.shops[0].isOpen,false,"Authoritative closed state must remain visible");
  assert.equal(isWithinPickupArea(result.shops[0]),false,"Unknown device GPS must not authorize ordering");
  assert.equal(result.shops[0].rating,0,"Unverified 4.8 rating must not be promoted to evidence");
  assert.equal(result.shops[0].menu[0].price,25);
  assert.equal(result.shops[0].menu[0].displayPrice,"R 25.00");
  assert.deepEqual(requests.map(x=>x.method),["GET","GET"]);
  assert.ok(requests.every(x=>!x.authorization));
  assert.equal(getTokenCount(),0);
 });
});

test("Same API preserves real-location nearby 4 km restriction, while public browse still shows closed shop",async()=>{
 await withServer(new Set([REAL_PILOT_ID]),async({client,requests})=>{
   const near=await client.shops({lat:-25.98,lng:28.20});
   const far=await client.shops({lat:-27.10,lng:28.20});
   const publicList=await client.approvedShops();
   assert.equal(near.shops.length,1);
   assert.equal(far.shops.length,0);
   assert.equal(publicList.shops.length,1);
   assert.equal(publicList.shops[0].is_active,false);
   assert.equal(requests.length,3);
   assert.ok(requests.every(x=>x.method==="GET"));
 });
});

test("Explicitly empty/invalid publication allowlist is fail-closed for Customer list and shop menu",async()=>{
 assert.equal(parsePublicCatalogPilotIds(undefined),null,"Only absent env preserves legacy public catalog");
 assert.equal(parsePublicCatalogPilotIds("").size,0);
 assert.equal(parsePublicCatalogPilotIds("invalid?").size,0);
 await withServer(new Set(),async({client,requests})=>{
  const listing=await client.approvedShops();
  assert.deepEqual(listing.shops,[]);
  await assert.rejects(client.menu(REAL_PILOT_ID),e=>e instanceof PickupApiError && e.status===404);
  assert.deepEqual(requests.map(x=>x.method),["GET","GET"]);
 });
});

test("Unpublished shop menu is denied by real server even when public Customer API explicitly asks for it",async()=>{
 await withServer(new Set([REAL_PILOT_ID]),async({client,requests})=>{
  await assert.rejects(client.menu(excluded.id),e=>e instanceof PickupApiError && e.status===404);
  assert.equal(requests.length,1);
  assert.equal(requests[0].method,"GET");
 });
});
