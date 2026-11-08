import test from "node:test";
import assert from "node:assert/strict";
import {readMerchantPaymentHistory,canonicalLegacyShopId,PaymentHistoryDenied,
 type PaymentHistoryDeps,type PaymentRow,type OwnedPaymentShop,type LegacyPaymentMapping}
 from "./merchantPaymentHistoryR44.js";

const idA="00000000-0000-4000-8000-000000004401";
const idB="00000000-0000-4000-8000-000000004402";
const legacyA="9007199254740993"; // valid PG bigint, NOT JavaScript-safe as a number
const A:OwnedPaymentShop={id:"my-kota-modern-id",owner_id:"A",approval_status:"approved",archived_at:null};
const B:OwnedPaymentShop={id:"shop-B",owner_id:"B",approval_status:"approved",archived_at:null};
const mappingA:LegacyPaymentMapping={shopId:A.id,ownerUid:"A",legacyShopId:legacyA,
 provenance:"verified_legacy_payment_mapping"};
const mappingB:LegacyPaymentMapping={shopId:B.id,ownerUid:"B",legacyShopId:"202",
 provenance:"verified_legacy_payment_mapping"};
const record=(id:string,shop_id:string):PaymentRow=>({
 id,shop_id,amount:"25.00",status:"paid",payment_method:"cash",payment_date:null,
 transaction_id:"PRIVATE-DO-NOT-EXPOSE",private_customer_email:"fake@example.test",
});
const make=(overrides:Partial<PaymentHistoryDeps>={})=>{
 const called:{verified:Array<[string,boolean]>;owners:string[];mapped:Array<[string,string]>;
  reads:Array<[string,number,number]>}={verified:[],owners:[],mapped:[],reads:[]};
 const dependencies:PaymentHistoryDeps={
  verifyFirebase:async(token,checkRevoked)=>{
   called.verified.push([token,checkRevoked]);
   if(token==="REVOKED")throw Error("revoked token");
   return {uid:token,isAnonymous:token==="ANON"};
  },
  findOwnedShops:async(uid)=>{called.owners.push(uid);return uid==="A"?[A]:uid==="B"?[B]:[];},
  findVerifiedLegacyMapping:async(uid,shopId)=>{
   called.mapped.push([uid,shopId]);return uid==="A"?mappingA:uid==="B"?mappingB:null;
  },
  readScopedPayments:async(shop,offset,limit)=>{
   called.reads.push([shop,offset,limit]);
   return shop===legacyA?[record(idA,legacyA)]:[record(idB,"202")];
  },
  ...overrides,
 };
 const read=(uid:string,query:Record<string,unknown>={})=>
  readMerchantPaymentHistory("Bearer fb-"+uid,query,dependencies);
 return {read,dependencies,called};
};
const denies=async(run:Promise<unknown>,status:number,code:string)=>{
 await assert.rejects(run,(e:unknown)=>e instanceof PaymentHistoryDenied && e.status===status && e.code===code);
};

test("R4.4: service returns merchant A's rows only after revocation check and explicit mapping",async()=>{
 const {read,called}=make();
 const answer=await read("A");
 assert.deepEqual(answer,{payments:[{id:idA,amount:"25.00",status:"paid",
  payment_method:"cash",payment_date:null}],next_offset:null});
 assert.equal(JSON.stringify(answer).includes("PRIVATE-DO-NOT-EXPOSE"),false);
 assert.deepEqual(called.verified,[["A",true]]);
 assert.deepEqual(called.owners,["A"]);
 assert.deepEqual(called.mapped,[["A","my-kota-modern-id"]]);
 assert.deepEqual(called.reads,[[legacyA,0,51]]);
});

test("R4.4: merchant B gets only B payment, not merchant A",async()=>{
 const {read,called}=make();
 const answer=await read("B");
 assert.equal(answer.payments[0]?.id,idB);
 assert.deepEqual(called.reads,[["202",0,51]]);
});

test("R4.4: caller-controlled shop, UID, role and financial arguments rejected before authentication",async()=>{
 const {read,called}=make();
 for(const query of [{shop_id:"202"},{owner_uid:"B"},{role:"super_admin"},{amount:"999"},{
  status:"paid"},{offset:"0",shop:"other"},{limit:"1000"}]) {
  await denies(read("A",query),400,"UNSUPPORTED_PAYMENT_QUERY");
 }
 assert.deepEqual(called.verified,[]);
});

test("R4.4: revoked or anonymous identity, malformed bearer and invalid verifier reject read",async()=>{
 const {read,dependencies,called}=make();
 await denies(read("REVOKED"),401,"FIREBASE_AUTH_REQUIRED");
 await denies(read("ANON"),401,"FIREBASE_AUTH_REQUIRED");
 await denies(readMerchantPaymentHistory("Bearer EXTERNAL",{},dependencies),401,"FIREBASE_AUTH_REQUIRED");
 await denies(readMerchantPaymentHistory("Bearer fb-",{},dependencies),401,"FIREBASE_AUTH_REQUIRED");
 assert.deepEqual(called.reads,[]);
});

test("R4.4: missing, ambiguous, archived or suspended shops fail closed without payment query",async()=>{
 for(const [shops,status,code] of [
  [[],403,"NO_OWNED_SHOP"],
  [[A,B],409,"AMBIGUOUS_MERCHANT_SHOP"],
  [[{...A,owner_id:"B"}],403,"UNVERIFIED_MERCHANT_SHOP"],
  [[{...A,archived_at:"2026-11-08T00:00:00Z"}],403,"UNVERIFIED_MERCHANT_SHOP"],
  [[{...A,approval_status:"pending"}],403,"UNVERIFIED_MERCHANT_SHOP"],
 ] as Array<[OwnedPaymentShop[],number,string]>) {
  const {read,called}=make({findOwnedShops:async()=>shops});
  await denies(read("A"),status,code); assert.deepEqual(called.reads,[]);
 }
});

test("R4.4: no implicit numeric mapping even if current shop id is numeric",async()=>{
 const numeric:OwnedPaymentShop={...A,id:"101"};
 const {read,called}=make({findOwnedShops:async()=>[numeric],
  findVerifiedLegacyMapping:async()=>null});
 await denies(read("A"),409,"LEGACY_MAPPING_UNVERIFIED");
 assert.deepEqual(called.reads,[]);
});

test("R4.4: mismatched mapping UID, shop, provenance or bigint is denied before querying",async()=>{
 const bad=[
  {...mappingA,ownerUid:"B"},
  {...mappingA,shopId:"shop-B"},
  {...mappingA,provenance:"not-attested" as LegacyPaymentMapping["provenance"]},
  {...mappingA,legacyShopId:"0101"},
  {...mappingA,legacyShopId:"9223372036854775808"},
  {...mappingA,legacyShopId:"shop-my-kota"},
 ];
 for(const result of bad) {
  const {read,called}=make({findVerifiedLegacyMapping:async()=>result});
  await denies(read("A"),409,"LEGACY_MAPPING_UNVERIFIED");
  assert.deepEqual(called.reads,[]);
 }
 assert.equal(canonicalLegacyShopId(legacyA),legacyA);
});

test("R4.4: cross-shop rows or null-shop data fail closed rather than leak or imply no payments",async()=>{
 for(const row of [record(idB,"202"),record(idB,"null"),{...record(idA,legacyA),amount:"not-a-number"}]){
  const {read}=make({readScopedPayments:async()=>[record(idA,legacyA),row]});
  await denies(read("A"),503,"PAYMENT_HISTORY_INTEGRITY_FAILURE");
 }
});

test("R4.4: infrastructure errors are not translated into empty ledger or successful billing",async()=>{
 const failures:Array<[Partial<PaymentHistoryDeps>,string]>=[
  [{findOwnedShops:async()=>{throw Error("db down");}},"PAYMENT_OWNER_LOOKUP_UNAVAILABLE"],
  [{findVerifiedLegacyMapping:async()=>{throw Error("mapping unavailable");}},"LEGACY_MAPPING_UNAVAILABLE"],
  [{readScopedPayments:async()=>{throw Error("provider offline");}},"PAYMENT_HISTORY_UNAVAILABLE"],
 ];
 for(const [override,code] of failures) {
  const {read}=make(override);
  await denies(read("A"),503,code);
 }
});

test("R4.4: paged history stays bounded, rejects forged pagination and reports more pages",async()=>{
 const all=Array.from({length:51},(_,i)=>
  record("00000000-0000-4000-8000-"+String(4400+i).padStart(12,"0"),legacyA));
 const {read,called}=make({readScopedPayments:async(shop,offset,limit)=>{
  called.reads.push([shop,offset,limit]);return all;
 }});
 const first=await read("A");
 assert.equal(first.payments.length,50);
 assert.equal(first.next_offset,50);
 const second=await read("A",{offset:"50"});
 assert.equal(second.next_offset,100);
 assert.deepEqual(called.reads,[[legacyA,0,51],[legacyA,50,51]]);
 for(const offset of ["-1","01","1","5001","10000","NaN",25]) {
  await denies(read("A",{offset}),400,"INVALID_PAYMENT_OFFSET");
 }
});


test("R4.4: malicious lookahead row 51 cannot leak across tenant boundary",async()=>{
 const pages=Array.from({length:50},(_,i)=>record(
  "00000000-0000-4000-8000-"+String(7400+i).padStart(12,"0"),legacyA));
 pages.push(record(idB,"202"));
 const {read}=make({readScopedPayments:async()=>pages});
 await denies(read("A"),503,"PAYMENT_HISTORY_INTEGRITY_FAILURE");
});

test("R4.4: at the bounded maximum a truncated response fails rather than implies complete history",async()=>{
 const all=Array.from({length:51},(_,i)=>record(
  "00000000-0000-4000-8000-"+String(8400+i).padStart(12,"0"),legacyA));
 const {read}=make({readScopedPayments:async()=>all});
 await denies(read("A",{offset:"5000"}),503,"PAYMENT_HISTORY_PAGING_LIMIT");
});
