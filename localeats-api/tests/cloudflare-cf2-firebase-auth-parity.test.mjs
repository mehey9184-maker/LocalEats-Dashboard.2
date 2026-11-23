import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRevocationRequiredIdentityGate} from "../cloudflare-staging/firebaseAuthParityGate.mjs";

const validHeader="Bearer fb-abc.def.ghi";

test("CF2 identity contract always requests revocation checks and does not confer merchant/admin authority",async()=>{
  const calls=[];
  const gate=createRevocationRequiredIdentityGate(async (token,checkRevoked)=>{
    calls.push({token,checkRevoked});
    return {uid:"unit_test_uid",email:"fake@example.test",firebase:{sign_in_provider:"password"}};
  });
  const result=await gate(validHeader);
  assert.equal(result.uid,"unit_test_uid");
  assert.equal(result.email,"fake@example.test");
  assert.equal(result.isAnonymous,false);
  assert.equal(result.role,undefined);
  assert.equal(result.shop_id,undefined);
  assert.equal(result.isAdmin,undefined);
  assert.deepEqual(calls,[{token:"abc.def.ghi",checkRevoked:true}]);
  assert.equal(Object.isFrozen(result),true);
});

test("CF2 identity contract denies all malformed bearer forms before contacting provider",async()=>{
  let contacted=0;
  const gate=createRevocationRequiredIdentityGate(async()=>{contacted++;return {uid:"u"};});
  for(const header of [
    undefined, null, "", "Bearer abc.def.ghi", "Bearer fb-",
    "Bearer fb-abc.def", "bearer fb-abc.def.ghi",
    "Bearer fb-abc.def.ghi trailing", "Bearer fb-abc.def.ghi\nRole: admin",
    "Bearer fb-"+"a".repeat(16384)
  ]) await assert.rejects(()=>gate(header),/CF2_AUTH_UNAUTHORIZED/);
  assert.equal(contacted,0);
});

test("CF2 identity contract rejects disabled, revoked, missing-UID and invalid provider results",async()=>{
  for(const decoded of [null,{}, {uid:""},{uid:"a/b"},{uid:"u",disabled:true},
    {uid:"u",revoked:true},{uid:12}]) {
    const gate=createRevocationRequiredIdentityGate(async(token,revoked)=>{
      assert.equal(revoked,true);
      return decoded;
    });
    await assert.rejects(()=>gate(validHeader),/CF2_AUTH_UNAUTHORIZED/);
  }
  const guestGate=createRevocationRequiredIdentityGate(async()=>
    ({uid:"guest1",firebase:{sign_in_provider:"anonymous"}}));
  assert.equal((await guestGate(validHeader)).isAnonymous,true);
});

test("CF2 converts Firebase rejection or network errors to a generic denial",async()=>{
  for(const err of [Error("Credential private key or raw token!"),Error("revoked"),Error("disabled")]) {
    const gate=createRevocationRequiredIdentityGate(async()=>{throw err;});
    await assert.rejects(()=>gate(validHeader),error=>{
      assert.equal(error.message,"CF2_AUTH_UNAUTHORIZED");
      assert.doesNotMatch(error.message,/key|token|revoked|disabled/i);
      return true;
    });
  }
  assert.throws(()=>createRevocationRequiredIdentityGate(),/CF2_AUTH_PROVIDER_UNAVAILABLE/);
});

test("CF2 contract is not linked into the deployed CF1 default worker",()=>{
  const source=readFileSync(new URL("../cloudflare-staging/worker.mjs",import.meta.url),"utf8");
  const gate=readFileSync(new URL("../cloudflare-staging/firebaseAuthParityGate.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(source,/createRevocationRequiredIdentityGate|firebaseAuthParityGate/);
  assert.doesNotMatch(gate,/firebase-admin|SUPABASE_SERVICE_ROLE_KEY|process\.env|import\(.*firebase/);
});
