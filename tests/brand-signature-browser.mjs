import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,join,sep} from 'node:path';
const root=process.cwd(), dist=resolve(root,'dist'), artifacts=resolve(root,'brand-acceptance');
await mkdir(artifacts,{recursive:true});
const jsx="import React from 'react';import {createRoot} from 'react-dom/client';import {LocalEatsLogo} from './src/components/LocalEatsLogo';import {createCounterQr,createCounterDesign,counterSignPdf,shopMenuUrl} from './src/components/marketing/counterSign';import jsQR from 'jsqr';async function scan(data){const image=new Image();image.src=data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const c=canvas.getContext('2d');c.drawImage(image,0,0);const rgba=c.getImageData(0,0,canvas.width,canvas.height);return jsQR(rgba.data,rgba.width,rgba.height)?.data||null;}window.brandQr=async()=>{const result=[];for(const id of ['brand-fixture-123','41a03a1c-8d2c-4701-a353-33831d8dbdf4']){const url=shopMenuUrl(id);for(const style of ['classic','dots'])for(const withLogo of [true,false]){const qr=await createCounterQr(url,withLogo,style);result.push({url,style,withLogo,decoded:await scan(qr)});}const design=await createCounterDesign(url,true,'dots');result.push({url,style:'framed',withLogo:true,decoded:await scan(design.artwork)});for(const format of ['a4','a5']){const bytes=counterSignPdf({shopName:'Synthetic brand test',url,qr:design.qr,artwork:design.artwork,headline:'Fixture'},format).output('arraybuffer');result.push({pdf:format,bytes:bytes.byteLength});}}return result;};createRoot(document.getElementById('root')!).render(<><LocalEatsLogo width={240} height={64}/><LocalEatsLogo width={180} height={48}/></>);";
const bundle=(await build({stdin:{contents:jsx,resolveDir:root,loader:'tsx'},bundle:true,platform:'browser',write:false,define:{'process.env.NODE_ENV':'"production"'}})).outputFiles[0].contents;
const css=(await readdir(join(dist,'assets'))).filter(n=>n.endsWith('.css')).map(n=>'<link rel="stylesheet" href="/assets/'+n+'">').join('');
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+css+'<style>html,body{margin:0;min-height:100%;background:white;color:#111827}html.dark,html.dark body{background:#111827;color:white}#root{padding:16px;display:grid;gap:20px;justify-items:start}*{box-sizing:border-box}</style></head><body><main id="root"></main><script src="/__brand-fixture.js"></script></body></html>';
let originOffline=false;
const mime={'.js':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.woff':'font/woff'};
const server=createServer(async(req,res)=>{try{if(originOffline){res.writeHead(503);res.end('fixture offline');return;}const p=new URL(req.url,'http://127.0.0.1').pathname;if(p==='/__brand-fixture'){res.setHeader('Content-Type','text/html');res.end(html);return;}if(p==='/__brand-fixture.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle);return;}if(p==='/api/__brand-test'){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end('{"fixture":true}');return;}const target=resolve(dist,'.'+(p==='/'?'/index.html':p));if(!target.startsWith(dist+sep))throw Error('invalid local path');res.setHeader('Content-Type',mime[extname(target)]??'application/octet-stream');res.end(await readFile(target));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
let browser;const results=[];
try{
browser=await chromium.launch({headless:true});
for(const [width,height] of [[320,640],[390,844],[1440,900]]){
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height},colorScheme:theme,serviceWorkers:'block'});
  await context.route('**/*',r=>r.request().url().startsWith(base+'/')||r.request().url().startsWith('data:')?r.continue():r.abort());
  const page=await context.newPage();await page.goto(base+'/__brand-fixture');
  await page.evaluate(t=>document.documentElement.classList.toggle('dark',t==='dark'),theme);
  await page.getByRole('img',{name:'LocalEats',exact:true}).first().waitFor();
  const report=await page.evaluate(()=>{const logos=[...document.querySelectorAll('svg[role=img][aria-label=LocalEats]')];const ids=[...document.querySelectorAll('svg [id]')].map(n=>n.id);return {count:logos.length,unique:new Set(ids).size===ids.length,overflow:document.documentElement.scrollWidth>innerWidth,boxes:logos.map(s=>{const b=s.getBoundingClientRect(),t=s.querySelector('text'),tb=t?.getBBox();return {left:b.left,right:b.right,width:b.width,height:b.height,textEnd:tb?tb.x+tb.width:0,textFill:t?getComputedStyle(t).fill:null,paths:s.querySelectorAll('g[fill="#C2410C"] path').length};})};});
  assert.equal(report.count,2);assert.ok(report.unique);assert.equal(report.overflow,false);for(const b of report.boxes){assert.ok(b.left>=0&&b.right<=width+1&&b.width>0&&b.height>0);assert.equal(b.paths,5);assert.ok(b.textEnd<=240.5,'wordmark overflows viewBox: '+b.textEnd);if(b.textFill)assert.equal(theme==='dark',b.textFill==='rgb(255, 255, 255)');}
  await page.screenshot({path:join(artifacts,'logo-'+width+'-'+theme+'.png')});results.push({width,theme,logo:'pass',report});
  if(width===390&&theme==='light'){const qr=await page.evaluate(()=>window.brandQr());for(const q of qr){if(q.pdf)assert.ok(q.bytes>1000);else assert.equal(q.decoded,q.url,JSON.stringify(q));}results.push({qr});}
  await context.close();
 }
}
const context=await browser.newContext({serviceWorkers:'allow'});await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());const page=await context.newPage();await page.goto(base+'/__brand-fixture');
await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{},{timeout:30000});
const paths=["/localeats-brand-v1.svg","/logo.png","/pwa-icon-192.png","/pwa-icon-512.png","/apple-touch-icon.png","/icon.svg"];
const warm=await page.evaluate(async urls=>Promise.all(urls.map(async p=>{const r=await fetch(p);return [p,r.status,(await r.arrayBuffer()).byteLength]})),paths);
assert.ok(warm.every(x=>x[1]===200&&x[2]>0),JSON.stringify(warm));
assert.equal(await page.evaluate(async()=> (await fetch('/api/__brand-test')).status),200);
originOffline=true;await context.setOffline(true);
const cold=await page.evaluate(async urls=>Promise.all(urls.map(async p=>{try{const r=await fetch(p);return [p,r.status,(await r.arrayBuffer()).byteLength]}catch{return [p,0,0]}})),paths);
assert.deepEqual(cold,warm,'offline brand assets differ from online bytes');assert.notEqual(await page.evaluate(async()=>{try{return (await fetch('/api/__brand-test')).status}catch{return 0}}),200,'private route must not replay cached success');results.push({offline:'pass',assets:cold});await context.close();
await writeFile(join(artifacts,'results.json'),JSON.stringify({scope:'Isolated built service worker and actual logo components; synthetic QR fixtures only',results},null,2));console.log('BRAND_ACCEPTANCE_PASS',JSON.stringify(results));
}finally{originOffline=false;await browser?.close();await new Promise(r=>server.close(r));}
