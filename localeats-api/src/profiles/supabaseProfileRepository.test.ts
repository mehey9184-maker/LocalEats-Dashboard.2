import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {SupabaseRevisionProfileRepository, profileStagingEnabled, PROFILE_STAGE_SUPABASE_URL} from './supabaseProfileRepository.js';
import {ProfileConflict, PROFILE_STAGE_PROJECT} from '../routes/customerProfile.js';
const revision='2026-11-06T18:00:00.123456+00:00';
const row={user_id:'account-a',fullName:'Alice',city:'Johannesburg',role:'admin',updated_at:revision};
function fixture(reply:(url:URL,init:RequestInit)=>Response){
 const calls:Array<{url:URL;init:RequestInit}>=[];
 const db=createClient(PROFILE_STAGE_SUPABASE_URL,'synthetic-stage-test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input:any,init:any)=>{
   const url=new URL(input);calls.push({url,init});return reply(url,init);
 }}});
 return{calls,repo:new SupabaseRevisionProfileRepository(db,PROFILE_STAGE_SUPABASE_URL)};
}
test('staging requires exact Firebase and Supabase projects, explicit flags and non-Production',()=>{
 const valid={CUSTOMER_PROFILE_STAGE_ENABLED:'true',FIREBASE_PROJECT_ID:PROFILE_STAGE_PROJECT,SUPABASE_URL:PROFILE_STAGE_SUPABASE_URL};
 assert.equal(profileStagingEnabled(valid),true);
 for(const bad of [{},{...valid,CUSTOMER_PROFILE_STAGE_ENABLED:'false'},{...valid,FIREBASE_PROJECT_ID:'localeats-5e26e'},{...valid,SUPABASE_URL:'https://phdjumtqkooyppxozqsi.supabase.co'},{...valid,VERCEL_ENV:'production'}])assert.equal(profileStagingEnabled(bad),false);
 assert.throws(()=>new SupabaseRevisionProfileRepository({from(){throw Error('must not call');}} as any,'https://phdjumtqkooyppxozqsi.supabase.co'));
});
test('read scopes actual Supabase request to one Firebase UID and preserves microsecond revision',async()=>{
 const {repo,calls}=fixture(()=>Response.json([row]));const result=await repo.read('account-a',new AbortController().signal);
 assert.equal(calls.length,1);assert.equal(calls[0].url.pathname,'/rest/v1/profiles');assert.equal(calls[0].url.searchParams.get('user_id'),'eq.account-a');
 assert.equal(result?.revision,revision);assert.equal(result?.fields.user_id,'account-a');assert.equal(result?.fields.role,undefined);
});
test('update uses UID+exact revision predicates, no upsert, partial fields and a newer server timestamp',async()=>{
 const {repo,calls}=fixture((_url,init)=>{const body=JSON.parse(String(init.body));return Response.json({...row,...body});});
 await repo.write('account-a',{user_id:'account-a',city:'Tembisa'},revision,new AbortController().signal);
 const {url,init}=calls[0];assert.equal(init.method,'PATCH');assert.equal(url.searchParams.get('updated_at'),'eq.'+revision);assert.equal(url.searchParams.get('user_id'),'eq.account-a');
 const body=JSON.parse(String(init.body));assert.equal(body.fullName,undefined);assert.equal(body.role,undefined);assert.equal(body.city,'Tembisa');assert.ok(Date.parse(body.updated_at)>Date.parse(revision));
 assert.ok(!String(new Headers(init.headers).get('Prefer')).includes('merge-duplicates'));
});
test('create is insert-only and concurrent duplicate or missing update result conflicts',async()=>{
 const created=fixture((_url,init)=>Response.json({...row,...JSON.parse(String(init.body))}));
 await created.repo.write('account-a',{user_id:'account-a',fullName:'Alice'},null,new AbortController().signal);assert.equal(created.calls[0].init.method,'POST');
 const duplicate=fixture(()=>Response.json({code:'23505',message:'private constraint'},{status:409}));
 await assert.rejects(()=>duplicate.repo.write('account-a',{user_id:'account-a'},null,new AbortController().signal),ProfileConflict);
 const stale=fixture(()=>Response.json(null));await assert.rejects(()=>stale.repo.write('account-a',{user_id:'account-a'},revision,new AbortController().signal),ProfileConflict);
});
test('foreign owner, null revision and storage errors cannot produce confirmed data',async()=>{
 for(const result of [{...row,user_id:'account-b'},{...row,updated_at:null}]){
  const {repo}=fixture(()=>Response.json([result]));await assert.rejects(()=>repo.read('account-a',new AbortController().signal));
 }
 const missing=fixture(()=>Response.json([]));assert.equal(await missing.repo.read('account-a',new AbortController().signal),null);
 const failed=fixture(()=>Response.json({code:'42501',message:'private db diagnostic'},{status:403}));await assert.rejects(()=>failed.repo.read('account-a',new AbortController().signal));
});
test('aborted work cannot send a request and client roles/foreign owner cannot enter write record',async()=>{
 const {repo,calls}=fixture(()=>Response.json([row]));const controller=new AbortController();controller.abort();
 await assert.rejects(()=>repo.read('account-a',controller.signal));assert.equal(calls.length,0);
 for(const patch of [{user_id:'account-b'},{user_id:'account-a',role:'admin'},{user_id:'account-a',_profile_command:{id:'not-a-column'}}])await assert.rejects(()=>repo.write('account-a',patch,revision,new AbortController().signal));
 assert.equal(calls.length,0);
});
