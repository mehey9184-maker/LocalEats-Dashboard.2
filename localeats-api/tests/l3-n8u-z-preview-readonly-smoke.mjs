/**
 * L3-N8U-Z: exact-Preview, public-read-only release acceptance.
 * Does NOT send POST/PUT/PATCH/DELETE, set cookies, emulate GPS, sign in or
 * alter Production. Requires two explicit, distinct HTTPS Preview origins.
 * Do NOT use against the production URL or the public app.
 *
 * API_PREVIEW_URL=https://<specific API Preview>.vercel.app
 * CUSTOMER_PREVIEW_ORIGIN=https://<specific Customer Preview>.vercel.app
 * node tests/l3-n8u-z-preview-readonly-smoke.mjs
 */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const MY_KOTA='shop-my-kota-ivory-park';
const HIDDEN_SHOPS=['shop-current-account-test','shop-soweto-01'];
const REQUEST_TIMEOUT_MS=15000;

export function strictPreviewOrigin(raw,{project}={}){
 assert.equal(typeof raw,'string','Provide an explicit Preview origin');
 const url=new URL(raw);
 assert.equal(url.protocol,'https:','Preview must use HTTPS');
 assert.equal(url.origin,raw,'Preview must be a bare HTTPS origin (no paths, queries, fragments or trailing slash)');
 assert.equal(url.username,'');
 assert.equal(url.password,'');
 const h=url.hostname;
 // Require branch aliases, never an immutable deployment URL: immutable
 // Vercel Production hosts also end in "-mehey9184-makers-projects.vercel.app".
 const previewAlias=project==='api'
   ? 'localeats-api-git-review-'
   : project==='customer'
     ? 'project-x7cvt-git-review-'
     : null;
 assert.ok(previewAlias!==null,'Specify API or Customer Preview project');
 assert.ok(h.startsWith(previewAlias) && h.endsWith('-mehey9184-makers-projects.vercel.app'),
   'Require exact selected Git review-branch Preview alias (never immutable Production URL)');
 assert.ok(!h.includes('-git-main-') && !h.includes('-git-production-'),
   'Never test main or production branch deployments');
 return url.origin;
}

function expectCors(response,origin){
 assert.equal(response.headers.get('access-control-allow-origin'),origin,
   'API must explicitly allow this exact Customer Preview origin');
}

async function request(fetchImpl,apiOrigin,customerOrigin,path,method='GET'){
 const response=await fetchImpl(apiOrigin+path,{
   method,signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS),
   redirect:'error',cache:'no-store',headers:{
     'Origin':customerOrigin,
     ...(method==='OPTIONS'?{
       'Access-Control-Request-Method':'GET',
       'Access-Control-Request-Headers':'content-type'
     }: {'Content-Type':'application/json'})
   }
 });
 expectCors(response,customerOrigin);
 return response;
}

export async function checkPilotPreview({apiUrl,customerUrl,transport=fetch,log=console.log}){
 const apiOrigin=strictPreviewOrigin(apiUrl,{project:'api'});
 const customerOrigin=strictPreviewOrigin(customerUrl,{project:'customer'});
 assert.notEqual(apiOrigin,customerOrigin,'Customer and API must be separate Preview projects');

 const preflight=await request(transport,apiOrigin,customerOrigin,'/api/v1/catalog/shops','OPTIONS');
 assert.ok(preflight.status===204||preflight.status===200,'CORS OPTIONS must succeed');
 assert.match(preflight.headers.get('access-control-allow-methods')||'',/GET/);
 assert.match(preflight.headers.get('access-control-allow-headers')||'',/content-type/i);
 log('PREFLIGHT_EXACT_CUSTOMER_ORIGIN_PASS');

 const health=await request(transport,apiOrigin,customerOrigin,'/health');
 assert.equal(health.status,200);assert.equal((await health.json()).service,'localeats-api');
 log('API_PREVIEW_HEALTH_PASS');

 const list=await request(transport,apiOrigin,customerOrigin,'/api/v1/catalog/shops');
 assert.equal(list.status,200);
 const listed=await list.json();
 assert.equal(listed.success,true);
 assert.ok(Array.isArray(listed.shops));
 assert.deepEqual(listed.shops.map(s=>s.id),[MY_KOTA],'Preview must publish My-Kota only');
 assert.equal(listed.shops[0].effective_is_active,false,'Pilot merchant must remain unavailable for ordering');
 log('MY_KOTA_ONLY_PUBLIC_CATALOG_PASS');

 const menu=await request(transport,apiOrigin,customerOrigin,
   '/api/v1/catalog/shops/'+MY_KOTA+'/menu');
 assert.equal(menu.status,200);
 const data=await menu.json();
 assert.equal(data.success,true);
 assert.ok(Array.isArray(data.menu_items));
 assert.ok(data.menu_items.some(i=>i.name==='cheeze, palone and meat'&&i.price===25&&i.is_available===true),
   'Expected genuine R25 item must remain browseable');
 log('MY_KOTA_R25_MENU_PASS');

 for(const shopId of HIDDEN_SHOPS)for(const suffix of ['','/menu']){
   const result=await request(transport,apiOrigin,customerOrigin,
     '/api/v1/catalog/shops/'+encodeURIComponent(shopId)+suffix);
   assert.equal(result.status,404,'Excluded shop detail/menu must remain hidden');
 }
 log('EXCLUDED_SHOP_DETAILS_AND_MENUS_404_PASS');
 return {passed:true,apiPreview:apiOrigin,customerPreview:customerOrigin,shops:[MY_KOTA],writesAttempted:0};
}

const runFromCLI=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(runFromCLI){
 checkPilotPreview({
   apiUrl:process.env.API_PREVIEW_URL,
   customerUrl:process.env.CUSTOMER_PREVIEW_ORIGIN
 }).then(result=>{
   console.log('L3_N8U_Z_READ_ONLY_PREVIEW_ACCEPTANCE_PASS',JSON.stringify(result));
 }).catch(error=>{
   console.error('L3_N8U_Z_PREVIEW_ACCEPTANCE_FAIL',String(error));
   process.exitCode=1;
 });
}
