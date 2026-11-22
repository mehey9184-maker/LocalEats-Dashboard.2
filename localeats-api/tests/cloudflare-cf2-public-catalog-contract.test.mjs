import test from 'node:test';
import assert from 'node:assert/strict';
import defaultWorker, {createIsolatedCatalogTestWorker} from '../cloudflare-staging/worker.mjs';
import {distanceKm,verifiedShop,verifiedMenuItem} from '../cloudflare-staging/publicCatalogRead.mjs';

const base='https://localeats-api-cf1-staging.example.workers.dev';
const origin='https://localeats-customer-cf1-staging.example.workers.dev';
const allowed=Object.freeze({
  LOCALEATS_PREVIEW_READ_ONLY:'true',
  PICKUP_WRITES_ENABLED:'false',
  MERCHANT_AVAILABILITY_WRITES_ENABLED:'false',
  PICKUP_PAYMENT_SETTINGS_WRITES_ENABLED:'false',
  PROFILE_WRITES_ENABLED:'false',
  CUSTOMER_APP_ORIGIN:origin
});
const request=(path,method='GET',sentOrigin=origin,headers={})=>
  new Request(base+path,{method,headers:{...(sentOrigin?{Origin:sentOrigin}:{}),...headers}});
const shop=(options={})=>({
  id:'18', name:'Mock Kota Shop', description:'synthetic fixture', location:'test street',
  approval_status:'approved', archived_at:null, is_active:true,
  effective_is_active:true, availability_revision:8,
  lat:-25.98,lng:28.2,owner_id:'private-owner',phone:'secret',...options
});
const menu=(options={})=>({
  id:'item1',shop_id:'18',name:'Mock Kota',price:25,is_available:true,
  cost_price:12,private_notes:'should-not-expose',...options
});
function fake({shops=[shop()],byId=shop(),items=[menu()],failure=false}={}) {
  const calls=[];
  return {
    calls,
    async getApprovedShops() {calls.push('shops');if(failure)throw Error('DB password is secret');return shops;},
    async getApprovedShopById(id) {calls.push('shop:'+id);if(failure)throw Error('DB password is secret');return byId?.id===id?byId:null;},
    async getMenuByShopId(id) {calls.push('menu:'+id);if(failure)throw Error('DB password is secret');return items;}
  };
}

test('CF2 safety: the default Wrangler Worker still returns 503 for public catalogue',async()=>{
  assert.equal((await defaultWorker.fetch(request('/api/v1/catalog/shops'),allowed)).status,503);
  assert.equal((await defaultWorker.fetch(request('/api/v1/catalog/shops/18/menu'),allowed)).status,503);
  assert.equal((await defaultWorker.fetch(request('/health'),allowed)).status,503);
  const boot=await defaultWorker.fetch(request('/bootstrap-health'),allowed);
  assert.equal(boot.status,200);
  assert.equal((await boot.json()).api_ready,false);
});

test('CF2 synthetic public shops enforce approval, archive and database-computed state',async()=>{
  const repository=fake({shops:[
    shop({id:'18',is_active:true,effective_is_active:false}),
    shop({id:'20',approval_status:'pending'}),
    shop({id:'21',archived_at:'2026-11-20T00:00:00Z'}),
    shop({id:'22',archived_at:undefined}),
    shop({id:'23',is_active:false,effective_is_active:false})
  ]});
  const worker=createIsolatedCatalogTestWorker(repository);
  const res=await worker.fetch(request('/api/v1/catalog/shops'),allowed);
  assert.equal(res.status,200);
  assert.equal(res.headers.get('Cache-Control'),'no-store');
  const body=await res.json();
  assert.deepEqual(body.shops.map(x=>x.id),['18','23']);
  assert.equal(body.shops[0].is_active,false,'effective database status overrides stored active bit');
  assert.equal(body.shops[0].stored_is_active,true);
  assert.equal(body.shops[1].is_active,false,'closed shop remains visible for browse-only');
  assert.equal(body.shops[0].owner_id,undefined);
  assert.equal(body.shops[0].approval_status,undefined);
  assert.equal(body.shops[0].phone,undefined);
  assert.equal(repository.calls.length,1);
});

test('CF2 synthetic menu only resolves after exact approved, unarchived shop',async()=>{
  const denied=fake({byId:shop({approval_status:'suspended'})});
  const denyWorker=createIsolatedCatalogTestWorker(denied);
  assert.equal((await denyWorker.fetch(request('/api/v1/catalog/shops/18/menu'),allowed)).status,404);
  assert.deepEqual(denied.calls,['shop:18'],'non-public shop must never reach menu table');
  const good=fake();
  const w=createIsolatedCatalogTestWorker(good);
  const res=await w.fetch(request('/api/v1/catalog/shops/18/menu'),allowed);
  assert.equal(res.status,200);
  const payload=await res.json();
  assert.equal(payload.menu_items[0].price,25);
  assert.equal(payload.menu_items[0].cost_price,undefined);
  assert.equal(payload.menu_items[0].private_notes,undefined);
  assert.deepEqual(good.calls,['shop:18','menu:18']);
  const detail=await w.fetch(request('/api/v1/catalog/shops/18'),allowed);
  assert.equal(detail.status,200);
  const shopResult=await detail.json();
  assert.equal(shopResult.shop.name,'Mock Kota Shop');
  assert.equal(shopResult.shop.owner_id,undefined);
  assert.equal((await w.fetch(request('/api/v1/catalog/shops/18%2Fsecret/menu'),allowed)).status,503);
});

test('CF2 rejects missing availability authority and corrupted/cross-shop menu prices',async()=>{
  for(const invalidShop of [
    shop({effective_is_active:null}), shop({availability_revision:null}),
    shop({is_active:'true'})
  ]) {
    const response=await createIsolatedCatalogTestWorker(fake({shops:[invalidShop]}))
      .fetch(request('/api/v1/catalog/shops'),allowed);
    assert.notEqual(response.status,200,'Invalid shop cannot become visible');
  }
  const unknownArchive = await createIsolatedCatalogTestWorker(
    fake({shops:[shop({archived_at:undefined})]}))
    .fetch(request('/api/v1/catalog/shops'),allowed);
  assert.equal(unknownArchive.status,200);
  assert.deepEqual((await unknownArchive.json()).shops,[],'unverified archive state must not be visible');
  for(const item of [menu({shop_id:'other'}),menu({price:NaN}),
    menu({price:-1}),menu({is_available:undefined}),menu({price:'25'})]) {
    const response=await createIsolatedCatalogTestWorker(fake({items:[item]}))
      .fetch(request('/api/v1/catalog/shops/18/menu'),allowed);
    assert.equal(response.status,503);
    const body=await response.json();
    assert.equal(body.code,'PUBLIC_CATALOG_UNVERIFIED');
  }
  assert.throws(()=>verifiedMenuItem(menu({price:-2}),'18'));
  assert.equal(verifiedShop(shop({approval_status:'pending'})),null);
});

test('CF2 pickup-location endpoint is still within 4km, while wider shops remain browseable',async()=>{
  const source=fake({shops:[
    shop({id:'18',lat:-25.98,lng:28.2}),
    shop({id:'19',lat:-26.5,lng:28.2}),
    shop({id:'20',lat:null,lng:null}),
    shop({id:'21',lat:-25.981,lng:28.2,is_active:false,effective_is_active:false})
  ]});
  const w=createIsolatedCatalogTestWorker(source);
  for(const query of ['','?lat=x&lng=1','?lat=91&lng=1',
    '?lat=-25.98&lng=28.2&lat=0','?lat=-25.98&lng=181']) {
    assert.equal((await w.fetch(request('/api/v1/catalog/pickup-shops'+query),allowed)).status,400,query);
  }
  const list=await (await w.fetch(request('/api/v1/catalog/shops'),allowed)).json();
  assert.equal(list.shops.length,4,'out-of-area shops remain discoverable in general browse');
  const nearby=await w.fetch(request('/api/v1/catalog/pickup-shops?lat=-25.98&lng=28.2'),allowed);
  assert.equal(nearby.status,200);
  const json=await nearby.json();
  assert.deepEqual(json.shops.map(x=>x.id),['18','21']);
  assert.equal(json.shops[0].distance_km,0);
  assert.equal(json.shops[1].is_active,false);
  assert.ok(distanceKm(-25.98,28.2,-26.5,28.2)>4);
});

test('CF2 exact CORS, HEAD, default route failure and read-only verbs are preserved',async()=>{
  const w=createIsolatedCatalogTestWorker(fake());
  assert.equal((await w.fetch(request('/api/v1/catalog/shops','GET',origin+'.attacker.test'),allowed)).status,403);
  assert.equal((await w.fetch(request('/api/v1/catalog/shops','GET','https://www.localeatssa.co.za'),allowed)).status,403);
  const head=await w.fetch(request('/api/v1/catalog/shops','HEAD'),allowed);
  assert.equal(head.status,200);
  assert.equal(await head.text(),'');
  const preflight=await w.fetch(request('/api/v1/catalog/shops','OPTIONS',origin,{'Access-Control-Request-Method':'GET'}),allowed);
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
  const forbidden=await w.fetch(request('/api/v1/catalog/shops','OPTIONS',origin,{'Access-Control-Request-Method':'PATCH'}),allowed);
  assert.equal(forbidden.status,503);
  for(const method of ['POST','PUT','PATCH','DELETE']) {
    const res=await w.fetch(request('/api/v1/catalog/shops/18/menu',method),allowed);
    assert.equal(res.status,503);
  }
  assert.equal((await w.fetch(request('/api/v1/orders'),allowed)).status,503);
  assert.equal((await w.fetch(request('/health'),allowed)).status,503);
});

test('CF2 synthetic downstream failures disclose no credentials and never show fabricated prices',async()=>{
  const w=createIsolatedCatalogTestWorker(fake({failure:true}));
  const res=await w.fetch(request('/api/v1/catalog/shops'),allowed);
  assert.equal(res.status,503);
  const str=await res.text();
  assert.doesNotMatch(str,/password|supabase|firebase/i);
  assert.doesNotMatch(str,/Mock Kota/);
});
