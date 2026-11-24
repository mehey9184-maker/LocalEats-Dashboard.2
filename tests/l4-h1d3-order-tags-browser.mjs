// Synthetic browser fixture only. No application entrypoint or service credentials.
import {readFileSync,readdirSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
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
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{margin:0}*{animation:none!important;transition:none!important}</style></head><body tabindex="-1"><div id="root"></div><script src="/fixture.js"></script></body></html>';
const server=createServer((req,res)=>{
 const p=req.url;
 if(p==='/fixture.js'){res.setHeader('Content-Type','application/javascript');res.end(js);}
 else if(p==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}
 else if(p==='/'){res.setHeader('Content-Type','text/html');res.end(html);}
 else{res.statusCode=404;res.end();}
});
const profile=mkdtempSync(path.join(tmpdir(),'h1d3-browser-'));
let chrome,ws;
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const origin='http://127.0.0.1:'+server.address().port;
 const binary=['google-chrome','google-chrome-stable','chromium','chromium-browser'].map(name=>{try{return execFileSync('which',[name],{encoding:'utf8'}).trim();}catch{return '';}}).find(Boolean);
 assert.ok(binary,'A preinstalled Chrome/Chromium executable is required; do not skip browser gate');
 console.log('H1D3_BROWSER_VERSION '+execFileSync(binary,['--version'],{encoding:'utf8'}).trim());
 chrome=spawn(binary,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let port;
 for(let n=0;n<100;n++){const file=path.join(profile,'DevToolsActivePort');if(existsSync(file)){port=Number(readFileSync(file,'utf8').split('\n')[0]);if(port)break;}if(chrome.exitCode!==null)throw Error('Chrome exited');await delay(100);}
 assert.ok(port,'Chrome debug port unavailable');
 const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 const target=targets.find(t=>t.type==='page');assert.ok(target);
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let next=0;const pending=new Map();
 ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);const waiter=pending.get(msg.id);if(waiter){pending.delete(msg.id);clearTimeout(waiter.timer);msg.error?waiter.reject(Error(JSON.stringify(msg.error))):waiter.resolve(msg.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},10000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Page.navigate',{url:origin});
 let ready=false;for(let n=0;n<100;n++){try{ready=await evaluate('!!window.harness?.ready()');}catch{}if(ready)break;await delay(100);}assert.ok(ready,'Synthetic fixture did not mount');
 const settle='new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>document.fonts.ready.then(()=>resolve(true)))))';
 let images=0;
 for(const width of [320,390,1280])for(const dark of [false,true])for(const tags of [[],['Rush','VIP','Special']]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:240,deviceScaleFactor:1,mobile:false});
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:dark?'dark':'light'}]});
  const shot=async mode=>{await evaluate('window.harness.mount('+JSON.stringify(mode)+','+JSON.stringify(tags)+','+dark+')');await evaluate(settle);return (await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data;};
  const before=await shot('old'),after=await shot('new');
  assert.equal(after,before,'Pixel snapshot mismatch '+width+' dark='+dark+' tags='+tags.join(','));
  images++;
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
 console.log('H1D3_BROWSER_PARITY_PASS screenshots='+images+' keyboard_sequences=2');
}finally{
 if(ws)ws.close();
 if(chrome){chrome.kill('SIGTERM');await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGKILL');}
 server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(profile,{recursive:true,force:true,maxRetries:3});
}
