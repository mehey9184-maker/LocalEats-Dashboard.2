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
const old=execFileSync('git',['show','6d25d111f7faa7794013b6979a3cc4126b6a530a:src/components/OrdersManagement.tsx'],{encoding:'utf8',maxBuffer:2*1024*1024});
const badge=/^([ \t]*)<div className="flex flex-wrap gap-1 mt-1">\n\1  \{getOrderTags\(order\)\.map\(\(tag\) => \{[\s\S]*?^\1<\/div>$/gm;
const quick=/^([ \t]*)<div className="mt-2\.5 flex items-center justify-between gap-1\.5 border-t border-dashed border-outline-variant\/10 pt-2 text-\[9px\]">\n[\s\S]*?^\1<\/div>$/gm;
const originalBadges=[...old.matchAll(badge)],originalQuick=[...old.matchAll(quick)];
assert.equal(originalBadges.length,4);assert.equal(originalQuick.length,4);
const entry='import React,{useState} from "react"; import {createRoot} from "react-dom/client"; import {flushSync} from "react-dom"; import {clsx} from "clsx"; import {twMerge} from "tailwind-merge"; import {OrderTagBadges,QuickOrderTags} from "./src/components/OrderTags"; const cn=(...x)=>twMerge(clsx(x));\n'
+'function OldBadges({tags}){const order={id:"fixture"};const getOrderTags=()=>tags;return ('+originalBadges[0][0]+');}\n'
+'function OldQuick({orderId,manualTags,onToggle}){const order={id:orderId};const orderTags={[orderId]:manualTags};const toggleOrderTag=onToggle;return ('+originalQuick[0][0]+');}\n'
+'const root=createRoot(document.getElementById("root"));let serial=0;const events=[];function Fixture({mode,initial}){const [manualTags,setTags]=useState(initial);const tags=Array.from(new Set([...manualTags,"Large Order","Other"]));const Badges=mode==="old"?OldBadges:OrderTagBadges;const Quick=mode==="old"?OldQuick:QuickOrderTags;return <div className="p-4" onClick={()=>events.push(["parent"])}><Badges tags={tags}/><Quick orderId="fixture" manualTags={manualTags} onToggle={(id,tag)=>{events.push(["toggle",id,tag]);setTags(prev=>prev.includes(tag)?prev.filter(t=>t!==tag):[...prev,tag]);}}/></div>;}window.harness={mount:(mode,initial,dark)=>{events.length=0;document.documentElement.classList.toggle("dark",dark);flushSync(()=>root.render(<Fixture key={++serial} mode={mode} initial={initial}/>));document.body.focus();},events:()=>events,focus:()=>document.activeElement?.title||"",ready:()=>true};';
const compiled=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
const js=compiled.outputFiles[0].text;
const css=readdirSync('dist/assets').filter(f=>f.endsWith('.css')).map(f=>readFileSync(path.join('dist/assets',f),'utf8')).join('\n');
assert.ok(css.length>0);
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{margin:0}*{animation:none!important;transition:none!important;caret-color:transparent!important}</style></head><body tabindex="-1"><div id="root"></div><script src="/fixture.js"></script></body></html>';
const server=createServer((req,res)=>{
 const p=req.url;
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
 const key=async(k,code,vk)=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});};
 for(const mode of ['old','new']){
  await evaluate('window.harness.mount('+JSON.stringify(mode)+',[],false)');
  await key('Tab','Tab',9);assert.equal(await evaluate('window.harness.focus()'),'Toggle Rush');
  await key('Enter','Enter',13);
  await key('Tab','Tab',9);assert.equal(await evaluate('window.harness.focus()'),'Toggle VIP');
  await key(' ','Space',32);
  await key('Tab','Tab',9);assert.equal(await evaluate('window.harness.focus()'),'Toggle Special');
  await key('Enter','Enter',13);
  assert.deepEqual(await evaluate('window.harness.events()'),[['toggle','fixture','Rush'],['toggle','fixture','VIP'],['toggle','fixture','Special']]);
 }
 console.log('H1D3_KEYBOARD_PASS sequences=2');
 let images=0,captureSerial=0;
 for(const width of [320,390,1280])for(const dark of [false,true])for(const tags of [[],['Rush','VIP','Special']]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:240,deviceScaleFactor:1,mobile:false});
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:dark?'dark':'light'}]});
  const label='width='+width+' dark='+dark+' manual='+tags.length;
  const mount=async mode=>{
   // Fresh navigation for every sample; no prior React remount or compositor history.
   await cdp('Page.navigate',{url:origin+'/?fixture='+String(++captureSerial)});
   let mounted=false;
   for(let n=0;n<100;n++){try{mounted=await evaluate('location.search==="?fixture='+captureSerial+'" && !!window.harness?.ready()');}catch{}if(mounted)break;await delay(100);}
   assert.ok(mounted,'Fresh synthetic fixture not ready');
   await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:width-1,y:239});
   await evaluate('window.harness.mount('+JSON.stringify(mode)+','+JSON.stringify(tags)+','+dark+')');
   assert.equal(await evaluate('matchMedia("(prefers-color-scheme: dark)").matches'),dark);
   assert.equal(await evaluate('document.documentElement.classList.contains("dark")'),dark);
   assert.equal(await evaluate('innerWidth'),width);
   return stableFrame();
  };
  // Require identical controls, then exact equality. No tolerance or selecting matching retries.
  const before=await mount('old'),control=await mount('old'),after=await mount('new'),recheck=await mount('old');
  const pairs=[['old-control',before,control],['old-post',before,recheck],['old-new',before,after]];
  for(const [name,x,y] of pairs)console.log('H1D3_PIXEL_DIFF '+label+' '+name+' '+JSON.stringify({stylesEqual:x.dom===y.dom,...difference(x.pixels,y.pixels)}));
  for(const [name,x,y] of pairs){assert.equal(y.dom,x.dom,'Computed style/layout mismatch '+name+' '+label);assert.equal(y.pixels.hash,x.pixels.hash,'Exact pixel mismatch '+name+' '+label);}
  console.log('H1D3_PIXEL_PASS '+label+' old_controls=2 computed_styles=match');
  images++;
 }
 console.log('H1D3_BROWSER_PARITY_PASS screenshots='+images+' keyboard_sequences=2');
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
