import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import express from "express";
import {
  getFirebaseBearerToken, makeAuthenticateFirebase, type RevocationAwareFirebaseVerifier,
} from "./authenticateFirebase.js";

type ActorResponse={uid?:string;email?:string|null;isAnonymous?:boolean;error?:string};
async function exercise(
  verify:RevocationAwareFirebaseVerifier,
  run:(url:string,calls:{token:string;revoked:boolean}[])=>Promise<void>
) {
  const calls:{token:string;revoked:boolean}[]=[];
  const app=express();
  app.get("/actor",makeAuthenticateFirebase(async(token,checkRevoked)=>{
    calls.push({token,revoked:checkRevoked});
    return verify(token,checkRevoked);
  }),(req,res)=>res.json((req as {authUser?:ActorResponse}).authUser??{}));
  const server=app.listen(0,"127.0.0.1");
  try{
    await once(server,"listening");
    const address=server.address();
    if(!address||typeof address==="string")throw Error("missing synthetic port");
    await run("http://127.0.0.1:"+address.port+"/actor",calls);
  }finally{
    server.closeAllConnections();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
}
async function request(url:string,authorization?:string){
  const response=await fetch(url,{headers:authorization?{authorization}:undefined});
  return {status:response.status,body:await response.json() as ActorResponse};
}

test("Firebase bearer parser keeps existing format and never accepts bare UIDs",()=>{
  assert.equal(getFirebaseBearerToken(undefined),null);
  assert.equal(getFirebaseBearerToken("Bearer synthetic-A"),null);
  assert.equal(getFirebaseBearerToken("Bearer fb-synthetic-A"),"synthetic-A");
  assert.equal(getFirebaseBearerToken("bearer fb-synthetic-A"),null);
});

test("shared Firebase middleware always passes checkRevoked=true to verifier",async()=>{
  await exercise(async(token,checkRevoked)=>{
    assert.equal(checkRevoked,true);
    return {uid:token,email:token+"@example.test",firebase:{sign_in_provider:"password"}};
  },async(url,calls)=>{
    const a=await request(url,"Bearer fb-owner-A");
    assert.equal(a.status,200);
    assert.deepEqual(a.body,{uid:"owner-A",email:"owner-A@example.test",isAnonymous:false});
    const b=await request(url,"Bearer fb-owner-B");
    assert.equal(b.status,200);
    assert.deepEqual(b.body,{uid:"owner-B",email:"owner-B@example.test",isAnonymous:false});
    assert.deepEqual(calls,[{token:"owner-A",revoked:true},{token:"owner-B",revoked:true}]);
  });
});

test("missing token, wrong prefix, empty token, and overlong token deny before verification",async()=>{
  await exercise(async()=>{throw Error("verify must never run");},async(url,calls)=>{
    for(const header of [undefined,"Bearer token","Bearer fb-","Bearer fb-"+"x".repeat(8193)]){
      const r=await request(url,header);
      assert.equal(r.status,401);
      assert.deepEqual(r.body,{success:false,error:"Unauthorized"});
    }
    assert.equal(calls.length,0);
  });
});

test("revoked disabled expired and network-failed identities fail closed without leaked claims",async()=>{
  await exercise(async(token,check)=>{
    assert.equal(check,true);
    if(["revoked","disabled","expired","network-failure"].includes(token))
      throw Error("auth/id-token-"+token+" token-do-not-log");
    return {uid:token};
  },async(url,calls)=>{
    for(const token of ["revoked","disabled","expired","network-failure"]){
      const r=await request(url,"Bearer fb-"+token);
      assert.equal(r.status,401);
      assert.equal(JSON.stringify(r.body).includes(token),false);
    }
    assert.equal(calls.length,4);
    assert.ok(calls.every(x=>x.revoked===true));
  });
});

test("invalid decoded identity and malicious user ID never become req.authUser",async()=>{
  await exercise(async(token)=>{
    if(token==="missing")return {};
    if(token==="malformed")return {uid:"other/user"};
    if(token==="control")return {uid:"bad\u0001user"};
    return {uid:token};
  },async(url)=>{
    for(const token of ["missing","malformed","control"]){
      assert.equal((await request(url,"Bearer fb-"+token)).status,401);
    }
  });
});

test("anonymous state remains explicit for routes with their own registered-user requirements",async()=>{
  await exercise(async()=>({uid:"guest",firebase:{sign_in_provider:"anonymous"},
    email:"guest@example.test"}),async url=>{
      const r=await request(url,"Bearer fb-guest");
      assert.equal(r.status,200);
      assert.equal(r.body.isAnonymous,true);
      assert.equal(r.body.uid,"guest");
    });
});
