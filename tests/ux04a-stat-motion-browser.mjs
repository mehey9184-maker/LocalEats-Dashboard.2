// Synthetic browser fixture only. No application entrypoint or service credentials.
import {readFileSync,readdirSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {build} from 'esbuild';
import {setTimeout as delay} from 'node:timers/promises';
const source=readFileSync('src/components/DashboardOverview.tsx','utf8');const old=execFileSync('git',['show','cec31cf70e3338dfcbba34d62d464febac26157e:src/components/DashboardOverview.tsx'],{encoding:'utf8'});const stat=s=>{const i=s.indexOf('const StatCard = React.memo('),j=s.indexOf('// --- Components ---',i);assert.ok(i>=0&&j>i);return s.slice(i,j);};const before=stat(old),after=stat(source);const shadow='shadow-[0_2px_8px_rgba(15,23,42,0.08),0_6px_18px_rgba(15,23,42,0.04)]';assert.equal(after.replace('transition-[transform,translate,scale,box-shadow] duration-[220ms] motion-reduce:transition-none motion-reduce:hover:translate-y-0','transition-all duration-500').replace('active:scale-95 motion-reduce:active:scale-100','active:scale-95').replace('transition-[opacity,transform,scale] duration-[240ms] motion-reduce:transition-none motion-reduce:group-hover:scale-100','transition-all duration-700'),before);
const entry='import React from "react";import {createRoot} from "react-dom/client";import {flushSync} from "react-dom";import {Clock,ReceiptText} from "lucide-react";import {clsx} from "clsx";import {twMerge} from "tailwind-merge";const cn=(...x)=>twMerge(clsx(x));'+before.replace('const StatCard =','const OldCard =')+after+'const root=createRoot(document.getElementById("root"));window.harness={mount:(mode,dark)=>{window.uxClicks=0;document.documentElement.classList.toggle("dark",dark);const Card=mode==="old"?OldCard:StatCard;flushSync(()=>root.render(<main className="bg-surface-container-low p-4 min-h-screen"><div data-fixture="stats" className="grid grid-cols-2 gap-3 md:gap-6"><Card title="Avg Order Value" value="R25.00" icon={ReceiptText} colorClass="bg-primary/10 text-primary" onClick={()=>window.uxClicks++}/><Card title="Followers" value={12} icon={Clock} colorClass="bg-primary/10 text-primary"/><Card title="Kitchen queue" value={3} icon={Clock} colorClass="bg-primary/10 text-primary"/><Card title="Subscription" value="Active" icon={ReceiptText} colorClass="bg-primary/10 text-primary"/></div></main>));},ready:()=>true};';
const compiled=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"','import.meta.env':JSON.stringify({VITE_PICKUP_ORDERING_ENABLED:"false",VITE_MERCHANT_PREVIEW_READ_ONLY:"true",VITE_MERCHANT_FAKE_ORDERS_ENABLED:"false"})},plugins:[{name:"deny-api",setup(b){b.onResolve({filter:/MerchantApi$/},()=>({path:"deny",namespace:"fixture-api"}));b.onLoad({filter:/.*/,namespace:"fixture-api"},()=>({loader:"js",contents:'export const MerchantApi={getPendingPickupCommandPath:()=>null,transitionPickupOrder:()=>{throw Error("Forbidden fixture write")},retryPendingPickupOrder:()=>{throw Error("Forbidden fixture retry")}};'}));}}]});
const js=compiled.outputFiles[0].text;
const css=readdirSync('dist/assets').filter(f=>f.endsWith('.css')).map(f=>readFileSync(path.join('dist/assets',f),'utf8')).join('\n');
assert.ok(css.length>0);
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{margin:0}*{caret-color:transparent!important}</style></head><body tabindex="-1"><div id="root"></div><script src="/fixture.js"></script></body></html>';
const server=createServer((req,res)=>{
 const p=new URL(req.url,'http://127.0.0.1').pathname;
 if(p==='/fixture.js'){res.setHeader('Content-Type','application/javascript');res.end(js);}
 else if(p==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}
 else if(p==='/'){res.setHeader('Content-Type','text/html');res.end(html);}
 else{res.statusCode=404;res.end();}
});
const profile=mkdtempSync(path.join(tmpdir(),'h1d3-browser-'));
let chrome,ws,chromeDiagnostics='';
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const origin='http://127.0.0.1:'+server.address().port;
 const binary=['google-chrome','google-chrome-stable','chromium','chromium-browser'].map(name=>{try{return execFileSync('which',[name],{encoding:'utf8'}).trim();}catch{return '';}}).find(Boolean);
 assert.ok(binary,'A preinstalled Chrome/Chromium executable is required; do not skip browser gate');
 console.log('H1D3_BROWSER_VERSION '+execFileSync(binary,['--version'],{encoding:'utf8'}).trim());
 chrome=spawn(binary,['--headless','--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4','--disable-gpu','--disable-lcd-text','--font-render-hinting=none','--force-color-profile=srgb','--hide-scrollbars','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe'],detached:true});
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
 const settle='new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>document.fonts.ready.then(()=>resolve(true)))))';
 const domState='JSON.stringify([...document.querySelectorAll("#root, #root *")].map(el=>{const c=getComputedStyle(el),r=el.getBoundingClientRect();return [el.tagName,el.className,el.getAttribute("title"),el.childElementCount?null:el.textContent,[r.x,r.y,r.width,r.height],Array.from(c,p=>[p,c.getPropertyValue(p)])]}))';
 const digest=x=>createHash('sha256').update(x).digest('hex');
 // Decode Chrome PNG outside the browser, avoiding canvas readback and extra page activity.
 function decodePNG(encoded){
  const png=Buffer.from(encoded,'base64');assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  let w,h,bpp;const idat=[];
  for(let p=8;p+12<=png.length;){
   const len=png.readUInt32BE(p),type=png.toString('ascii',p+4,p+8),data=png.subarray(p+8,p+8+len);
   if(type==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);assert.equal(data[8],8);assert.ok([2,6].includes(data[9]));bpp=data[9]===2?3:4;assert.equal(data[12],0);}
   if(type==='IDAT')idat.push(data);if(type==='IEND')break;p+=len+12;
  }
  assert.ok(w&&h&&bpp);const stride=w*bpp,raw=inflateSync(Buffer.concat(idat)),out=Buffer.alloc(stride*h);
  assert.equal(raw.length,(stride+1)*h);
  function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
  for(let y=0;y<h;y++){const filter=raw[y*(stride+1)];assert.ok(filter<=4);for(let x=0;x<stride;x++){
   const j=y*stride+x,a=x>=bpp?out[j-bpp]:0,b=y?out[j-stride]:0,c=y&&x>=bpp?out[j-stride-bpp]:0;
   out[j]=(raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;
  }}
  return {w,h,bpp,out,hash:digest(out)};
 }
 async function pixels(){return decodePNG((await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true})).data);}
 function difference(a,b){
  assert.deepEqual([a.w,a.h,a.bpp],[b.w,b.h,b.bpp]);
  let changed=0,maxDelta=0,minX=a.w,minY=a.h,maxX=-1,maxY=-1;const samples=[];
  for(let p=0;p<a.w*a.h;p++){let delta=0;for(let c=0;c<a.bpp;c++)delta=Math.max(delta,Math.abs(a.out[p*a.bpp+c]-b.out[p*b.bpp+c]));if(!delta)continue;
   const x=p%a.w,y=Math.floor(p/a.w);changed++;maxDelta=Math.max(maxDelta,delta);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
   if(samples.length<8)samples.push({x,y,before:[...a.out.subarray(p*a.bpp,(p+1)*a.bpp)],after:[...b.out.subarray(p*b.bpp,(p+1)*b.bpp)]});
  }
  return {changed,maxDelta,bounds:changed?[minX,minY,maxX,maxY]:null,samples};
 }
 async function stableFrame(){
  await evaluate(settle);await delay(250);
  let last=await pixels(),consecutive=1;
  for(let attempt=0;attempt<8;attempt++){
   await evaluate(settle);await delay(100);
   const next=await pixels();consecutive=next.hash===last.hash?consecutive+1:1;last=next;
   if(consecutive===3)return {pixels:last,dom:digest(await evaluate(domState))};
  }
  throw Error('Unstable browser fixture: three consecutive identical decoded frames required');
 }
 const {mkdirSync,writeFileSync}=await import('node:fs');const out=path.resolve(process.argv[2]);mkdirSync(out,{recursive:true});
 const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
 const state=()=>evaluate(`(()=>{const e=document.querySelector('[data-fixture=stats]').firstElementChild,d=e.firstElementChild,c=getComputedStyle(e),v=getComputedStyle(d),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,text:e.innerText,scrollWidth:document.documentElement.scrollWidth,translate:c.translate,scale:c.scale,decorScale:v.scale,decorOpacity:Number(v.opacity),duration:c.transitionDuration,decorDuration:v.transitionDuration,property:c.transitionProperty,decorProperty:v.transitionProperty,clicks:window.uxClicks};})()`);
 const arm=()=>evaluate(`(()=>{const e=document.querySelector('[data-fixture=stats]').firstElementChild,d=e.firstElementChild;window.uxHoverResult=new Promise(resolve=>{e.addEventListener('pointerenter',()=>{const start=performance.now();let stable=0,last='',first=null;const frames=[];function sample(){const t=performance.now()-start,c=getComputedStyle(e),v=getComputedStyle(d),r=e.getBoundingClientRect();const key=[r.x,r.y,r.width,r.height,v.scale,v.opacity,c.boxShadow].join('|');const running=e.getAnimations({subtree:true}).some(a=>a.playState==='running'||a.pending);if(first===null&&last&&key!==last)first=t;frames.push({ms:Math.round(t),y:r.y,scale:v.scale,opacity:Number(v.opacity),running});stable=key===last&&!running?stable+1:0;last=key;if(stable>=5||t>2000){resolve({firstChangeMs:first===null?null:Math.round(first),settledMs:Math.round(t),stable:stable>=5,frames});return;}requestAnimationFrame(sample);}requestAnimationFrame(sample);},{once:true});});return true;})()`);
 let cases=0;
 for(const width of [320,390,768,1366])for(const mode of ['no-preference','reduce']){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:700,deviceScaleFactor:1,mobile:false});
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:mode},{name:'prefers-color-scheme',value:'light'}]});
  const capability=await evaluate('({hover:matchMedia("(hover:hover)").matches,fine:matchMedia("(pointer:fine)").matches,reduced:matchMedia("(prefers-reduced-motion: reduce)").matches})');assert.deepEqual(capability,{hover:true,fine:true,reduced:mode==="reduce"});console.log('UX04_POINTER_CAPABILITY '+JSON.stringify({width,mode,...capability}));
  const rows={old:[],new:[]};
  for(let trial=0;trial<3;trial++)for(const variant of trial%2?['new','old']:['old','new']){
   await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:690});
   await evaluate('window.harness.mount('+JSON.stringify(variant)+',false)');await evaluate(settle);await delay(800);
   const before=await state();assert.equal(before.scrollWidth,width);
   const expected=variant==='old'?0.5:mode==='reduce'?0:0.22;const decorExpected=variant==='old'?0.7:mode==='reduce'?0:0.24;
   if(variant==='new'&&mode==='reduce'){
     // transition-none sets transition-property, not transition-duration.
     assert.equal(before.property,'none',JSON.stringify(before));assert.equal(before.decorProperty,'none',JSON.stringify(before));
   }else{
     assert.equal(parseFloat(before.duration),expected);assert.equal(parseFloat(before.decorDuration),decorExpected);
     assert.notEqual(before.property,'none');assert.notEqual(before.decorProperty,'none');
   }
   await arm();const x=before.x+before.w/2,y=before.y+before.h/2;
   await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
   const timing=await evaluate('window.uxHoverResult');assert.ok(timing.stable);const hovered=await state();
   const shouldMove=variant==='old'||mode!=='reduce';assert.ok(Math.abs((hovered.y-before.y)-(shouldMove?-4:0))<.2,JSON.stringify({before,hovered}));assert.ok(shouldMove?hovered.decorScale==='1.25':hovered.decorScale==='1'||hovered.decorScale==='none',JSON.stringify(hovered));
   if(variant==='new'&&mode==='reduce'){assert.ok(timing.frames.every(r=>Math.abs(r.y-before.y)<.2&&(r.scale==='none'||r.scale==='1')&&!r.running),JSON.stringify(timing));assert.equal(hovered.property,'none');assert.equal(hovered.decorProperty,'none');assert.ok(timing.settledMs<300);}
   if(trial===0){const png=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});writeFileSync(path.join(out,'merchant-'+width+'-'+mode+'-'+variant+'.png'),Buffer.from(png.data,'base64'));}
   await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await delay(300);const pressed=await state();
   if(variant==='new'&&mode==='reduce'){assert.ok(pressed.scale==='none'||pressed.scale==='1',JSON.stringify(pressed));assert.ok(Math.abs(pressed.y-before.y)<.2);assert.equal(pressed.property,'none');assert.ok(await evaluate('!document.querySelector(\'[data-fixture=stats]\').firstElementChild.getAnimations({subtree:true}).some(a=>a.playState===\'running\'||a.pending)'));}
   await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});assert.equal((await state()).clicks,1);
   rows[variant].push({trial,before,hovered,pressed,timing});
  }
  for(let j=0;j<3;j++){const geometry=x=>({x:x.x,y:x.y,w:x.w,h:x.h,text:x.text});assert.deepEqual(geometry(rows.old[j].before),geometry(rows.new[j].before));}
  const before=median(rows.old.map(x=>x.timing.settledMs)),after=median(rows.new.map(x=>x.timing.settledMs));
  if(mode==='no-preference')assert.ok(after+50<before,JSON.stringify({before,after}));
  const label=width+'-'+mode;writeFileSync(path.join(out,'merchant-'+label+'.json'),JSON.stringify({label,before,after,rows},null,2));console.log('UX04_MERCHANT '+JSON.stringify({label,before,after,trials:3}));cases++;
 }
 console.log('UX04_MERCHANT_PASS '+JSON.stringify({cases,pairedTrials:cases*3,scope:'exact extracted StatCard; mouse hover on viewport emulator, not real touch/whole dashboard'}));
}catch(error){
 console.error('H1D3_BROWSER_FAILURE '+String(error?.stack||error).slice(0,3000));
 if(chromeDiagnostics)console.error('H1D3_CHROME_DIAGNOSTICS '+chromeDiagnostics);
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
