import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { makeCustomerProfileRouter, type ProfileDocument, type ProfileRepository, ProfileConflict } from './customerProfile.js';

const stage='localeats-pickup-stage-261105';
const claims=(uid='account-a')=>({uid,aud:stage,iss:`https://securetoken.google.com/${stage}`,email:`${uid}@example.invalid`,firebase:{sign_in_provider:'password'}});

class MemoryProfiles implements ProfileRepository {
  docs=new Map<string,ProfileDocument>(); reads=0; writes=0; version=0;
  async read(uid:string,_signal:AbortSignal){this.reads++;return structuredClone(this.docs.get(uid)||null);}
  async write(uid:string,patch:Record<string,unknown>,revision:string|null,_signal:AbortSignal){
    this.writes++;const old=this.docs.get(uid);
    if((old?.revision??null)!==revision)throw new ProfileConflict();
    const doc={fields:{...old?.fields,...patch},revision:`2026-11-06T18:00:00.${String(++this.version).padStart(9,'0')}Z`};
    this.docs.set(uid,structuredClone(doc));return structuredClone(doc);
  }
}

async function fixture(run:(base:string,db:MemoryProfiles,state:any)=>Promise<void>, options:any={}){
  const db=new MemoryProfiles();const state={enabled:true,writes:true,verifyCalls:[] as any[],...options};
  const app=express();app.use('/api/v1/customer/profile',makeCustomerProfileRouter({
    enabled:()=>state.enabled,writesEnabled:()=>state.writes,repository:()=>db,timeoutMs:state.timeoutMs??1000,
    verifyIdToken:async(token:string,revoked:boolean)=>{
      state.verifyCalls.push([token,revoked]);if(state.verify)return state.verify(token,revoked);
      if(token==='invalid')throw Error('private-auth-diagnostic');
      return token==='anonymous'?{...claims(),firebase:{sign_in_provider:'anonymous'}}:claims(token);
    },
  }));
  const server=http.createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  try{await run(`http://127.0.0.1:${(server.address() as any).port}/api/v1/customer/profile`,db,state);}
  finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
}
const headers=(uid='account-a')=>({'Content-Type':'application/json',Authorization:`Bearer fb-${uid}`});
const save=(url:string,profile:unknown,revision:string|null=null,uid='account-a')=>fetch(url,{method:'PATCH',headers:headers(uid),body:JSON.stringify({profile,expectedRevision:revision})});

test('profile reads/saves are disabled by default and writes have a second gate',()=>fixture(async(url,db,state)=>{
 state.enabled=false;assert.equal((await fetch(url,{headers:headers()})).status,503);
 assert.equal((await save(url,{fullName:'A'})).status,503);assert.equal(state.verifyCalls.length,0);
 state.enabled=true;state.writes=false;assert.equal((await save(url,{fullName:'A'})).status,503);assert.equal(db.writes,0);
}));
test('registered verified identity is required and revocation checks are mandatory',()=>fixture(async(url,db,state)=>{
 assert.equal((await fetch(url)).status,401);
 for(const id of ['invalid','anonymous'])assert.equal((await fetch(url,{headers:headers(id)})).status,401);
 assert.equal((await fetch(url,{headers:headers()})).status,200);
 assert.ok(state.verifyCalls.every((c:any)=>c[1]===true));assert.equal(db.reads,1);
}));
test('wrong-project, wrong-issuer, tenant and invalid UID claims fail closed',async()=>{
 for(const bad of [{aud:'localeats-5e26e'},{iss:'wrong'},{firebase:{sign_in_provider:'password',tenant:'other'}},{uid:'../other'}]){
  await fixture(async(url,db)=>{assert.equal((await fetch(url,{headers:headers()})).status,401);assert.equal(db.reads,0);},{verify:async()=>({...claims(),...bad})});
 }
});
test('confirmed save survives a new HTTP read, preserves partial fields and never returns privilege fields',()=>fixture(async(url,db)=>{
 const first=await save(url,{fullName:' Alice ',phone:'0123456789',latitude:-26,longitude:28,favorites:['shop-a']});
 assert.equal(first.status,200);const saved=await first.json();assert.equal(saved.profile.fullName,'Alice');assert.equal(saved.profile.user_id,'account-a');
 const persisted=db.docs.get('account-a')!;persisted.fields.role='admin';persisted.fields.internal_secret='private';
 const next=await save(url,{city:'Johannesburg'},saved.revision);assert.equal(next.status,200);
 const read=await (await fetch(url,{headers:headers()})).json();
 assert.equal(read.profile.fullName,'Alice');assert.equal(read.profile.city,'Johannesburg');assert.equal(read.profile.latitude,-26);
 assert.equal(read.profile.role,undefined);assert.equal(read.profile.internal_secret,undefined);assert.equal(read.profile.email,'account-a@example.invalid');
}));
test('client identity, role and email tampering are rejected without a write',()=>fixture(async(url,db)=>{
 for(const profile of [{user_id:'account-b'},{role:'admin'},{email:'attacker@example.invalid'},{is_admin:true},{shop_id:'shop-a'}]){
  assert.equal((await save(url,profile)).status,400);
 }
 assert.equal(db.writes,0);
}));
test('one customer cannot choose another profile via body, query or path',()=>fixture(async(url,db)=>{
 const a=await save(url,{fullName:'Private A'});assert.equal(a.status,200);
 const b=await (await fetch(url,{headers:headers('account-b')})).json();assert.equal(b.profile,null);
 assert.equal((await fetch(url+'?user_id=account-a',{headers:headers('account-b')})).status,400);
 assert.equal((await fetch(url+'/account-a',{headers:headers('account-b')})).status,404);
 assert.equal(db.docs.size,1);
}));
test('already persisted fields confirm without another write; changed payload or obsolete revision conflicts',()=>fixture(async(url,db)=>{
 const original=await save(url,{fullName:'First'});const first=await original.json();
 const retry=await save(url,{fullName:'First'});assert.equal(retry.status,200);assert.equal((await retry.json()).revision,first.revision);assert.equal(db.writes,1);
 assert.equal((await save(url,{fullName:'Different'})).status,409);
 const newer=await save(url,{fullName:'Second'},first.revision);assert.equal(newer.status,200);
 assert.equal((await save(url,{fullName:'First'})).status,409);assert.equal(db.docs.get('account-a')!.fields.fullName,'Second');assert.equal(db.writes,2);
}));
test('concurrent saves with one revision cannot overwrite each other',()=>fixture(async(url,db)=>{
 const both=await Promise.all([save(url,{fullName:'First'}),save(url,{fullName:'Second'})]);
 assert.deepEqual(both.map(r=>r.status).sort(),[200,409]);assert.equal(db.docs.size,1);
}));
test('invalid coordinates, malformed revisions, commands, oversized fields and content types are rejected',()=>fixture(async(url,db)=>{
 for(const profile of [{latitude:91,longitude:28},{latitude:-26},{fullName:'a'.repeat(121)},{favorites:[1]},{photo_url:'javascript:alert(1)'}])assert.equal((await save(url,profile)).status,400);
 assert.equal((await save(url,{fullName:'A'},'yesterday')).status,400);
 assert.equal((await fetch(url,{method:'PATCH',headers:headers(),body:JSON.stringify({profile:{fullName:'Alice'},expectedRevision:null,commandId:'unsupported'})})).status,400);
 assert.equal((await fetch(url,{method:'PATCH',headers:{Authorization:'Bearer fb-account-a'},body:'not-json'})).status,415);
 assert.equal(db.writes,0);
}));
test('storage failures and wrong-owner stored records never return saved success or private diagnostics',()=>fixture(async(url,db)=>{
 db.docs.set('account-a',{fields:{user_id:'account-b',fullName:'private'},revision:'2026-11-06T18:00:00.000000001Z'});
 const wrong=await fetch(url,{headers:headers()});assert.equal(wrong.status,503);assert.ok(!(await wrong.text()).includes('private'));
 db.docs.clear();db.write=async()=>{throw Error('private-db-credential');};
 const failed=await save(url,{fullName:'Alice'});assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('credential'));
}));
test('auth timeout cannot start a delayed write after the caller receives a failure',()=>fixture(async(url,db,state)=>{
 let release!:(v:any)=>void;state.verify=()=>new Promise(resolve=>{release=resolve;});
 const response=await save(url,{fullName:'A'});assert.equal(response.status,504);
 release(claims());await new Promise(r=>setTimeout(r,25));assert.equal(db.reads,0);assert.equal(db.writes,0);
},{timeoutMs:20}));

test('a retry cannot confirm requested fields that have since changed',()=>fixture(async(url,db)=>{
 const first=await save(url,{fullName:'Requested'});assert.equal(first.status,200);
 db.docs.get('account-a')!.fields.fullName='Externally changed';
 const retry=await save(url,{fullName:'Requested'});assert.equal(retry.status,409);assert.equal(db.writes,1);
}));
test('malformed legacy public fields fail without leaking arbitrary nested values',()=>fixture(async(url,db)=>{
 db.docs.set('account-a',{fields:{user_id:'account-a',fullName:{internal:'private-nested-value'}},revision:'2026-11-06T18:00:00.123456Z'});
 const response=await fetch(url,{headers:headers()});assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private-nested-value'));
}));
