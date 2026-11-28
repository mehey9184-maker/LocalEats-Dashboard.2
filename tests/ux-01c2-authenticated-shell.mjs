import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const customer=false;
const root=process.cwd(), out=resolve('ux-authenticated-shell-evidence');
await mkdir(out,{recursive:true});
const origin='http://127.0.0.1:41719';
const uid=customer?'ux-fixture-customer':'ux-fixture-merchant', token='UX-FIXTURE-NOT-A-REAL-TOKEN';
const shopId='6f46296d-4815-43c4-a89d-11b0dcdabec5';
const adapterSource="const uxFixtureAuth=(()=>{if(location.origin!=="+JSON.stringify(origin)+"||!(window as any).__UX_SHELL_IDENTITY)throw Error('Synthetic identity is restricted to the isolated shell test');const user=(window as any).__UX_SHELL_IDENTITY;const currentUser={...user,getIdToken:async()=>"+JSON.stringify(token)+",getIdTokenResult:async()=>({token:"+JSON.stringify(token)+",claims:{}})};return {currentUser,authStateReady:async()=>{},onAuthStateChanged:(next:any)=>{let active=true;queueMicrotask(()=>{if(active){if(typeof next==='function')next(currentUser);else next.next(currentUser);}});return ()=>{active=false;}},onIdTokenChanged:(next:any)=>{let active=true;queueMicrotask(()=>{if(active){if(typeof next==='function')next(currentUser);else next.next(currentUser);}});return ()=>{active=false;}}};})();\n";
let adapted=0;
const plugin={name:'ux-test-only-identity-adapter',enforce:'pre',transform(code,id){
 if(id.split('?')[0]!==resolve(root,'src/lib/firebase.ts'))return null;
 const from=customer?'authInstance = getAuth(app);':'export const auth = getAuth(app);';
 const to=customer?'authInstance = uxFixtureAuth as unknown as Auth;':'export const auth = uxFixtureAuth as unknown as ReturnType<typeof getAuth>;';
 if(!code.includes(from))throw Error('Fixture boundary changed; do not bypass app ownership checks');
 code=code.replace(from,to);
 if(!customer){
  const fromRead='const snap = await getDoc(userDocRef);';
  if(!code.includes(fromRead))throw Error('Fixture profile boundary changed');
  // Keep the real session metadata projection; replace only the profile document read in the dev-server copy.
  code=code.replace(fromRead,"const snap = { exists:()=>true, data:()=>({full_name:'UX Fixture Merchant',phone:''}) };");
 }
 adapted++;
 return {code:adapterSource+code,map:null};
}};
const server=await createServer({root,server:{host:'127.0.0.1',port:41719,strictPort:true,hmr:false},plugins:[plugin],define:{'import.meta.env.VITE_LOCALEATS_API_URL':JSON.stringify(origin),'import.meta.env.VITE_PICKUP_ORDERING_ENABLED':'"false"','import.meta.env.VITE_PROFILE_WRITES_ENABLED':'"false"'}});
let browser;const results=[];
try{
 await server.listen();browser=await chromium.launch({headless:true});
 const sizes=[[320,568],[390,844],[768,1024],[1440,900]];
 for(const [width,height] of sizes)for(const theme of ['light','dark'])for(const variant of customer?['signed-in']:['open','closed',...(width===320&&theme==='light'?['wrong-owner','kitchen']:[])]){
  const c=await browser.newContext({viewport:{width,height},colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block',permissions:[],timezoneId:'Africa/Johannesburg'});
  const reads=[],blocked=[],blockedReadTransports=[],mutations=[],errors=[];
  await c.routeWebSocket('**/*',ws=>ws.close());
  await c.addInitScript(({uid,theme,variant,customer,shopId})=>{
   window.__UX_SHELL_IDENTITY={uid,email:'ux-fixture@example.invalid',displayName:customer?'UX Fixture Customer':'UX Fixture Merchant',emailVerified:true,isAnonymous:false,phoneNumber:null,metadata:{creationTime:'2026-01-01T00:00:00.000Z'}};
   localStorage.setItem('darkMode',String(theme==='dark'));
   if(variant==='kitchen')localStorage.setItem('localeats_kitchen_mode','true');
   if(customer)localStorage.setItem('cart',JSON.stringify([{id:'ux-fixture-menu',shopId,name:'Fixture Kota',quantity:1,price:25,selectedCustomizations:[]}]));
   Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(_ok,fail)=>fail?.({code:1,message:'Fixture denied'}),watchPosition:(_ok,fail)=>{fail?.({code:1,message:'Fixture denied'});return 1;},clearWatch:()=>{}}});
  },{uid,theme,variant,customer,shopId});
  const shop={id:shopId,owner_id:variant==='wrong-owner'?'ux-foreign-owner':'ux-fixture-merchant',name:'UX Fixture Kitchen',approval_status:'approved',is_active:variant!=='closed',availability_revision:1,category:'Kota',description:'Synthetic fixture only',location:'Fixture area',opening_time:'08:00',closing_time:'22:00',lat:-26,lng:28,latitude:-26,longitude:28};
  const menu={id:'ux-fixture-menu',shop_id:shopId,name:'Fixture Kota',price:25,is_available:true,image_url:''};
  await c.route('**/*',async r=>{
    const req=r.request(),u=new URL(req.url()),method=req.method(),p=u.pathname;
    if(method==='POST'&&u.origin==='https://firestore.googleapis.com'&&p==='/google.firestore.v1.Firestore/Listen/channel'){blockedReadTransports.push(p);return r.abort();}
    if(!['GET','HEAD'].includes(method)){mutations.push(method+' '+u.origin+p);return r.abort();}
    if(u.origin===origin&&p.startsWith('/api/')){
      const pub=p==='/api/v1/catalog/shops'||p==='/api/v1/catalog/pickup-shops'||p==='/api/v1/catalog/shops/'+shopId+'/menu';
      const allowed=pub|| (customer?['/api/v1/profiles/me','/api/v1/orders','/api/v1/orders/history','/api/v1/notifications']:['/api/v1/merchant/shop','/api/v1/merchant/orders']).includes(p);
      if(!allowed){blocked.push(method+' '+p);return r.abort();}
      if(!pub&&req.headers().authorization!=='Bearer fb-'+token)return r.fulfill({status:401,json:{success:false,code:'UNAUTHORIZED'}});
      reads.push({path:p,authorized:req.headers().authorization==='Bearer fb-'+token});
      let payload={success:true};
      if(p.endsWith('/merchant/shop'))payload.shop=shop;
      else if(p.endsWith('/profiles/me'))payload.profile={user_id:uid,fullName:'UX Fixture Customer',email:'ux-fixture@example.invalid',phone:'',city:'Johannesburg',country:'South Africa',role:'customer',favorites:[]};
      else if(p.endsWith('/menu'))payload.menu_items=[menu];
      else if(p.endsWith('/shops')||p.endsWith('/pickup-shops'))payload.shops=[shop];
      else if(p.endsWith('/notifications'))payload.notifications=[];
      else {payload.orders=[];payload.has_more=false;}
      return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
    }
    if(u.origin===origin&&!/^\/(?:auth|rest|functions|rpc)(?:\/|$)/.test(p))return r.continue();
    if(u.protocol==='data:'||u.protocol==='blob:')return r.continue();
    blocked.push(method+' '+u.origin+p);return r.abort();
  });
  const page=await c.newPage();page.on('pageerror',e=>errors.push(String(e)));
  const capture=async state=>{
    await page.evaluate(async()=>{await document.fonts.ready;await new Promise(requestAnimationFrame);});
    const metrics=await page.evaluate(()=>{
      const box=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom}};
      const visible=e=>{const b=box(e),s=getComputedStyle(e);return b.w>0&&b.h>0&&s.visibility!=='hidden'&&s.display!=='none'};
      const label=e=>(e.getAttribute('aria-label')||e.innerText||e.id||e.tagName).trim().slice(0,120);
      const fixed=[...document.querySelectorAll('body *')].filter(e=>visible(e)&&['fixed','sticky'].includes(getComputedStyle(e).position)).map(e=>({label:label(e),...box(e)}));
      const controls=[...document.querySelectorAll('button:not([disabled]),a[href],input:not([type=hidden]),[role=button]')].filter(visible).map(e=>{const b=box(e),x=b.x+b.w/2,y=b.y+b.h/2,hit=x>=0&&x<innerWidth&&y>=0&&y<innerHeight?document.elementFromPoint(x,y):null;return {label:label(e),...b,covered:!!hit&&hit!==e&&!e.contains(hit),cover:hit?label(hit):null}});
      const main=document.querySelector('main'), first=main?.firstElementChild;
      const banner=fixed.find(b=>b.label.includes('Store Offline - Not Receiving Orders'));
      return {viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,theme:document.documentElement.classList.contains('dark'),fixed,controls,main:main?box(main):null,mainFirst:first?box(first):null,offlineBanner:banner||null,offlineBannerOverlap:banner&&first?Math.max(0,banner.bottom-box(first).y):null,bodyText:document.body.innerText.slice(0,1500)};
    });
    const file=variant+'-'+state+'-'+width+'-'+theme+'.png';
    await page.screenshot({path:join(out,file),fullPage:true,animations:'disabled'});
    results.push({width,height,theme,variant,state,file,metrics,reads:[...reads],blocked:[...new Set(blocked)],blockedReadTransports:[...blockedReadTransports],mutations:[...mutations],errors:[...errors]});
    await writeFile(join(out,'results.json'),JSON.stringify(results,null,2));
  };
  try{
    await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
    if(customer){
      const privacy=page.locator('#popia-legal-bar');
      await privacy.waitFor({timeout:25000});await page.getByRole('button',{name:'Accept',exact:true}).click();
      await page.getByRole('button',{name:'Essential Only',exact:true}).click();
      await page.getByRole('button',{name:'Home',exact:true}).waitFor({timeout:25000});
      await capture('home');
      const guide=page.getByRole('dialog',{name:'Pickup app guide'});if(await guide.isVisible())await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'Profile',exact:true}).click();
      await page.waitForTimeout(500);await capture('profile');
      assert.ok(reads.some(r=>r.path==='/api/v1/profiles/me'&&r.authorized),'Real profile read did not reach synthetic fixture');
      assert.ok(await page.getByRole('button',{name:'Home',exact:true}).count()>0,'Profile was not in actual authenticated shell');
    }else if(variant==='wrong-owner'){
      await page.getByText("We couldn't verify your merchant shop.",{exact:true}).waitFor({timeout:25000});await capture('ownership-denied');
      assert.equal(await page.getByText('Sync & Verify Store Ownership',{exact:true}).count(),0);
    }else{
      if(variant==='kitchen'){await page.locator('main').waitFor({timeout:25000});await capture('kitchen');}
      else{
        await page.getByText('Sync & Verify Store Ownership',{exact:true}).waitFor({timeout:25000});
        await capture('home');
        if(width<768){const more=page.getByRole('button',{name:'More',exact:true});await more.scrollIntoViewIfNeeded();await more.click();await page.getByText('More Features',{exact:true}).waitFor();await capture('more');await page.getByRole('button',{name:/Settings Configure/i}).click();}
        else await page.getByRole('button',{name:'Settings',exact:true}).first().click();
        await page.getByRole('navigation',{name:'Merchant settings sections'}).waitFor({timeout:10000});await capture('settings');
      }
      assert.ok(reads.some(r=>r.path==='/api/v1/merchant/shop'&&r.authorized),'Real merchant ownership read not reached');
    }
    assert.deepEqual(mutations,[],'Unexpected blocked mutation attempt');assert.deepEqual(errors,[],'Unexpected runtime exception');
  }catch(e){await capture('blocked');throw e;}finally{await c.close();}
 }
 assert.ok(adapted>0,'Fixture auth boundary not loaded');console.log('UX_AUTHENTICATED_SHELL_CAPTURED',results.length);
}finally{await browser?.close();await server.close();}
