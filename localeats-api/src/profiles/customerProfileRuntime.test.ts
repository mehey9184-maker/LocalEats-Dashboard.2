import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../server.js';

test('mounted API defaults profile service off, rejects production and preserves global Preview write lock',async()=>{
 const keys=['CUSTOMER_PROFILE_STAGE_ENABLED','CUSTOMER_PROFILE_STAGE_WRITES_ENABLED','FIREBASE_PROJECT_ID','SUPABASE_URL','VERCEL_ENV','PROFILE_WRITES_ENABLED'];
 const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const server=http.createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${(server.address() as any).port}/api/v1/profiles/me`;
 try {
  for(const key of keys)delete process.env[key];
  process.env.FIREBASE_PROJECT_ID='localeats-pickup-stage-261105';
  assert.equal((await fetch(url)).status,503);
  process.env.CUSTOMER_PROFILE_STAGE_ENABLED='true';process.env.CUSTOMER_PROFILE_STAGE_WRITES_ENABLED='true';
  process.env.FIREBASE_PROJECT_ID='localeats-pickup-stage-261105';process.env.SUPABASE_URL='https://rgpbdajhlrwfmhopzgzk.supabase.co';
  assert.equal((await fetch(url)).status,401);
  const malformed=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{"fullName":"synthetic-malformed'});
  assert.equal(malformed.status,400);
  assert.ok(!(await malformed.text()).includes('synthetic-malformed'));
  process.env.PROFILE_WRITES_ENABLED='true';
  assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,426);
  process.env.VERCEL_ENV='production';assert.equal((await fetch(url)).status,503);
  process.env.FIREBASE_PROJECT_ID='localeats-5e26e';
  assert.equal((await fetch(url)).status,401); // Existing non-staging endpoint remains authenticated.
  process.env.FIREBASE_PROJECT_ID='localeats-pickup-stage-261105';
  assert.equal((await fetch(url.replace('/profiles/me','/customer/profile'))).status,404);
  process.env.VERCEL_ENV='preview';
  const response=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(response.status,503);assert.equal((await response.json()).code,'PREVIEW_READ_ONLY');
  assert.match(response.headers.get('cache-control')||'',/no-store/);
 }finally{
  for(const key of keys){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}
  await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));
 }
});
