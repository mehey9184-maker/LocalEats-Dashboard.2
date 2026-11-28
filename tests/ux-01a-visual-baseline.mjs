import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const root=process.cwd(), out=resolve(process.env.UX_AUDIT_OUTPUT||'ux-audit-evidence');
await mkdir(out,{recursive:true});
const scenes=[{"name":"home-compact","path":"/__ux-home","mode":"compact","ready":"main button"},{"name":"home-advanced","path":"/__ux-home","mode":"advanced","ready":"main button"},{"name":"home-loading","path":"/__ux-home?state=loading","mode":"compact","ready":"main div"}];
const stubPlugin={name:'isolated-merchant-home',setup(b){
 b.onLoad({filter:/[\\/]lib[\\/]firebase\.ts$/},()=>({contents:'export async function updateFirestoreShop(){throw Error("Fixture writes blocked")}',loader:'js'}));
 b.onLoad({filter:/[\\/]lib[\\/]supabase\.ts$/},()=>({contents:'const result={count:0,data:[],error:null};const q={select:()=>q,eq:()=>q,gt:()=>q,order:()=>q,limit:()=>q,then:(ok,fail)=>Promise.resolve(result).then(ok,fail)};export const supabase={from:()=>q,removeChannel:async()=>{}};',loader:'js'}));
 b.onLoad({filter:/[\\/]hooks[\\/]useAuthGuard\.ts$/},()=>({contents:'const subscribeWithAuthGuard=async()=>null;export const useAuthGuard=()=>({subscribeWithAuthGuard});',loader:'js'}));
 b.onLoad({filter:/[\\/]utils[\\/]availabilityChecker\.ts$/},()=>({contents:'export async function syncShopAvailability(){throw Error("Fixture writes blocked")}',loader:'js'}));
 b.onLoad({filter:/[\\/]components[\\/]MenuManagement\.tsx$/},()=>({contents:'export const FoodPlaceholder=()=>null;',loader:'js'}));
}};
const jsx="import React from 'react';import {createRoot} from 'react-dom/client';import {DashboardOverview} from './src/components/DashboardOverview';import {LocalEatsLogo} from './src/components/LocalEatsLogo';const q=new URLSearchParams(location.search);const shop={id:'fixture-kitchen',owner_id:'fixture-merchant',name:'Fixture kitchen',opening_time:'08:00',closing_time:'20:00',is_active:true};const noop=()=>{};createRoot(document.getElementById('root')!).render(<><header className='p-4 border-b border-outline-variant/20'><LocalEatsLogo width={180} height={48}/></header><main className='p-4 md:p-8'><DashboardOverview orders={[]} loading={q.get('state')==='loading'} shops={[shop]} user={{id:'fixture-merchant'}} onRefresh={noop} onNavigate={noop} onEditProfile={noop} menuItems={[]} menuReadState='ready' orderReadState='fresh' trialInfo={null} currentShop={shop} darkMode={document.documentElement.classList.contains('dark')}/></main></>);";
const bundle=(await build({stdin:{contents:jsx,resolveDir:root,loader:'tsx'},bundle:true,platform:'browser',write:false,define:{'process.env.NODE_ENV':'"production"','import.meta.env':JSON.stringify({VITE_PICKUP_ORDERING_ENABLED:'false'})},plugins:[stubPlugin]})).outputFiles[0].contents;
const auditPlugin={name:'ux-readonly-fixture',configureServer(s){s.middlewares.use((req,res,next)=>{const u=new URL(req.url,'http://127.0.0.1');if(u.pathname==='/__ux-home'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module" src="/src/index.css"></script></head><body class="bg-surface text-on-surface"><div id="root"></div><script type="module" src="/__ux-bundle.js"></script></body></html>');return;}if(u.pathname==='/__ux-bundle.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle);return;}next();});}};
const server=await createServer({root,configFile:join(root,'vite.config.ts'),server:{host:'127.0.0.1',port:0},plugins:[auditPlugin]});
let browser;const reports=[];
try{
 await server.listen();
 const origin='http://127.0.0.1:'+server.httpServer.address().port;
 browser=await chromium.launch({headless:true});
 for(const [width,height] of [[320,640],[390,844],[768,1024],[1440,900]])for(const theme of ['light','dark'])for(const scene of scenes){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block',timezoneId:'Africa/Johannesburg',permissions:[]});
  const blocked=new Set(),writes=[],pageErrors=[];
  await context.addInitScript(({theme,mode})=>{const apply=()=>document.documentElement?.classList.toggle('dark',theme==='dark');apply();const observer=new MutationObserver(()=>{if(document.documentElement){apply();observer.disconnect();}});observer.observe(document,{childList:true,subtree:true});try{localStorage.setItem('localeats_dashboard_layout',mode||'compact');}catch{}},{theme,mode:scene.mode});
  await context.route('**/*',async r=>{const req=r.request(),u=new URL(req.url());if(!['GET','HEAD'].includes(req.method())){writes.push(req.method()+' '+u.pathname);return r.abort();}if(u.origin===origin&&!u.pathname.startsWith('/api/')&&!u.pathname.startsWith('/rest/')&&!u.pathname.startsWith('/auth/'))return r.continue();if(u.protocol==='data:'||u.protocol==='blob:')return r.continue();blocked.add(u.origin+u.pathname);return r.abort();});
  const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.goto(origin+scene.path,{waitUntil:'domcontentloaded'});await page.locator(scene.ready).first().waitFor({timeout:20000});
  
  await page.evaluate(t=>document.documentElement.classList.toggle('dark',t==='dark'),theme);
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  await page.waitForTimeout(350);
  const metrics=await page.evaluate(()=>{
    const W=innerWidth,H=innerHeight, visible=e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return b.width>0&&b.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
    const label=e=>(e.getAttribute('aria-label')||e.innerText||e.getAttribute('title')||e.tagName).trim().slice(0,80);
    const interactive=[...document.querySelectorAll('button:not([disabled]),a[href],input:not([type=hidden]),select,textarea,[role=button]')].filter(visible).map(e=>{const b=e.getBoundingClientRect();return {label:label(e),w:Math.round(b.width),h:Math.round(b.height),x:Math.round(b.x),y:Math.round(b.y)};});
    const fixed=[...document.querySelectorAll('header,nav,[role=navigation],footer')].filter(visible).map(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return {label:label(e),position:s.position,x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};});
    const text=[...document.querySelectorAll('h1,h2,h3,button,p,label')].filter(visible).map(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return {label:label(e),font:s.fontSize,weight:s.fontWeight,colour:s.color,lineHeight:s.lineHeight,x:Math.round(b.x),w:Math.round(b.width),clipped:e.clientWidth>0&&e.scrollWidth>e.clientWidth+2&&['hidden','clip'].includes(s.overflowX)};});
    return {viewport:{width:W,height:H},documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,theme:document.documentElement.classList.contains('dark')?'dark':'light',interactiveCount:interactive.length,touchTargetsBelow44:interactive.filter(e=>e.w<44||e.h<44),horizontalInteractiveCandidates:interactive.filter(e=>e.x< -1||e.x+e.w>W+1),fixed,clippedTextCandidates:text.filter(x=>x.clipped),typography:[...new Set(text.map(x=>x.font+'/'+x.weight))].sort(),wordmarks:[...document.querySelectorAll('svg text')].filter(visible).map(e=>({text:e.textContent,extent:Math.round((e.getBBox().x+e.getBBox().width)*100)/100,fill:getComputedStyle(e).fill}))};
  });
  const filename=scene.name+'-'+width+'-'+theme+'.png';
  await page.screenshot({path:join(out,filename),fullPage:true,animations:'disabled'});
  reports.push({scene:scene.name,width,theme,filename,metrics,blockedExternal:[...blocked].sort(),writes,pageErrors});
  await writeFile(join(out,'metrics.json'),JSON.stringify(reports,null,2));
  assert.equal(writes.length,0,'Unexpected mutation attempt in isolated fixture');
  assert.deepEqual(pageErrors,[],'Browser exception in '+filename);
  assert.equal(metrics.theme,theme);
  if(process.env.UX_REQUIRE_FIXES==='true'&&scene.name==='home-loading'){
    assert.ok(metrics.documentWidth<=width+1,'Loading skeleton horizontal overflow '+JSON.stringify({width,theme,documentWidth:metrics.documentWidth}));
  }
  await context.close();
 }
 console.log('UX_BASELINE_CAPTURED',JSON.stringify({captures:reports.length,scenes:scenes.map(s=>s.name),source:process.env.UX_AUDIT_SHA}));
}finally{await browser?.close();await server.close();}
