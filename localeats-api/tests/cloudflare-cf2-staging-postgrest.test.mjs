import test from "node:test";
import assert from "node:assert/strict";
import worker, {createIsolatedCatalogTestWorker} from "../cloudflare-staging/worker.mjs";
import {
  createStagingCatalogRepository, createStagingPostgrestReader
} from "../cloudflare-staging/stagingCatalogRepository.mjs";

const projectRef="cf2stagingfake";
const endpoint="https://"+projectRef+".supabase.co";
const key="mock-staging-only-key-123";
const validShop=(extra={})=>({
  id:"18",name:"Synthetic Shop",approval_status:"approved",archived_at:null,
  is_active:true,effective_is_active:false,availability_revision:7,
  lat:-25.98,lng:28.2,owner_id:"secret-owner",...extra
});
const validMenu=(extra={})=>({
  id:"m1",shop_id:"18",name:"Synthetic Item",price:25,
  is_available:true,private_notes:"must-not-appear",...extra
});
const req=(path)=>new Request("https://localeats-api-cf1-staging.example.workers.dev"+path);
const flags={
  LOCALEATS_PREVIEW_READ_ONLY:"true",
  PICKUP_WRITES_ENABLED:"false",
  MERCHANT_AVAILABILITY_WRITES_ENABLED:"false",
  PICKUP_PAYMENT_SETTINGS_WRITES_ENABLED:"false",
  PROFILE_WRITES_ENABLED:"false"
};

function postgrestResponse(rows, {total=rows.length,status=200,range=true}={}) {
  const headers={"content-type":"application/json"};
  if(range) headers["content-range"]=rows.length ? "0-"+(rows.length-1)+"/"+total : "*/"+total;
  return new Response(JSON.stringify(rows),{status,headers});
}

function makeFixtureTransport({onRead,onFetch,maxBytes}={}) {
  const requests=[];
  const fetchImpl=async (url,options)=>{
    requests.push({url,options});
    if(onFetch) return onFetch(url,options);
    const dest=new URL(url);
    const isShop=dest.pathname.endsWith("/shops_with_availability");
    const rows=isShop
      ? dest.searchParams.has("id") ? [validShop()] : [validShop()]
      : [validMenu()];
    return postgrestResponse(onRead?onRead(dest,rows):rows);
  };
  const reader=createStagingPostgrestReader({
    endpoint,expectedProjectRef:projectRef,apiKey:key,fetchImpl,maxBytes
  });
  const repository=createStagingCatalogRepository(reader);
  return {requests,reader,repository};
}

test("CF2 mock HTTP transport is GET-only, exact-host, exact-count and approval filtered",async()=>{
  const {requests,repository}=makeFixtureTransport();
  const shops=await repository.getApprovedShops();
  assert.equal(shops.length,1);
  assert.equal(shops[0].effective_is_active,false);
  assert.equal(requests.length,1);
  const first=new URL(requests[0].url);
  assert.equal(first.origin,endpoint);
  assert.equal(first.pathname,"/rest/v1/shops_with_availability");
  assert.equal(first.searchParams.get("approval_status"),"eq.approved");
  assert.equal(first.searchParams.get("archived_at"),"is.null");
  assert.equal(first.searchParams.get("limit"),"201");
  assert.equal(first.searchParams.get("order"),"id.asc");
  assert.ok(first.searchParams.get("select").includes("approval_status"));
  assert.ok(first.searchParams.get("select").includes("archived_at"));
  assert.equal(requests[0].options.method,"GET");
  assert.equal(requests[0].options.redirect,"manual");
  assert.equal(requests[0].options.headers.Prefer,"count=exact");
  assert.equal(requests[0].options.headers.apikey,key);
  assert.equal(requests[0].options.headers.Authorization,undefined);
  assert.equal(requests[0].options.body,undefined);

  const single=await repository.getApprovedShopById("18");
  assert.equal(single.id,"18");
  const detail=new URL(requests[1].url);
  assert.equal(detail.searchParams.get("id"),"eq.18");
  assert.equal(detail.searchParams.get("limit"),"2");
  const menu=await repository.getMenuByShopId("18");
  assert.equal(menu[0].price,25);
  const menuUrl=new URL(requests[2].url);
  assert.equal(menuUrl.pathname,"/rest/v1/menu_items");
  assert.equal(menuUrl.searchParams.get("shop_id"),"eq.18");
  assert.equal(menuUrl.searchParams.get("limit"),"401");
  assert.ok(!menuUrl.searchParams.get("select").includes("private_notes"));
  assert.equal(requests.length,3);
});

test("CF2 synthetic PostgREST and route model never expose private shop/price fields",async()=>{
  const {repository}=makeFixtureTransport();
  const tested=createIsolatedCatalogTestWorker(repository);
  const response=await tested.fetch(req("/api/v1/catalog/shops"),flags);
  assert.equal(response.status,200);
  const [shop]=(await response.json()).shops;
  assert.equal(shop.id,"18");
  assert.equal(shop.is_active,false,"effective availability remains authoritative");
  assert.equal(shop.stored_is_active,true);
  assert.equal(shop.owner_id,undefined);
  assert.equal(shop.approval_status,undefined);
  assert.equal(shop.archived_at,undefined);
  const menu=await tested.fetch(req("/api/v1/catalog/shops/18/menu"),flags);
  assert.equal(menu.status,200);
  const item=(await menu.json()).menu_items[0];
  assert.equal(item.price,25);
  assert.equal(item.private_notes,undefined);
  assert.equal((await worker.fetch(req("/api/v1/catalog/shops"),flags)).status,503,
    "published Worker must NOT instantiate the staging repository");
});

test("CF2 rejects corrupted shop scope and cross-shop item data in entirety",async()=>{
  for (const wrong of [
    [validShop({approval_status:"pending"})],
    [validShop({archived_at:"2026-11-22"})],
    [validShop({effective_is_active:null})],
    [validShop({availability_revision:null})]
  ]) {
    const {repository}=makeFixtureTransport({onRead:(url,rows)=>url.pathname.endsWith("shops_with_availability")?wrong:rows});
    await assert.rejects(()=>repository.getApprovedShops(),/CF2_STAGING_READ_UNAVAILABLE/);
  }
  const wrongId=makeFixtureTransport({onRead:(url,rows)=>
    url.pathname.endsWith("shops_with_availability")?[validShop({id:"19"})]:rows});
  await assert.rejects(()=>wrongId.repository.getApprovedShopById("18"),/CF2_STAGING_READ_UNAVAILABLE/);
  const mixed=makeFixtureTransport({onRead:(url,rows)=>
    url.pathname.endsWith("menu_items")?[validMenu({shop_id:"19"})]:rows});
  const result=await createIsolatedCatalogTestWorker(mixed.repository)
    .fetch(req("/api/v1/catalog/shops/18/menu"),flags);
  assert.equal(result.status,503,"mixed shop menus must fail closed");
  assert.equal((await result.json()).code,"PUBLIC_CATALOG_UNVERIFIED");
});

test("CF2 rejects malformed identifiers before any HTTP call",async()=>{
  const {repository,requests}=makeFixtureTransport();
  for(const id of ["","18;delete","19/../20","hello world","a".repeat(129)]) {
    await assert.rejects(()=>repository.getApprovedShopById(id));
    await assert.rejects(()=>repository.getMenuByShopId(id));
  }
  assert.equal(requests.length,0);
});

test("CF2 ignores no-response, truncated, error, redirect, oversized and invalid JSON",async()=>{
  const invalid=[
    ()=>postgrestResponse([validShop()],{range:false}),
    ()=>postgrestResponse([validShop()],{total:2}),
    ()=>postgrestResponse([validShop()],{status:206,total:2}),
    ()=>new Response("not json",{status:200,headers:{"content-range":"0-0/1"}}),
    ()=>new Response("x".repeat(5000),{status:200,headers:{"content-range":"0-0/1"}}),
    ()=>new Response("forbidden",{status:403,headers:{"content-range":"0-0/1"}}),
    ()=>new Response("",{status:302,headers:{"location":"https://another-host.test"}})
  ];
  for(const response of invalid) {
    const {repository}=makeFixtureTransport({onFetch:async()=>response(),maxBytes:1024});
    await assert.rejects(()=>repository.getApprovedShops(),/CF2_STAGING_READ_UNAVAILABLE/);
  }
  const {repository}=makeFixtureTransport({onFetch:async()=>{throw Error("internal secret from mock");}});
  await assert.rejects(()=>repository.getApprovedShops(),error=>{
    assert.equal(error.message,"CF2_STAGING_READ_UNAVAILABLE");
    return true;
  });
});

test("CF2 refuses unsafe Supabase URL, implicit network transport or absent server key",()=>{
  const base={endpoint,expectedProjectRef:projectRef,apiKey:key,fetchImpl:async()=>postgrestResponse([])};
  for(const values of [
    {endpoint:"http://"+projectRef+".supabase.co"},
    {endpoint:"https://production-ref.supabase.co"},
    {endpoint:endpoint+"/rest/v1"},
    {endpoint:"https://bad.example.com"},
    {endpoint:"https://user:password@"+projectRef+".supabase.co"},
    {expectedProjectRef:"production_ref"},
    {apiKey:""},
    {fetchImpl:undefined}
  ]) assert.throws(()=>createStagingPostgrestReader({...base,...values}));
  assert.throws(()=>createStagingCatalogRepository(null));
  const f=createStagingPostgrestReader(base);
  assert.equal(typeof f,"function");
});

test("CF2 source never references a live credential or production account",async()=>{
  const {readFileSync}=await import("node:fs");
  const script=readFileSync(new URL("../cloudflare-staging/stagingCatalogRepository.mjs",import.meta.url),"utf8");
  const live=readFileSync(new URL("../cloudflare-staging/worker.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(script, /process\.env|globalThis\.fetch|SUPABASE_SERVICE_ROLE_KEY|localhost:4000/);
  assert.doesNotMatch(live,/createStagingPostgrestReader|createStagingCatalogRepository/);
});
