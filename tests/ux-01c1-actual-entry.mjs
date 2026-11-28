import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const customer=false;
const out=resolve('ux-full-shell-evidence');await mkdir(out,{recursive:true});
const server=await createServer({root:process.cwd(),server:{host:'127.0.0.1',port:0,hmr:false}});
let browser;const results=[];
try{
 await server.listen();const base='http://127.0.0.1:'+server.httpServer.address().port;
 browser=await chromium.launch({headless:true});
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,900]])for(const theme of ['light','dark']){
  const c=await browser.newContext({viewport:{width,height},colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block',permissions:[],timezoneId:'Africa/Johannesburg'});
  const blocked=[],mutations=[],errors=[];
  await c.routeWebSocket('**/*',ws=>ws.close());
  await c.route('**/*',async r=>{const req=r.request(),u=new URL(req.url());if(!['GET','HEAD'].includes(req.method())){mutations.push(req.method()+' '+u.origin+u.pathname);return r.abort();}if(u.origin===base&&!/^\/(?:api|auth|rest|functions|rpc)(?:\/|$)/.test(u.pathname))return r.continue();if(u.protocol==='data:'||u.protocol==='blob:')return r.continue();blocked.push(u.origin+u.pathname);return r.abort();});
  await c.addInitScript(({theme,customer})=>{localStorage.setItem('darkMode',String(theme==='dark'));if(customer)localStorage.setItem('cart',JSON.stringify([{id:'synthetic-item',shopId:'synthetic-shop',name:'Fixture Kota',quantity:1,price:25,selectedCustomizations:[]}]));const geo={getCurrentPosition:(_ok,fail)=>fail?.({code:1,message:'Fixture location denied'}),watchPosition:(_ok,fail)=>{fail?.({code:1,message:'Fixture location denied'});return 1;},clearWatch:()=>{}};Object.defineProperty(navigator,'geolocation',{value:geo});},{theme,customer});
  const page=await c.newPage();page.on('pageerror',e=>errors.push(String(e)));
  const capture=async state=>{await page.evaluate(async()=>{await document.fonts.ready;await new Promise(requestAnimationFrame);});const report=await page.evaluate(()=>{const box=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}};const visible=e=>{const b=box(e),s=getComputedStyle(e);return b.w>0&&b.h>0&&s.visibility!=='hidden'&&s.display!=='none'};const label=e=>(e.getAttribute('aria-label')||e.innerText||e.id||e.tagName).trim().slice(0,90);return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyText:document.body.innerText.slice(0,1200),fixed:[...document.querySelectorAll('body *')].filter(e=>visible(e)&&['fixed','sticky'].includes(getComputedStyle(e).position)).map(e=>({label:label(e),...box(e)})),controls:[...document.querySelectorAll('button:not([disabled]),a[href],input:not([type=hidden]),[role=button]')].filter(visible).map(e=>{const b=box(e),x=b.x+b.w/2,y=b.y+b.h/2,hit=x>=0&&x<innerWidth&&y>=0&&y<innerHeight?document.elementFromPoint(x,y):null;return {label:label(e),...b,covered:!!hit&&hit!==e&&!e.contains(hit),cover:hit?label(hit):null}})}});await page.screenshot({path:join(out,state+'-'+width+'-'+theme+'.png'),fullPage:true,animations:'disabled'});results.push({width,height,theme,state,report,blocked:[...new Set(blocked)],mutations:[...mutations],errors:[...errors]});await writeFile(join(out,'results.json'),JSON.stringify(results,null,2));};
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  if(customer){
    const explore=page.getByRole('button',{name:'Explore local food',exact:true});
    try{await explore.waitFor({timeout:25000});}catch(e){await capture('blocked-startup');throw e;}
    await capture('actual-welcome');await explore.click();await page.getByRole('button',{name:'Home',exact:true}).waitFor({timeout:25000});
    // Observe actual guest shell; startup consent/guide overlays are recorded, not bypassed.
    await capture('actual-guest-home');
  }else{
    const signin=page.getByRole('button',{name:'Sign In',exact:true});
    try{await signin.waitFor({timeout:25000});}catch(e){await capture('blocked-startup');throw e;}
    await capture('actual-signed-out');
    assert.equal(await page.locator('main').getByText('Sync & Verify Store Ownership',{exact:true}).count(),0,'Unauthenticated dashboard must not appear');
  }
  assert.deepEqual(errors,[],'Unexpected browser exception');
  assert.deepEqual(mutations,[],'Unexpected attempted mutation, blocked by harness');
  await c.close();
 }
 console.log('ACTUAL_ENTRY_CAPTURED',results.length,'captures; authenticated Merchant shell NOT covered');
}finally{await browser?.close();await server.close();}
