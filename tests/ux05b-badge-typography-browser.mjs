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
const tagSource=readFileSync('src/components/OrderTags.tsx','utf8');const tagBaseline=execFileSync('git',['show','7b75dbab809c65cfc40ee5c8b63aa84b2cf3f1d8:src/components/OrderTags.tsx'],{encoding:'utf8'});assert.equal(tagSource.replace('text-[10px] font-black uppercase tracking-wider rounded-md border whitespace-nowrap','text-[8px] font-black uppercase tracking-wider rounded-md border whitespace-nowrap').replace('text-rose-700 dark:text-rose-400','text-rose-600 dark:text-rose-400').replace('text-amber-800 dark:text-amber-400','text-amber-600 dark:text-amber-400').replace('text-teal-700 dark:text-teal-400','text-teal-600 dark:text-teal-400'),tagBaseline);
const old=execFileSync('git',['show','6d25d111f7faa7794013b6979a3cc4126b6a530a:src/components/OrdersManagement.tsx'],{encoding:'utf8',maxBuffer:2*1024*1024});
const badge=/^([ \t]*)<div className="flex flex-wrap gap-1 mt-1">\n\1  \{getOrderTags\(order\)\.map\(\(tag\) => \{[\s\S]*?^\1<\/div>$/gm;
const quick=/^([ \t]*)<div className="mt-2\.5 flex items-center justify-between gap-1\.5 border-t border-dashed border-outline-variant\/10 pt-2 text-\[9px\]">\n[\s\S]*?^\1<\/div>$/gm;
const originalBadges=[...old.matchAll(badge)],originalQuick=[...old.matchAll(quick)];
assert.equal(originalBadges.length,4);assert.equal(originalQuick.length,4);
const orderSource=readFileSync("src/components/OrdersManagement.tsx","utf8");assert.ok(orderSource.includes("order-card bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-xs relative overflow-hidden group transition-all duration-300 space-y-2"));assert.ok(orderSource.includes("bg-surface-container-low/60 rounded-[2.5rem] p-5 border border-outline-variant/10 flex flex-col gap-4 min-h-[500px] w-[85vw] md:w-[360px] xl:w-[400px] shrink-0 snap-center"));
const entry="import React,{useState} from \"react\";import {createRoot} from \"react-dom/client\";import {flushSync} from \"react-dom\";import {clsx} from \"clsx\";import {twMerge} from \"tailwind-merge\";import {OrderTagBadges,QuickOrderTags} from \"./src/components/OrderTags\";import {PickupOrderActions} from \"./src/components/PickupOrderActions\";const cn=(...x)=>twMerge(clsx(x));\n"
+'function OldBadges({tags}){const order={id:"fixture"};const getOrderTags=()=>tags;return ('+originalBadges[0][0]+');}\n'
+'function OldQuick({orderId,manualTags,onToggle}){const order={id:orderId};const orderTags={[orderId]:manualTags};const toggleOrderTag=onToggle;return ('+originalQuick[0][0]+');}\n'
+"const root=createRoot(document.getElementById(\"root\"));let serial=0;const events=[];\nfunction Fixture({mode,initial,stage}){const [manualTags,setTags]=useState(initial);const tags=Array.from(new Set([...manualTags,\"Large Order\",\"Other\"]));const Badges=mode===\"old\"?OldBadges:OrderTagBadges;const Quick=mode===\"old\"?OldQuick:QuickOrderTags;const order={id:\"fixture-order\",shop_id:\"fixture-shop\",delivery_type:\"collection\",pickup_status:stage===\"paid\"?\"ready_for_pickup\":stage,payment_status:stage===\"paid\"||stage===\"collected\"?\"paid\":\"unpaid\",revision:1,total_price:25,service_fee:0};return <div className=\"bg-surface-container-low/60 rounded-[2.5rem] p-5 border border-outline-variant/10 flex flex-col gap-4 min-h-[500px] w-[85vw] md:w-[360px] xl:w-[400px] shrink-0 snap-center\" data-fixture=\"lane\"><article className=\"order-card bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-xs relative overflow-hidden group transition-all duration-300 space-y-2 border-outline-variant/10\" data-fixture=\"card\" onClick={()=>events.push([\"parent\"])}><div className=\"flex justify-between items-start gap-2\"><div><span className=\"text-[10px] font-mono font-black text-primary uppercase\">#DEMO</span><h4 className=\"font-bold text-sm text-on-surface mt-0.5\">Fictional customer</h4><Badges tags={tags}/></div></div><div className=\"mt-4 text-base text-on-surface space-y-3 font-bold bg-surface-container-lowest p-4 rounded-xl border-2 border-outline-variant/10 shadow-inner\"><span>1x Classic Kota</span></div><div data-fixture=\"actions\" className=\"mt-4 pt-4 border-t-2 border-dashed border-outline-variant/20 flex flex-col items-stretch gap-4\"><div className=\"text-center font-mono font-black text-2xl text-on-surface bg-surface-container-high py-2 rounded-xl\">TOTAL: R 25.00</div><PickupOrderActions order={order} compact={stage===\"collected\"} recoveryOnly={stage===\"collected\"}/></div><Quick orderId={order.id} manualTags={manualTags} onToggle={(id,tag)=>{events.push([\"toggle\",id,tag]);setTags(prev=>prev.includes(tag)?prev.filter(t=>t!==tag):[...prev,tag]);}}/></article></div>;}\nwindow.harness={mount:(mode,initial,dark,stage)=>{events.length=0;document.documentElement.classList.toggle(\"dark\",dark);flushSync(()=>root.render(<Fixture key={++serial} mode={mode} initial={initial} stage={stage}/>));document.body.focus();},events:()=>events,focus:()=>document.activeElement?.title||\"\",ready:()=>true};";
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
 const measure=()=>evaluate(`(()=>{const card=document.querySelector('[data-fixture=card]'),actions=card.querySelector('[data-fixture=actions]');const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true});const rgba=v=>{ctx.clearRect(0,0,1,1);ctx.fillStyle='#000';ctx.fillStyle=v;ctx.fillRect(0,0,1,1);const a=[...ctx.getImageData(0,0,1,1).data];return [a[0],a[1],a[2],a[3]/255];};const over=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat(1);const lum=a=>a.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};const bounds=rect(card);const badges=[...card.querySelectorAll('span.whitespace-nowrap.rounded-md')].map(el=>{const chain=[];for(let n=el;n;n=n.parentElement){const c=getComputedStyle(n);if(c.backgroundImage!=='none'||Number(c.opacity)!==1||c.filter!=='none')throw Error('Contrast requires flat unfiltered background');const v=rgba(c.backgroundColor);chain.push(v);if(v[3]===1)break;}let bg=[255,255,255,1];for(const v of chain.reverse())bg=over(v,bg);const c=getComputedStyle(el),fg=over(rgba(c.color),bg),l=lum(bg),k=lum(fg),r=rect(el);return {text:el.innerText,font:c.fontSize,fg,bg,ratio:(Math.max(l,k)+.05)/(Math.min(l,k)+.05),rect:r,contained:r.x>=bounds.x&&r.right<=bounds.right+.5,overflow:el.scrollWidth>el.clientWidth+1};});return {badges,card:bounds,text:card.innerText,actions:[...actions.querySelectorAll('button')].map(e=>({text:e.innerText,disabled:e.disabled,w:rect(e).w,h:rect(e).h})),tags:[...card.querySelectorAll('button[title^="Toggle "]')].map(e=>({text:e.title,pressed:e.getAttribute('aria-pressed'),w:rect(e).w,h:rect(e).h})),events:window.harness.events(),scrollWidth:document.documentElement.scrollWidth};})()`);
 let cases=0;
 for(const width of [320,390,768,1366])for(const dark of [false,true])for(const stage of ['pending','paid']){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:dark?'dark':'light'},{name:'prefers-reduced-motion',value:'reduce'}]});
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:990});await evaluate('window.harness.mount("new",["Rush","VIP","Special"],'+dark+','+JSON.stringify(stage)+')');await evaluate(settle);await delay(250);
  const label=width+'-'+(dark?'dark':'light')+'-'+stage;
  const capture=async mode=>{const v=await measure();const png=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});writeFileSync(path.join(out,'merchant-'+label+'-'+mode+'.png'),Buffer.from(png.data,'base64'));return v;};
  const after=await capture('new');
  await evaluate(`(()=>{for(const el of document.querySelectorAll('[data-fixture=card] span.whitespace-nowrap.rounded-md')){el.classList.remove('text-[10px]');el.classList.add('text-[8px]');for(const [a,b] of [['text-rose-700','text-rose-600'],['text-amber-800','text-amber-600'],['text-teal-700','text-teal-600']])if(el.classList.contains(a)){el.classList.remove(a);el.classList.add(b);}}})()`);await evaluate(settle);const before=await capture('old');
  assert.equal(after.badges.length,5);assert.equal(before.badges.length,5);assert.equal(after.scrollWidth,width);assert.equal(before.scrollWidth,width);assert.equal(after.text,before.text);assert.equal(after.card.w,before.card.w);assert.ok(after.card.h<=before.card.h+40,JSON.stringify({after,before}));assert.deepEqual(after.actions,before.actions);assert.ok(after.actions.every(x=>x.disabled));assert.deepEqual(after.tags,before.tags);assert.ok(after.tags.every(x=>x.w>=44&&x.h>=44));assert.deepEqual(after.events,[]);
  for(let i=0;i<5;i++){const n=after.badges[i],o=before.badges[i];assert.equal(n.text,o.text);assert.equal(n.font,'10px');assert.equal(o.font,'8px');assert.ok(n.contained&&!n.overflow&&n.ratio>=4.5,JSON.stringify(n));if(!dark&&/RUSH|VIP|SPECIAL/i.test(n.text))assert.ok(n.ratio>o.ratio);}
  writeFileSync(path.join(out,'merchant-'+label+'.json'),JSON.stringify({label,before,after},null,2));console.log('UX05B_MERCHANT '+JSON.stringify({label,before:before.badges.map(x=>({text:x.text,font:x.font,ratio:x.ratio})),after:after.badges.map(x=>({text:x.text,font:x.font,ratio:x.ratio})),extraHeight:after.card.h-before.card.h}));cases++;
 }
 console.log('UX05B_MERCHANT_PASS '+JSON.stringify({cases,scope:'actual static badge typography and contrast in constrained order card; unchanged quick tags and disabled pickup actions'}));
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
