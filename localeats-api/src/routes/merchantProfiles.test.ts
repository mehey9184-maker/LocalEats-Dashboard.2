import test from "node:test";
import assert from "node:assert/strict";
import express,{type RequestHandler} from "express";
import {once} from "node:events";
import type {AddressInfo} from "node:net";
import {makeMerchantProfilesRouter} from "./merchantProfiles.js";
import type {MerchantProfileStore} from "./merchantProfileStore.js";
import {initialAccount,type MerchantAccountRow,type MerchantShopRow} from "./merchantProfileStore.js";
import {previewReadOnlyGate} from "../middleware/previewReadOnlyGate.js";

type Fixture={store:MerchantProfileStore;account:MerchantAccountRow|null;shop:MerchantShopRow;
 accountWrites:number;shopWrites:number;falsify:boolean;ambiguous:boolean};
const fake=():Fixture=>{
 const f:Fixture={store:null as unknown as MerchantProfileStore,account:null,accountWrites:0,shopWrites:0,
  falsify:false,ambiguous:false,
  shop:{id:"owned-123",owner_id:"owner",merchant_profile_revision:0,
    name:"My Kota",description:"Kota shop",category:"Restaurant",phone:"0821234567",
    logo_url:"",opening_time:"08:00",closing_time:"20:00"}};
 f.store={
  async ownedShop(uid){if(f.ambiguous)throw Error("MULTIPLE_ACTIVE_SHOPS");return uid==="owner"?{id:f.shop.id,owner_id:"owner"}:null;},
  async readAccount(){return f.account;},
  async writeAccount(uid,shopId,revision,changes,create){
   f.accountWrites++;
   if(create===!!f.account || (!create && f.account?.revision!==revision))return null;
   const updated={...(f.account??initialAccount(uid,shopId)),...changes,revision:revision+1};
   if(!f.falsify)f.account=updated;
   return updated;
  },
  async readShop(){return f.shop;},
  async writeShop(uid,id,revision,changes){
   f.shopWrites++;
   if(uid!=="owner" || id!==f.shop.id || revision!==f.shop.merchant_profile_revision)return null;
   const updated={...f.shop,...changes,merchant_profile_revision:revision+1};
   if(!f.falsify)f.shop=updated;
   return updated;
  }
 };return f;
};
const auth:RequestHandler=(req,res,next)=>{
 const bearer=req.headers.authorization;
 if(!bearer?.startsWith("Bearer fb-")){res.status(401).json({success:false});return;}
 const uid=bearer.slice("Bearer fb-".length);
 Object.assign(req,{authUser:{uid,email:null,isAnonymous:uid==="anonymous"}});
 next();
};
async function withApi(f:Fixture,gate:{account?:boolean;shop?:boolean},fn:(base:string)=>Promise<void>,preview=false){
 const app=express();
 if(preview)app.use(previewReadOnlyGate);
 app.use(express.json());
 app.use("/api/v1/merchant",makeMerchantProfilesRouter({store:f.store,authenticate:auth,
  accountWrites:()=>gate.account===true,shopWrites:()=>gate.shop===true}));
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");
 try{await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/merchant`);}
 finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
async function call(base:string,path:string,uid:string|null,method="GET",data?:unknown){
 const response=await fetch(base+path,{method,headers:{...uid?{authorization:"Bearer fb-"+uid}:{},"content-type":"application/json"},
  body:data===undefined?undefined:JSON.stringify(data)});
 return {status:response.status,headers:response.headers,body:await response.json() as Record<string,unknown>};
}
const row=(x:unknown)=>x as Record<string,unknown>;
test("merchant GET profile uses verified owner, denies customer/anonymous and disables caching",async()=>{
 const f=fake();await withApi(f,{},async url=>{
  assert.equal((await call(url,"/profile",null)).status,401);
  assert.equal((await call(url,"/profile","anonymous")).status,401);
  assert.equal((await call(url,"/profile","customer")).status,404);
  const mine=await call(url,"/profile","owner");
  assert.equal(mine.status,200);assert.equal(mine.headers.get("cache-control"),"no-store");
  assert.equal(row(mine.body.profile).merchant_uid,"owner");assert.equal(row(mine.body.profile).shop_id,"owned-123");
  assert.equal(row(mine.body.profile).revision,0);
 });
});
test("default-off account and storefront gates reject writes before touching storage",async()=>{
 const f=fake();await withApi(f,{},async url=>{
  const account=await call(url,"/profile","owner","PATCH",{expected_revision:0,full_name:"New"});
  const shop=await call(url,"/shop/profile","owner","PATCH",{shop_id:"owned-123",expected_revision:0,name:"New"});
  assert.equal(account.status,503);assert.equal(account.body.code,"MERCHANT_ACCOUNT_WRITES_DISABLED");
  assert.equal(shop.status,503);assert.equal(shop.body.code,"MERCHANT_SHOP_WRITES_DISABLED");
  assert.equal(f.accountWrites,0);assert.equal(f.shopWrites,0);
 });
});
test("account profile rejects role, owner, email, invalid types, foreign owner, then persists CAS exactly once",async()=>{
 const f=fake();await withApi(f,{account:true},async url=>{
  for(const extra of [{role:"admin"},{owner_id:"customer"},{merchant_uid:"customer"},{email:"fake@example.test"},{marketing_opt_in:"true"},{phone:"123"}]){
   assert.equal((await call(url,"/profile","owner","PATCH",{expected_revision:0,...extra})).status,400);
  }
  assert.equal((await call(url,"/profile","customer","PATCH",{expected_revision:0,full_name:"bad"})).status,404);
  const saved=await call(url,"/profile","owner","PATCH",{expected_revision:0,full_name:"Owner A",phone:"0821234567",marketing_opt_in:false,dark_mode:true});
  assert.equal(saved.status,200);assert.equal(row(saved.body.profile).revision,1);
  assert.equal(row(saved.body.profile).full_name,"Owner A");assert.equal(row(saved.body.profile).marketing_opt_in,false);
  assert.deepEqual((await call(url,"/profile","owner")).body.profile,saved.body.profile);
  assert.equal((await call(url,"/profile","owner","PATCH",{expected_revision:0,full_name:"stale"})).status,409);
  assert.equal(f.accountWrites,1);
 });
});
test("storefront only writes bounded display fields, denies activation, ownership, location and stale revisions",async()=>{
 const f=fake();await withApi(f,{shop:true},async url=>{
  for(const extra of [{is_active:true},{owner_id:"customer"},{approval_status:"approved"},{latitude:-26},{location:"Pretoria"},{updated_at:"today"}]){
   assert.equal((await call(url,"/shop/profile","owner","PATCH",{shop_id:"owned-123",expected_revision:0,...extra})).status,400);
  }
  assert.equal((await call(url,"/shop/profile","owner","PATCH",{shop_id:"other-shop",expected_revision:0,name:"bad"})).status,403);
  const saved=await call(url,"/shop/profile","owner","PATCH",{shop_id:"owned-123",expected_revision:0,name:"Better Kota",opening_time:"09:00"});
  assert.equal(saved.status,200);assert.equal(row(saved.body.shop).name,"Better Kota");
  assert.equal(row(saved.body.shop).merchant_profile_revision,1);
  assert.deepEqual((await call(url,"/shop/profile","owner")).body.shop,saved.body.shop);
  assert.equal((await call(url,"/shop/profile","owner","PATCH",{shop_id:"owned-123",expected_revision:0,name:"stale"})).status,409);
  assert.equal(f.shopWrites,1);
 });
});
test("false persistence, wrong readback and ambiguous shop never claim save",async()=>{
 const f=fake();f.falsify=true;
 await withApi(f,{account:true,shop:true},async url=>{
  const account=await call(url,"/profile","owner","PATCH",{expected_revision:0,full_name:"not saved"});
  const shop=await call(url,"/shop/profile","owner","PATCH",{shop_id:"owned-123",expected_revision:0,name:"not saved"});
  assert.equal(account.status,503);assert.equal(account.body.code,"MERCHANT_PROFILE_SAVE_UNCONFIRMED");
  assert.equal(shop.status,503);assert.equal(shop.body.code,"MERCHANT_SHOP_SAVE_UNCONFIRMED");
 });
 f.ambiguous=true;await withApi(f,{account:true,shop:true},async url=>{
  assert.equal((await call(url,"/profile","owner")).status,409);
  assert.equal((await call(url,"/shop/profile","owner","PATCH",{shop_id:"owned-123",expected_revision:0,name:"bad"})).status,409);
 });
});
test("Preview read-only guard wins even when test write flags are enabled",async()=>{
 const f=fake(),old=process.env.LOCALEATS_PREVIEW_READ_ONLY;
 process.env.LOCALEATS_PREVIEW_READ_ONLY="true";
 try{await withApi(f,{account:true,shop:true},async url=>{
  const account=await call(url,"/profile","owner","PATCH",{expected_revision:0,full_name:"preview"});
  const shop=await call(url,"/shop/profile","owner","PATCH",{shop_id:"owned-123",expected_revision:0,name:"preview"});
  assert.equal(account.body.code,"PREVIEW_READ_ONLY");assert.equal(shop.body.code,"PREVIEW_READ_ONLY");
  assert.equal(f.accountWrites,0);assert.equal(f.shopWrites,0);
 },true);}finally{if(old===undefined)delete process.env.LOCALEATS_PREVIEW_READ_ONLY;else process.env.LOCALEATS_PREVIEW_READ_ONLY=old;}
});
