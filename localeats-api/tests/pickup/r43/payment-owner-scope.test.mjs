import test from "node:test";
import assert from "node:assert/strict";
import {createSyntheticPaymentReader,R43ScopeError} from "./payment-owner-scope.SYNTHETIC_ONLY.mjs";

const fakeShops={
  A:[{id:"101",owner_id:"A",archived_at:null,approval_status:"approved"}],
  B:[{id:"202",owner_id:"B",archived_at:null,approval_status:"approved"}],
};
const fakePayments={
  101:[{id:"FAKE-PAY-A",shop_id:101,amount:25,status:"paid",payment_method:"cash",payment_date:null,
    transaction_id:"MUST_NOT_BE_EXPOSED",private_metadata:"hidden"}],
  202:[{id:"FAKE-PAY-B",shop_id:202,amount:17.50,status:"paid",payment_method:"cash",payment_date:null}],
};
const denial=async(promise,status,code)=>{
  await assert.rejects(promise,e=>e instanceof R43ScopeError&&e.status===status&&e.code===code);
};
const build=(overrides={})=>{
  const calls={verification:[],shops:[],payments:[]};
  const deps={
    verifyFirebase:async(token,checkRevoked)=>{
      calls.verification.push({token,checkRevoked});
      if(token==="REVOKED"||token==="INVALID")throw Error("invalid synthetic identity");
      return {uid:token,isAnonymous:false,role:"client"};
    },
    activeOwnedShops:async uid=>{calls.shops.push(uid);return fakeShops[uid]??[];},
    legacyPaymentsByShopId:async id=>{calls.payments.push(id);return fakePayments[id]??[];},
    ...overrides,
  };
  return {read:createSyntheticPaymentReader(deps),calls};
};
const bearer=uid=>({authorization:"Bearer fb-"+uid});

test("R4.3: only verified merchant A sees A's fake records, never B's",async()=>{
  const {read,calls}=build();
  const a=await read(bearer("A"));
  assert.equal(a.payments.length,1);
  assert.equal(a.payments[0].id,"FAKE-PAY-A");
  assert.ok(!JSON.stringify(a).includes("MUST_NOT_BE_EXPOSED"));
  assert.deepEqual(calls.verification,[{token:"A",checkRevoked:true}]);
  assert.deepEqual(calls.shops,["A"]);
  assert.deepEqual(calls.payments,[101]);
});

test("R4.3: merchant B sees only B's payments, not A's",async()=>{
  const {read,calls}=build();
  const b=await read(bearer("B"));
  assert.deepEqual(b.payments.map(row=>row.id),["FAKE-PAY-B"]);
  assert.deepEqual(calls.payments,[202]);
});

test("R4.3: body/query role, UID, shop and finance params never supply authority",async()=>{
  const {read,calls}=build();
  for(const query of [{shop_id:"202"},{uid:"B"},{role:"super_admin"},{status:"paid"},{limit:999999}]){
    await denial(read({...bearer("A"),query}),400,"CLIENT_PAYMENT_SCOPE_FORBIDDEN");
  }
  assert.deepEqual(calls.verification,[]);
  assert.deepEqual(calls.payments,[]);
});

test("R4.3: no, malformed, revoked, anonymous or empty identity fails before any data fetch",async()=>{
  const {read,calls}=build({
    verifyFirebase:async(token,checkRevoked)=>{
      calls.verification.push({token,checkRevoked});
      if(token==="REVOKED")throw Error("token revoked");
      if(token==="ANON")return {uid:"A",isAnonymous:true};
      if(token==="EMPTY")return {uid:"",isAnonymous:false};
      return {uid:token,isAnonymous:false};
    }
  });
  for(const bad of [undefined,"Bearer other","Bearer fb-REVOKED","Bearer fb-ANON","Bearer fb-EMPTY"]){
    await denial(read({authorization:bad}),401,"FIREBASE_AUTH_REQUIRED");
  }
  assert.deepEqual(calls.shops,[]);
  assert.deepEqual(calls.payments,[]);
});

test("R4.3: missing, multiple, wrong-owner, archived or suspended shop fails closed",async()=>{
  const variants=[
    [[],403,"NO_ACTIVE_OWNED_SHOP"],
    [[...fakeShops.A,...fakeShops.B],409,"AMBIGUOUS_SHOP_OWNER"],
    [[{...fakeShops.A[0],owner_id:"B"}],403,"UNVERIFIED_SHOP_OWNER"],
    [[{...fakeShops.A[0],archived_at:"2026-11-08T00:00:00Z"}],403,"UNVERIFIED_SHOP_OWNER"],
    [[{...fakeShops.A[0],approval_status:"pending"}],403,"UNVERIFIED_SHOP_OWNER"],
  ];
  for(const [shops,status,code] of variants){
    const {read,calls}=build({activeOwnedShops:async()=>shops});
    await denial(read(bearer("A")),status,code);
    assert.deepEqual(calls.payments,[]);
  }
});

test("R4.3: nonnumeric modern shop IDs and ambiguous legacy bigint conversions must be mapped explicitly",async()=>{
  for(const id of ["shop-my-kota-ivory-park","0101","0","-1","1.0","9999999999999999999999",101]){
    const {read,calls}=build({activeOwnedShops:async()=>[{...fakeShops.A[0],id}]});
    await denial(read(bearer("A")),409,"LEGACY_SHOP_MAPPING_NOT_VERIFIED");
    assert.deepEqual(calls.payments,[]);
  }
});

test("R4.3: cross-shop leakage from DB is treated as 503, not silently returned",async()=>{
  const {read}=build({legacyPaymentsByShopId:async()=>[...fakePayments[101],...fakePayments[202]]});
  await denial(read(bearer("A")),503,"PAYMENT_SCOPE_INTEGRITY_FAILURE");
});

test("R4.3: infrastructure errors never degrade to open access or fake zero history",async()=>{
  const a=build({activeOwnedShops:async()=>{throw Error("offline");}});
  await denial(a.read(bearer("A")),503,"OWNER_LOOKUP_UNAVAILABLE");
  const b=build({legacyPaymentsByShopId:async()=>{throw Error("offline");}});
  await denial(b.read(bearer("A")),503,"PAYMENT_READ_UNAVAILABLE");
});

test("R4.3: fake user-editable role cannot substitute for a verified shop",async()=>{
  const {read,calls}=build({
    verifyFirebase:async()=>({uid:"unmapped",isAnonymous:false,user_metadata:{role:"super_admin"}}),
  });
  await denial(read(bearer("A")),403,"NO_ACTIVE_OWNED_SHOP");
  assert.deepEqual(calls.payments,[]);
});
