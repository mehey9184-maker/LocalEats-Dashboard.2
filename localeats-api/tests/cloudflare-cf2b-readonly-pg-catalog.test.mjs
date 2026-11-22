import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createCF2PgCatalogRepository} from "../cloudflare-staging/cf2ReadOnlyPgCatalog.mjs";
import worker,{createIsolatedCatalogTestWorker} from "../cloudflare-staging/worker.mjs";

const flags={
  LOCALEATS_PREVIEW_READ_ONLY:"true",PICKUP_WRITES_ENABLED:"false",
  MERCHANT_AVAILABILITY_WRITES_ENABLED:"false",
  PICKUP_PAYMENT_SETTINGS_WRITES_ENABLED:"false",PROFILE_WRITES_ENABLED:"false"
};
const route=(path,method="GET")=>
  new Request("https://localeats-api-cf1-staging.example.workers.dev"+path,{method});
const aShop=(extra={})=>({
  id:"stg-test-shop-open",name:"STAGING TEST Kota",approval_status:"approved",
  archived_at:null,is_active:true,effective_is_active:true,
  availability_revision:"3",lat:"-25.98",lng:"28.2",latitude:null,
  longitude:null,rating:"4.5",owner_id:"never-public",...extra
});
const aMenu=(extra={})=>({
  id:"stg-test-item-kota",shop_id:"stg-test-shop-open",name:"STAGING TEST Kota",
  price:"25.00",is_available:true,private_notes:"never-public",...extra
});
const makeFake=(fn)=> {
  const calls=[];
  const repository=createCF2PgCatalogRepository(async(sql,params)=>{
    calls.push({sql,params});
    const rows=fn?await fn(sql,params):sql.includes("public_menu")?[aMenu()]:[aShop()];
    return {rows};
  });
  return {repository,calls};
};

test("CF2-B PG catalogue uses immutable fixed SQL, bounded LIMIT and parameterized IDs",async()=>{
  const {repository,calls}=makeFake();
  assert.equal((await repository.getApprovedShops())[0].id,"stg-test-shop-open");
  assert.equal((await repository.getApprovedShopById("stg-test-shop-open")).id,"stg-test-shop-open");
  assert.equal((await repository.getMenuByShopId("stg-test-shop-open"))[0].price,25);
  assert.equal(calls.length,3);
  assert.deepEqual(calls.map(c=>c.params),[[201],["stg-test-shop-open",2],["stg-test-shop-open",401]]);
  assert.ok(calls[0].sql.startsWith("SELECT "));
  assert.ok(calls[0].sql.includes(" FROM catalog_cf2.public_shops "));
  assert.ok(calls[0].sql.includes("approval_status = 'approved' AND archived_at IS NULL"));
  assert.ok(calls[1].sql.includes("id = $1"));
  assert.ok(calls[2].sql.includes(" FROM catalog_cf2.public_menu WHERE shop_id = $1"));
  for(const {sql} of calls){
    assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXECUTE|FOR\s+UPDATE)\b/i);
    assert.doesNotMatch(sql,/SELECT\s+\*/i);
    assert.doesNotMatch(sql,/\bowner_id\b|\bcost_price\b|\bprivate_notes\b/i);
    assert.doesNotMatch(sql,/stg-test-shop-open/);
  }
});

test("CF2-B normalizes PostgreSQL NUMERIC price/coordinates but never leaks private fields",async()=>{
  const {repository}=makeFake();
  const result=await createIsolatedCatalogTestWorker(repository).fetch(route("/api/v1/catalog/shops"),flags);
  assert.equal(result.status,200);
  const [shop]=(await result.json()).shops;
  assert.equal(shop.is_active,true);
  assert.equal(shop.lat,-25.98);
  assert.equal(shop.lng,28.2);
  assert.equal(shop.rating,4.5);
  assert.equal(shop.availability_revision,3);
  assert.equal(shop.owner_id,undefined);
  assert.equal(shop.approval_status,undefined);
  const menu=await createIsolatedCatalogTestWorker(repository).fetch(
    route("/api/v1/catalog/shops/stg-test-shop-open/menu"),flags);
  assert.equal(menu.status,200);
  const [item]=(await menu.json()).menu_items;
  assert.equal(item.price,25);
  assert.equal(item.private_notes,undefined);
  assert.equal((await worker.fetch(route("/api/v1/catalog/shops"),flags)).status,503,
    "Cloudflare deployed CF1 Worker must remain disconnected");
});

test("CF2-B ID injection and malformed scope never call the database",async()=>{
  const {repository,calls}=makeFake();
  for(const invalid of [
    "", "x' OR 1=1 --", "x;DROP TABLE shops", "some/path",
    "x".repeat(129), "x y", "über"
  ]){
    await assert.rejects(()=>repository.getApprovedShopById(invalid),/CF2_READER_UNAVAILABLE/);
    await assert.rejects(()=>repository.getMenuByShopId(invalid),/CF2_READER_UNAVAILABLE/);
  }
  assert.equal(calls.length,0);
});

test("CF2-B cannot expose unapproved, archived or unverified shop states",async()=>{
  for(const row of [
    aShop({approval_status:"pending"}),aShop({archived_at:"2026-11-22"}),
    aShop({effective_is_active:null}),aShop({is_active:"true"}),
    aShop({availability_revision:null}),aShop({rating:"9"}),
    aShop({lat:"-999"}),aShop({name:""})
  ]){
    const {repository}=makeFake(()=>[row]);
    await assert.rejects(()=>repository.getApprovedShops(),/CF2_READER_UNAVAILABLE/);
  }
});

test("CF2-B complete menu denial on cross-shop leakage, invalid money and availability",async()=>{
  for(const item of [
    aMenu({shop_id:"other"}), aMenu({price:"-1"}), aMenu({price:"25.001"}),
    aMenu({price:"Infinity"}),aMenu({price:undefined}),aMenu({is_available:null}),
    aMenu({price:"1000000.00"}),aMenu({id:""})
  ]){
    const {repository}=makeFake(sql=>sql.includes("public_menu")?[item]:[aShop()]);
    const response=await createIsolatedCatalogTestWorker(repository).fetch(
      route("/api/v1/catalog/shops/stg-test-shop-open/menu"),flags);
    assert.equal(response.status,503);
    const json=await response.json();
    assert.equal(json.code,"PUBLIC_CATALOG_UNVERIFIED");
  }
});

test("CF2-B fails closed on oversized lists, malformed driver output and untrusted errors",async()=>{
  const cases=[
    async()=>{throw Error("private password in PG error");},
    async()=>null,async()=>undefined,async()=>({rows:"wrong"}),
    async()=>Array.from({length:201},(_,i)=>aShop({id:"test-"+i})),
    async()=>[aShop({description:"X".repeat(230000)})]
  ];
  for(const fn of cases) {
    const calls=[];
    const repo=createCF2PgCatalogRepository(async(sql,params)=>{
      calls.push({sql,params});
      const result=await fn();
      return result && Object.hasOwn(result,"rows")?result:{rows:result};
    });
    await assert.rejects(()=>repo.getApprovedShops(),error=>{
      assert.equal(error.message,"CF2_READER_UNAVAILABLE");
      return true;
    });
    assert.equal(calls.length,1);
  }
});

test("CF2-B strict caps fail rather than returning incomplete shop or menu lists",async()=>{
  const {repository:menuRepo}=makeFake(sql=>
    sql.includes("public_menu")?Array.from({length:401},(_,i)=>aMenu({id:"test-"+i})):[aShop()]);
  await assert.rejects(()=>menuRepo.getMenuByShopId("stg-test-shop-open"),/CF2_READER_UNAVAILABLE/);
  const {repository:shopRepo}=makeFake(sql=>
    Array.from({length:2},(_,i)=>aShop({id:"stg-test-shop-"+i})));
  await assert.rejects(()=>shopRepo.getApprovedShopById("stg-test-shop-open"),/CF2_READER_UNAVAILABLE/);
});

test("CF2-B adds no credential, Hyperdrive or production Worker dependencies",()=>{
  const source=readFileSync(new URL("../cloudflare-staging/cf2ReadOnlyPgCatalog.mjs",import.meta.url),"utf8");
  const live=readFileSync(new URL("../cloudflare-staging/worker.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(source,/import\s+.*from\s+["']pg|connectionString|process\.env|globalThis\.fetch|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(live,/cf2ReadOnlyPgCatalog|catalog_cf2|HYPERDRIVE|connectionString/);
});
