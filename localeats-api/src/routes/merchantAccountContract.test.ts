import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {readFileSync} from "node:fs";
import express from "express";
import {
  makeReviewOnlyMerchantAccountRouter,
  parseMerchantAccountUpdate,
  type MerchantAccountSnapshot,
  type MerchantAccountStore,
  type MerchantAccountVerifier,
  type MerchantAccountUpdate,
} from "./merchantAccountContract.js";

type ResponseBody = {success?: boolean;code?: string;profile?: Record<string,unknown>};
const initial = (uid:string):MerchantAccountSnapshot => ({
  uid, full_name:"Existing "+uid, phone:"0712345678",
  marketing_preferences:false,dark_mode:false,
  role:"merchant", owner_id:"never-expose-to-client",
});
type TestOptions = {
  enabled?: boolean;
  authorized?: Set<string>;
  failOwnership?: boolean;
  failRead?: boolean;
  failWrite?: boolean;
  staleWrite?: boolean;
  wrongUid?: boolean;
};
function fixture(opts:TestOptions={}) {
  const people = new Map<string,MerchantAccountSnapshot>([
    ["owner-A",initial("owner-A")],["owner-B",initial("owner-B")],
  ]);
  const calls:{kind:string;uid:string;patch?:MerchantAccountUpdate}[]=[];
  const checks:{token:string;revoked:boolean}[]=[];
  const verifyToken:MerchantAccountVerifier=async(token,checkRevoked)=>{
    checks.push({token,revoked:checkRevoked});
    if(["revoked","disabled","expired","bad-signature"].includes(token))
      throw Error("firebase rejected this token");
    if(token==="anonymous") return {uid:"guest",firebase:{sign_in_provider:"anonymous"}};
    if(token==="missing-provider") return {uid:"owner-A"};
    if(token==="role-forgery") return {uid:"outsider",firebase:{sign_in_provider:"password"},
      role:"admin",user_metadata:{role:"merchant"}} as {uid:string;firebase:{sign_in_provider:string}};
    if(token==="owner-A" || token==="owner-B" || token==="outsider")
      return {uid:token,firebase:{sign_in_provider:"password"}};
    throw Error("unknown token");
  };
  const store:MerchantAccountStore={
    async read(uid){
      calls.push({kind:"read",uid});
      if(opts.failRead)throw Error("fake database connection down");
      const record=people.get(uid);
      return record ? {...record,uid:opts.wrongUid?"owner-B":record.uid} : null;
    },
    async write(uid,patch){
      calls.push({kind:"write",uid,patch});
      if(opts.failWrite)throw Error("fake transaction failed");
      if(!opts.staleWrite)people.set(uid,{...people.get(uid),...patch,uid});
    },
  };
  const app=express();
  app.use(express.json({limit:"2kb"}));
  app.use("/api/v1/merchant/account",makeReviewOnlyMerchantAccountRouter({
    store, verifyToken,
    isApprovedMerchantOwner:async uid=>{
      calls.push({kind:"authorize",uid});
      if(opts.failOwnership)throw Error("shop API unavailable");
      return (opts.authorized??new Set(["owner-A","owner-B"])).has(uid);
    },
    ...(opts.enabled===undefined?{}:{writesEnabled:()=>opts.enabled!}),
  }));
  return {app,people,calls,checks};
}
async function withServer<T>(app:ReturnType<typeof express>,
  run:(url:string)=>Promise<T>):Promise<T>{
  const server=app.listen(0,"127.0.0.1");
  try{
    await once(server,"listening");
    const addr=server.address();
    if(!addr||typeof addr==="string")throw Error("missing ephemeral port");
    return await run("http://127.0.0.1:"+addr.port+"/api/v1/merchant/account/me");
  }finally{server.close();}
}
async function request(url:string,token:string|null,method="GET",body?:unknown,plain=false){
  const headers:Record<string,string>={};
  if(token!==null)headers.authorization="Bearer fb-"+token;
  if(body!==undefined)headers["content-type"]=plain?"text/plain":"application/json";
  const response=await fetch(url,{method,headers,
    ...(body===undefined?{}:{body:plain?String(body):JSON.stringify(body)})});
  const payload=await response.json() as ResponseBody;
  return {status:response.status,payload,cache:response.headers.get("cache-control")};
}

test("N8B stays unmounted and writes disabled regardless of env toggles",async()=>{
  const serverSource=readFileSync(new URL("../server.ts",import.meta.url),"utf8");
  assert.doesNotMatch(serverSource,/import\s+.*merchantAccountContract|app\.use\([^\n]*merchant\/account/);
  const old=process.env.MERCHANT_ACCOUNT_WRITES_ENABLED;
  process.env.MERCHANT_ACCOUNT_WRITES_ENABLED="true";
  try{
    const f=fixture();
    await withServer(f.app,async url=>{
      const result=await request(url,"owner-A","POST",{full_name:"Test Owner"});
      assert.equal(result.status,503);
      assert.equal(result.payload.code,"MERCHANT_ACCOUNT_WRITES_DISABLED");
      assert.equal(result.cache,"no-store");
      assert.equal(f.calls.filter(c=>c.kind==="write").length,0);
      assert.deepEqual(f.checks,[{token:"owner-A",revoked:true}]);
    });
  }finally{
    if(old===undefined)delete process.env.MERCHANT_ACCOUNT_WRITES_ENABLED;
    else process.env.MERCHANT_ACCOUNT_WRITES_ENABLED=old;
  }
});

test("Firebase revocation-aware verifier rejects absent, revoked, disabled and anonymous tokens",async()=>{
  const f=fixture({enabled:true});
  await withServer(f.app,async url=>{
    const noAuth=await request(url,null,"POST",{full_name:"Test Owner"});
    assert.equal(noAuth.status,401);
    for(const token of ["revoked","disabled","expired","bad-signature","anonymous","missing-provider"]){
      const result=await request(url,token,"POST",{full_name:"Test Owner"});
      assert.equal(result.status,401,token);
    }
    assert.equal(f.calls.filter(c=>c.kind==="write").length,0);
    assert.ok(f.checks.length>=6 && f.checks.every(c=>c.revoked===true));
  });
});

test("owner approval comes from server lookup and never from custom/user metadata",async()=>{
  const f=fixture({enabled:true});
  await withServer(f.app,async url=>{
    const outsider=await request(url,"role-forgery","POST",{full_name:"Fake Administrator"});
    assert.equal(outsider.status,403);
    assert.equal(outsider.payload.code,"MERCHANT_OWNERSHIP_REQUIRED");
    assert.equal(f.calls.filter(c=>c.kind==="write").length,0);
  });
  const unavailable=fixture({enabled:true,failOwnership:true});
  await withServer(unavailable.app,async url=>{
    const response=await request(url,"owner-A","POST",{full_name:"Valid Name"});
    assert.equal(response.status,503);
    assert.equal(response.payload.code,"MERCHANT_OWNERSHIP_UNAVAILABLE");
    assert.equal(unavailable.calls.filter(c=>c.kind==="read"||c.kind==="write").length,0);
  });
});

test("two approved identities each persist and read back only their own allowlisted fields",async()=>{
  const f=fixture({enabled:true});
  await withServer(f.app,async url=>{
    const a=await request(url,"owner-A","POST",
      {full_name:" Owner Alpha ",phone:"+27 71 234 5678",dark_mode:true});
    assert.equal(a.status,200);
    assert.equal(a.payload.profile?.uid,"owner-A");
    assert.equal(a.payload.profile?.full_name,"Owner Alpha");
    assert.equal(a.payload.profile?.phone,"+27712345678");
    assert.equal(a.payload.profile?.role,undefined);
    assert.equal(a.payload.profile?.owner_id,undefined);
    const b=await request(url,"owner-B","POST",
      {full_name:"Owner Beta",marketing_preferences:true});
    assert.equal(b.status,200);
    const readA=await request(url,"owner-A");
    const readB=await request(url,"owner-B");
    assert.equal(readA.payload.profile?.full_name,"Owner Alpha");
    assert.equal(readB.payload.profile?.full_name,"Owner Beta");
    assert.equal(readB.payload.profile?.marketing_preferences,true);
    assert.ok(!JSON.stringify(readB.payload).includes("Owner Alpha"));
    assert.ok(f.calls.filter(c=>c.kind==="write"&&c.uid==="owner-A").every(c=>
      !("uid" in (c.patch??{}))));
  });
});

test("forbidden role, account, email, shop and photo fields fail before persistence",async()=>{
  const f=fixture({enabled:true});
  const forbidden=[
    {uid:"owner-B",full_name:"Corrupt"},
    {user_id:"owner-B"}, {role:"admin"}, {owner_id:"owner-B"},
    {shop_id:"other-shop"}, {email:"other@example.test"},
    {emailVerified:true}, {app_metadata:{admin:true}},
    {user_metadata:{role:"admin"}}, {avatar_url:"https://host/x.png"},
    {photo_url:"https://host/x.png"}, {payment_status:"paid"},
    JSON.parse('{"__proto__":{"admin":true}}') as Record<string,unknown>,
  ];
  await withServer(f.app,async url=>{
    for(const body of forbidden){
      const r=await request(url,"owner-A","POST",body);
      assert.equal(r.status,403,JSON.stringify(body));
      assert.equal(r.payload.code,"FORBIDDEN_ACCOUNT_FIELD");
    }
    assert.equal(f.calls.filter(c=>c.kind==="write").length,0);
  });
});

test("input requires a compact typed allowlist and a valid South African phone",()=>{
  assert.deepEqual(parseMerchantAccountUpdate({full_name:"  Person One ",phone:"071 234 5678",
    marketing_preferences:false}),{full_name:"Person One",phone:"0712345678",marketing_preferences:false});
  for(const body of [null,[],{}, {full_name:"a"},{full_name:" ".repeat(121)},
    {full_name:null},{phone:123},{phone:"12345"},{dark_mode:"true"},
    {marketing_preferences:1},{full_name:[]}]){
    assert.throws(()=>parseMerchantAccountUpdate(body),JSON.stringify(body));
  }
});

test("a write acknowledgement without matching read-back fails closed",async()=>{
  const f=fixture({enabled:true,staleWrite:true});
  await withServer(f.app,async url=>{
    const r=await request(url,"owner-A","POST",{full_name:"New Name"});
    assert.equal(r.status,503);
    assert.equal(r.payload.code,"MERCHANT_ACCOUNT_SAVE_UNCONFIRMED");
    assert.equal(f.people.get("owner-A")?.full_name,"Existing owner-A");
  });
});

test("store failure and mismatched profile owner never claim success",async()=>{
  for(const mode of [{failWrite:true},{failRead:true},{wrongUid:true}]){
    const f=fixture({enabled:true,...mode});
    await withServer(f.app,async url=>{
      const r=await request(url,"owner-A","POST",{full_name:"Safe Name"});
      assert.equal(r.status,503,JSON.stringify(mode));
      assert.equal(r.payload.code,"MERCHANT_ACCOUNT_SAVE_UNCONFIRMED");
      assert.equal(r.payload.profile,undefined);
    });
  }
});

test("profile read is scoped, sanitised, and reports missing records safely",async()=>{
  const f=fixture({enabled:true});
  await withServer(f.app,async url=>{
    const a=await request(url,"owner-A");
    assert.equal(a.status,200);
    assert.equal(a.payload.profile?.role,undefined);
    assert.equal(a.payload.profile?.owner_id,undefined);
    f.people.delete("owner-A");
    const missing=await request(url,"owner-A");
    assert.equal(missing.status,404);
    assert.equal(missing.payload.code,"MERCHANT_ACCOUNT_NOT_FOUND");
  });
  const mismatch=fixture({enabled:true,wrongUid:true});
  await withServer(mismatch.app,async url=>{
    const r=await request(url,"owner-A");
    assert.equal(r.status,503);
    assert.equal(r.payload.code,"MERCHANT_ACCOUNT_READ_UNCONFIRMED");
  });
});

test("JSON is mandatory for writes; no store write on unsupported media",async()=>{
  const f=fixture({enabled:true});
  await withServer(f.app,async url=>{
    const r=await request(url,"owner-A","POST",'{"full_name":"Name"}',true);
    assert.equal(r.status,415);
    assert.equal(f.calls.filter(c=>c.kind==="write").length,0);
  });
});

test("switched owner B cannot see owner A even after A's independent save",async()=>{
  const f=fixture({enabled:true});
  await withServer(f.app,async url=>{
    const [a,b]=await Promise.all([
      request(url,"owner-A","POST",{full_name:"Only Alpha"}),
      request(url,"owner-B","POST",{full_name:"Only Beta"}),
    ]);
    assert.equal(a.status,200);
    assert.equal(b.status,200);
    assert.equal(a.payload.profile?.uid,"owner-A");
    assert.equal(b.payload.profile?.uid,"owner-B");
    const after=await request(url,"owner-B");
    assert.equal(after.payload.profile?.full_name,"Only Beta");
    assert.ok(!JSON.stringify(after.payload).includes("Only Alpha"));
    assert.ok(f.calls.filter(c=>c.kind==="write").every(c=>c.uid==="owner-A"||c.uid==="owner-B"));
  });
});
