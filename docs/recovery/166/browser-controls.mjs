import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {join,resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const work=resolve(import.meta.dirname);
const customer=join(work,'LocalEats-Customer-Audit'), merchant=join(work,'LocalEats');
const out=join(work,'recovery-166-screens');
await mkdir(out,{recursive:true});
const browserLib=createRequire(join(customer,'package.json'))('playwright');
Object.assign(process.env,{
  VITE_LOCALEATS_API_URL:'http://127.0.0.1:4000',
  VITE_PICKUP_ORDERING_ENABLED:'false',
  VITE_FIREBASE_CONFIG_SOURCE:'environment',
  VITE_FIREBASE_API_KEY:'local-test-only',
  VITE_FIREBASE_AUTH_DOMAIN:'localhost',
  VITE_FIREBASE_PROJECT_ID:'local-pickup-fixture',
  VITE_FIREBASE_STORAGE_BUCKET:'local-pickup-fixture.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID:'9999999',
  VITE_FIREBASE_APP_ID:'1:9999999:web:fixture',
});
delete process.env.VITE_FIREBASE_VAPID_KEY;
const servers=[];
const measurements=[];
function testAuth(root) {
  return {
    name:'isolated-audit-auth',
    enforce:'pre',
    transform(source,id) {
      if(!/[/\\]src[/\\]lib[/\\]firebase\.ts$/.test(id))return;
      const needle=root===customer?'authInstance = getAuth(app);':'export const auth = getAuth(app);';
      const instance=root===customer?'authInstance':'auth';
      assert.ok(source.includes(needle));
      return 'import {connectAuthEmulator} from "firebase/auth";\n'+source.replace(needle,
        needle+'\nconnectAuthEmulator('+instance+', "http://127.0.0.1:9099", {disableWarnings:true});');
    },
  };
}
async function vite(root,port) {
  const require=createRequire(join(root,'package.json'));
  const path=join(root,'node_modules','vite','dist','node','index.js');
  const {createServer}=await import(pathToFileURL(path));
  const s=await createServer({root,configFile:join(root,'vite.config.ts'),plugins:[testAuth(root)],server:{host:'127.0.0.1',port,strictPort:true,hmr:false}});
  servers.push(s);
  await s.listen();
  return 'http://127.0.0.1:'+port;
}
const response=await fetch('http://127.0.0.1:4000/__pickup_fixture/location');
assert.deepEqual(await response.json(),{lat:-26,lng:28});
let browser;
async function take(page,name) {
  await page.screenshot({path:join(out,name+'.png')});
  const evidence=await page.evaluate(()=>({
    width:innerWidth,scroll:document.documentElement.scrollWidth,
    heading:[...document.querySelectorAll('h1,h2')].find(e=>e.getBoundingClientRect().height)?.textContent?.trim(),
    font:getComputedStyle(document.body).fontFamily,
    headingFont:document.querySelector('h1')?getComputedStyle(document.querySelector('h1')).fontFamily:null,
  }));
  measurements.push({name,...evidence});
  console.log('SCREEN',name,JSON.stringify(evidence));
}
function role(page,name){ return page.getByRole('button',{name,exact:true}); }
async function show(page,name) {
  console.log(name,(await page.locator('body').innerText()).replace(/\n+/g,' | ').slice(0,1500));
}
try {
  const [customerUrl,merchantUrl]=await Promise.all([vite(customer,4181),vite(merchant,4182)]);
  browser=await browserLib.chromium.launch({channel:'chrome',headless:true});
  const make=async (width,height)=>{
    const context=await browser.newContext({viewport:{width,height},geolocation:{latitude:-26,longitude:28},
      permissions:['geolocation'],reducedMotion:'reduce',serviceWorkers:'block'});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      return url.hostname==='127.0.0.1' && ['4181','4182','4000','9099'].includes(url.port)
        ? route.continue() : route.abort();
    });
    return context;
  };
  const [cu,me]=await Promise.all([make(390,844),make(1280,840)]);
  const cp=await cu.newPage(),mp=await me.newPage();
  for(const p of [cp,mp]){
    p.setDefaultTimeout(25000);
    p.on('pageerror',e=>console.log('PAGE ERROR',e.message));
  }
  await Promise.all([cp.goto(customerUrl,{waitUntil:'commit'}),mp.goto(merchantUrl,{waitUntil:'commit'})]);
  console.log('Both fixture documents opened');
  for(const width of [390,320]){
    await mp.setViewportSize({width,height:844});
    const eye=role(mp,'Show password');
    await eye.waitFor();
    assert.equal(await eye.getAttribute('aria-controls'),'password');
    const box=await eye.boundingBox();
    assert.ok(box.width>=44 && box.height>=44);
    await eye.press('Tab');
    await eye.press('Enter');
    assert.equal(await mp.getByLabel('Password',{exact:true}).getAttribute('type'),'text');
    await role(mp,'Hide password').press('Space');
    assert.equal(await mp.getByLabel('Password',{exact:true}).getAttribute('type'),'password');
    console.log('MERCHANT_TOGGLE_PASS',width,box.width,box.height);
    await take(mp,'merchant-'+width);
    await cp.setViewportSize({width,height:width===320?650:844});
    await role(cp,'Accept').waitFor();
    try {
      await role(cp,'Log In').click({trial:true,timeout:3500});
      console.log('CUSTOMER_LOGIN_HIT_TEST_PASS',width);
    } catch(error) {
      console.log('CUSTOMER_LOGIN_HIT_TEST_FAIL',width,/popia-legal-bar/.test(error.message)?'privacy notice intercepts pointer events':error.message.split('\n')[0]);
      process.exitCode=1;
    }
    await take(cp,'customer-'+width);
  }
  await role(cp,'Accept').click();
  await role(cp,'Explore as Guest').click();
  const banner=cp.locator('#cookie-consent-banner');
  await banner.waitFor({state:'visible'});
  assert.match(await banner.innerText(),/remember your cart/);
  assert.doesNotMatch(await banner.innerText(),/delivery addresses/);
  await take(cp,'customer-consent-copy-320');
  console.log('CUSTOMER_CONSENT_COPY_PASS');
} finally {
  await writeFile(join(out,'measurements.json'),JSON.stringify(measurements,null,2));
  await browser?.close();
  await Promise.all(servers.map(s=>s.close()));
}