// Real mounted React components, actual MerchantApi and auth-generation helper; fake auth/media/network only.
import {readFileSync,readdirSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {setTimeout as delay} from 'node:timers/promises';
const entry="import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';import {CreateShopOnboarding} from './src/components/CreateShopOnboarding';import {OnboardingTour} from './src/components/OnboardingTour';import {switchUser} from './src/lib/firebase';\nlet mode='ok',posts=0,reads=0,created=[],release=null,serial=0;const root=createRoot(document.getElementById('root'));\nconst wait=()=>new Promise(r=>release=r);window.fixtureUpload=async()=>{if(mode==='upload')await wait();return 'https://example.invalid/fixture.png';};\nObject.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok){ok({coords:{latitude:-26,longitude:28}})}}});\nconst reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});\nwindow.fetch=async(url,opts={})=>{const u=String(url);if(u.startsWith('https://nominatim.openstreetmap.org/'))return reply({display_name:'Fixture address'});if(!u.endsWith('/api/v1/merchant/shop'))throw Error('unexpected synthetic fetch');if(opts.method==='POST'){posts++;if(mode==='response')await wait();if(mode==='duplicate')return reply({error:'duplicate'},409);return reply({success:true,shop:{id:'fixture-shop',owner_id:mode==='foreign'?'B':'A',approval_status:'pending',is_active:false,archived_at:null}},201);}reads++;if(mode==='duplicate')await wait();return reply({success:true,shop:{id:'fixture-shop',owner_id:'A',approval_status:'pending',is_active:false,archived_at:null}});};\nfunction Tour(){const [tab,setTab]=useState('dashboard');return <OnboardingTour activeTab={tab} setActiveTab={setTab} isOpen={true} onComplete={()=>created.push('tour')}/>;}\nwindow.harness={ready:()=>true,mount:m=>{mode=m;posts=reads=0;created=[];release=null;switchUser('A');flushSync(()=>root.render(m==='tour'?<Tour key={++serial}/>:<CreateShopOnboarding key={++serial} onCreated={s=>created.push(s.id)} onSignOut={()=>switchUser('B')}/>));},switchUser,release:()=>{if(!release)throw Error('no pending fixture');release();release=null;},state:()=>({posts,reads,created,waiting:!!release,text:document.body.innerText}),fill:(selector,value)=>{const el=document.querySelector(selector);if(!el)throw Error('missing input '+selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));},click:t=>{const el=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()===t);if(!el||el.disabled)throw Error('missing or disabled button '+t);el.click();},photo:()=>{const dt=new DataTransfer();dt.items.add(new File(['fixture'],'fixture.png',{type:'image/png'}));const el=document.querySelector('input[type=file]');el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));}};";
const authMock="let before=[],after=[];export const auth={currentUser:null,beforeAuthStateChanged:f=>before.push(f),onAuthStateChanged:f=>after.push(f)};export function switchUser(uid){before.forEach(f=>f());auth.currentUser=uid?{uid,getIdToken:async()=>uid}:null;after.forEach(f=>f(auth.currentUser));}";
const plugin={name:'fixture-adapters',setup(b){
 b.onResolve({filter:/(^|\/)firebase$/},a=>({path:'auth',namespace:'fixture'}));
 b.onResolve({filter:/(^|\/)cloudinary$/},a=>({path:'media',namespace:'fixture'}));
 b.onResolve({filter:/(^|\/)LeafletMap$/},a=>({path:'map',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='auth'?authMock:a.path==='media'?'export const uploadImageToCloudinary=()=>window.fixtureUpload();':'export const LeafletMap=()=>null;',loader:'js'}));
}};
const compiled=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',plugins:[plugin],define:{'process.env.NODE_ENV':'"production"','import.meta.env':JSON.stringify({VITE_LOCALEATS_API_URL:'https://fixture.invalid',VITE_PICKUP_ORDERING_ENABLED:'false'})}});
const js=compiled.outputFiles[0].text;
const css=readdirSync('dist/assets').filter(f=>f.endsWith('.css')).map(f=>readFileSync(path.join('dist/assets',f),'utf8')).join('\n');
assert.ok(css.length>0);
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>';
const server=createServer((req,res)=>{if(req.url==='/fixture.js'){res.setHeader('Content-Type','application/javascript');res.end(js);}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}else if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);}else{res.statusCode=404;res.end();}});
const profile=mkdtempSync(path.join(tmpdir(),'r2a1-browser-'));
let chrome,ws,chromeDiagnostics='';
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const origin='http://127.0.0.1:'+server.address().port;
 const binary=['google-chrome','google-chrome-stable','chromium','chromium-browser'].map(name=>{try{return execFileSync('which',[name],{encoding:'utf8'}).trim();}catch{return '';}}).find(Boolean);
 assert.ok(binary,'A preinstalled Chrome/Chromium executable is required; do not skip browser gate');
 console.log('R2A1_BROWSER_VERSION '+execFileSync(binary,['--version'],{encoding:'utf8'}).trim());
 chrome=spawn(binary,['--headless','--disable-gpu','--disable-lcd-text','--font-render-hinting=none','--force-color-profile=srgb','--hide-scrollbars','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe'],detached:true});
 chrome.stderr.on('data',chunk=>{chromeDiagnostics=(chromeDiagnostics+chunk.toString()).slice(-4000);});
 let port;
 for(let n=0;n<450;n++){const file=path.join(profile,'DevToolsActivePort');if(existsSync(file)){port=Number(readFileSync(file,'utf8').split('\n')[0]);if(port)break;}if(chrome.exitCode!==null)throw Error('Chrome exited');await delay(100);}
 assert.ok(port,'Chrome debug port unavailable after 45s');
 const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 const target=targets.find(t=>t.type==='page');assert.ok(target);
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let next=0;const pending=new Map();
 ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);const waiter=pending.get(msg.id);if(waiter){pending.delete(msg.id);clearTimeout(waiter.timer);msg.error?waiter.reject(Error(JSON.stringify(msg.error))):waiter.resolve(msg.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},10000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp('Page.navigate',{url:origin});
 let ready=false;for(let n=0;n<100;n++){try{ready=await evaluate('!!window.harness?.ready()');}catch{}if(ready)break;await delay(100);}assert.ok(ready,'Synthetic fixture did not mount');

 const state=()=>evaluate('harness.state()');
 const until=async(predicate)=>{for(let i=0;i<100;i++){const s=await state();if(predicate(s))return s;await delay(50);}throw Error('fixture condition timed out: '+JSON.stringify(await state()));};
 const click=t=>evaluate('harness.click('+JSON.stringify(t)+')');
 const fill=(sel,val)=>evaluate('harness.fill('+JSON.stringify(sel)+','+JSON.stringify(val)+')');
 async function setup(mode){
  await evaluate('harness.mount('+JSON.stringify(mode)+')');
  await fill('input[maxlength="100"]','Fixture Kota');await fill('input[type=tel]','0821234567');
  await click('Kota / Street Food');await click('Continue');await until(s=>s.text.includes('Shop address'));
  await click('Use my current location');await until(s=>!s.text.includes('Finding your location')&&!s.text.includes('Resolving'));
  await fill('input[maxlength="300"]','Fixture address');await click('Continue');await until(s=>s.text.includes('Submit shop for approval'));
  await evaluate('harness.photo()');await delay(80);await click('Submit shop for approval');
 }
 await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});
 await setup('ok');await until(s=>s.created.length===1);assert.equal((await state()).posts,1);
 await setup('foreign');await until(s=>s.text.includes("We couldn't create your shop right now."));assert.equal((await state()).posts,1);assert.equal((await state()).created.length,0);console.log('R2A1_FOREIGN_RECEIPT_REJECTED');
 await setup('upload');await until(s=>s.waiting);await evaluate("harness.switchUser('B');harness.release()");await until(s=>!s.text.includes('Submitting your shop'));assert.equal((await state()).posts,0);assert.equal((await state()).created.length,0);
 await setup('response');await until(s=>s.waiting);await evaluate("harness.switchUser('B');harness.switchUser('A');harness.release()");await until(s=>!s.text.includes('Submitting your shop'));assert.equal((await state()).posts,1);assert.equal((await state()).created.length,0);
 await setup('duplicate');await until(s=>s.waiting&&s.reads===1);await evaluate("harness.switchUser('B');harness.release()");await until(s=>!s.text.includes('Submitting your shop'));assert.equal((await state()).posts,1);assert.equal((await state()).created.length,0);
 await evaluate("harness.mount('tour')");await until(s=>s.text.includes('Welcome to LocalEats Merchant'));await click("Let's Go");
 for(const title of ['Your Shop Dashboard','Show Your Food Menu','Practise a Pickup Order','Invite Customers to Your Shop','Notifications & Settings','Ready to Practise, Not Yet Live']){await until(s=>s.text.includes(title));assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));if(title!=='Ready to Practise, Not Yet Live')await click('Next');}
 await click('Done');await until(s=>s.created.includes('tour'));
 console.log('R2A1_MOUNTED_PASS '+JSON.stringify({onboarding:5,tour:7,width:320,scope:'actual components and client, synthetic auth/media/location/HTTP, no hosted calls'}));
}catch(error){
 console.error('R2A1_BROWSER_FAILURE '+String(error?.stack||error).slice(0,3000));
 if(chromeDiagnostics)console.error('R2A1_CHROME_DIAGNOSTICS '+chromeDiagnostics);
 process.exitCode=1;
}finally{
 if(ws)ws.close();
 if(chrome?.pid){
  try{process.kill(-chrome.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')console.warn('Chrome shutdown: '+error.code);}
  await delay(700);
  try{process.kill(-chrome.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')console.warn('Chrome forced shutdown: '+error.code);}
 }
 server.closeAllConnections();await new Promise(r=>server.close(r));
 try{rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:250});}catch(error){
  console.warn('Disposable synthetic browser profile cleanup: '+error.code);
 }
}
