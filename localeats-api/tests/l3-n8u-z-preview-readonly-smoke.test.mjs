import test from 'node:test';
import assert from 'node:assert/strict';
import {strictPreviewOrigin,checkPilotPreview} from './l3-n8u-z-preview-readonly-smoke.mjs';

const api='https://localeats-api-git-review-l3-n8-abc123-mehey9184-makers-projects.vercel.app';
const customer='https://project-x7cvt-git-review-l3-n8-b990d2-mehey9184-makers-projects.vercel.app';
const shopId='shop-my-kota-ivory-park';
const headers={
 'access-control-allow-origin':customer,
 'access-control-allow-methods':'GET, POST, OPTIONS',
 'access-control-allow-headers':'Content-Type,Authorization'
};
const response=(status,body)=>new Response(body===null?null:JSON.stringify(body),{
 status,headers:{...headers,...(body===null?{}:{'Content-Type':'application/json'})}
});
const makeTransport=(mutateResponse=identity=>identity)=>{
 const requests=[];
 async function transport(url,opts){
   requests.push({url,method:opts.method,origin:opts.headers.Origin});
   assert.ok(['GET','OPTIONS'].includes(opts.method),'Only GET and OPTIONS may be sent');
   assert.ok(url.startsWith(api+'/'));
   const path=new URL(url).pathname;
   let result;
   if(opts.method==='OPTIONS')result=response(204,null);
   else if(path==='/health')result=response(200,{status:'ok',service:'localeats-api'});
   else if(path==='/api/v1/catalog/shops')result=response(200,{success:true,shops:[{id:shopId,is_active:false,effective_is_active:false}]});
   else if(path==='/api/v1/catalog/shops/'+shopId+'/menu')result=response(200,{success:true,menu_items:[{id:'real-menu',name:'cheeze, palone and meat',price:25,is_available:true}]});
   else result=response(404,{success:false,error:'Shop not found'});
   return mutateResponse(result,path);
 }
 return {transport,requests};
};

test('only explicit customer/API Preview origins accepted, no Production aliases',()=>{
 assert.equal(strictPreviewOrigin(api,{project:'api'}),api);
 assert.equal(strictPreviewOrigin(customer,{project:'customer'}),customer);
 for(const url of [
   'https://localeats-api.vercel.app',
   'https://project-x7cvt.vercel.app',
   'https://localeats-api-git-main-mehey9184-makers-projects.vercel.app',
   'http://localeats-api-git-review-l3-n8-abc123-mehey9184-makers-projects.vercel.app',
   api+'/api/v1/catalog/shops',
   api+'/?bypass=true',
   'https://www.localeatssa.co.za',
   'https://unknown.example.com'
 ])assert.throws(()=>strictPreviewOrigin(url,{project:'api'}));
});

test('real Preview verification sequence uses only public GET and OPTIONS',async()=>{
 const {transport,requests}=makeTransport();
 const notes=[];
 const result=await checkPilotPreview({apiUrl:api,customerUrl:customer,transport,log:m=>notes.push(m)});
 assert.equal(result.passed,true);
 assert.equal(result.writesAttempted,0);
 assert.equal(requests.length,8);
 assert.ok(requests.every(r=>r.origin===customer && ['GET','OPTIONS'].includes(r.method)));
 assert.ok(notes.includes('MY_KOTA_R25_MENU_PASS'));
 assert.ok(notes.includes('EXCLUDED_SHOP_DETAILS_AND_MENUS_404_PASS'));
});

test('extra public shop is a hard failure, never accepted as My-Kota-only',async()=>{
 const {transport}=makeTransport((response,path)=>{
   if(path==='/api/v1/catalog/shops')return new Response(JSON.stringify({
     success:true,shops:[{id:shopId,effective_is_active:false},{id:'test-shop',effective_is_active:false}]
   }),{status:200,headers:{...headers,'Content-Type':'application/json'}});
   return response;
 });
 await assert.rejects(
   checkPilotPreview({apiUrl:api,customerUrl:customer,transport,log:()=>{}}),
   /publish My-Kota only/
 );
});

test('wrong CORS allow-origin fails, including a successful HTTP 200 response',async()=>{
 const {transport}=makeTransport((_response,path)=>{
   return new Response(null,{status:204,headers:{...headers,'access-control-allow-origin':'https://wrong.example.com'}});
 });
 await assert.rejects(
   checkPilotPreview({apiUrl:api,customerUrl:customer,transport,log:()=>{}}),
   /explicitly allow this exact Customer Preview origin/
 );
});

test('the pilot must be closed and its genuine R25 item present',async()=>{
 const {transport}=makeTransport((response,path)=>{
   if(path==='/api/v1/catalog/shops')return new Response(JSON.stringify({success:true,shops:[{id:shopId,effective_is_active:true}]}),{status:200,headers:{...headers,'Content-Type':'application/json'}});
   return response;
 });
 await assert.rejects(checkPilotPreview({apiUrl:api,customerUrl:customer,transport,log:()=>{}}),/unavailable for ordering/);
});
