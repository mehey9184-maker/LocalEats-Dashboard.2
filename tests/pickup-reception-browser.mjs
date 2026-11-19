import {createServer} from 'vite';import {mkdir} from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_TEST_MODULE||'playwright');
Object.assign(process.env,{VITE_PICKUP_ACCEPTANCE_ENABLED:'true',VITE_PICKUP_ORDERING_ENABLED:'true',VITE_LOCALEATS_API_URL:'http://127.0.0.1:4196'});
const entry=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{PickupReception}from'/src/components/PickupReception';import'/src/index.css';
function Fixture(){const[owner,setOwner]=useState('merchant'),[shop,setShop]=useState('shop');window.setOwner=setOwner;window.setShop=setShop;return <PickupReception shopId={shop} ownerId={owner}/>}createRoot(document.getElementById('root')).render(<Fixture/>);`;
const server=await createServer({optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-runtime']},server:{host:'127.0.0.1',port:4196,strictPort:true,hmr:false},plugins:[{name:'isolated-reception-fixture',enforce:'pre',
 configureServer(s){s.middlewares.use('/__reception',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/__fixture.tsx"></script>');});},
 resolveId(id){if(id==='/__fixture.tsx')return id;},load(id){if(id==='/__fixture.tsx')return entry;},
 transform(source,id){if(/[\\/]src[\\/]lib[\\/]firebase\.ts$/.test(id))return `export const auth={currentUser:{uid:'merchant',getIdToken:()=>window.hangToken?new Promise(()=>{}):Promise.resolve('synthetic-fixture-token')}};`;}}]});
let browser;
try{await server.listen();browser=await chromium.launch({channel:process.env.CI?undefined:'chrome',headless:true});await mkdir('.tmp/acceptance-browser',{recursive:true});
for(const width of [320,390,1280]){
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});let resumed=0;
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/api/v1/merchant/')){
   if(route.request().method()==='POST'){resumed++;assert.deepEqual(route.request().postDataJSON(),{shop_id:'shop',expected_revision:1});}
   return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,enabled:true,notices:[{shop_id:'shop',kind:'merchant_reminder'}],reception:{shop_id:'shop',paused:!resumed,revision:resumed?2:1}})});
  }
  return url.hostname==='127.0.0.1'?route.continue():route.abort();
 });
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>{errors.push(e.message);console.error('FIXTURE_PAGE_ERROR',e.message);});
 await page.goto('http://127.0.0.1:4196/__reception',{waitUntil:'domcontentloaded',timeout:60000});const start=page.getByRole('button',{name:'Start receiving orders',exact:true});await start.waitFor({timeout:60000});
 await page.getByText('1 pending request needs a response.',{exact:false}).waitFor();
 assert.equal(await start.boundingBox().then(r=>r.height>=44),true);await page.screenshot({path:'.tmp/acceptance-browser/paused-'+width+'.png'});
 await start.click();await page.getByRole('heading',{name:'Order reception available',exact:true}).waitFor();assert.equal(resumed,1);
 await page.evaluate(()=>window.setOwner('other'));await page.getByRole('region',{name:'Pickup order reception'}).waitFor({state:'hidden'});
 if(width===390){
  await page.evaluate(()=>window.setOwner('merchant'));await page.getByRole('heading',{name:'Order reception available',exact:true}).waitFor();
  await page.evaluate(()=>{window.hangToken=true;window.setShop('second-shop');});
  await page.getByRole('heading',{name:'Checking order reception',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Order reception available',exact:true}).count(),0);
  await page.getByText('Couldn’t verify order reception.',{exact:false}).waitFor({timeout:20000});
  assert.equal(await page.getByRole('button',{name:'Refresh reception',exact:true}).isEnabled(),true);
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('MERCHANT_RECEPTION_BROWSER_PASS',width,'paused state, authoritative resume, account isolation');await context.close();
}}catch(error){console.error('MERCHANT_FIXTURE_FAILED',error.message);throw error;}finally{await browser?.close();await server.close();}
