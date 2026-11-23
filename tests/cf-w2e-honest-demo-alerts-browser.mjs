import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";

const HOST="https://localeats-merchant-dashboard-preview.mehey9184.workers.dev";
const LOCAL="http://127.0.0.1:4177";
const DIR="artifacts/cf-w2e-alerts";
mkdirSync(DIR,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
let failures=0;

async function run(width,height){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:"block",reducedMotion:"reduce"});
  const page=await context.newPage();
  const outcome={width,height,pass:false,writes:[],outside:[],pageErrors:[],alerts:[],notes:0};
  try{
    // Capture sound/notification intent without requesting host OS permissions,
    // publishing a push subscription, or sending a real notification.
    await page.addInitScript(()=>{
      window.__demoAlertProbe={notifications:[],notes:0,permissions:0};
      class DemoAudioContext{
        state="running";currentTime=0;destination={};
        resume(){return Promise.resolve()}
        close(){this.state="closed";return Promise.resolve()}
        createOscillator(){return {frequency:{setValueAtTime:()=>{}},connect:()=>{},start:()=>{window.__demoAlertProbe.notes++},stop:()=>{}}}
        createGain(){return {gain:{setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},connect:()=>{}}}
      }
      class DemoBrowserNotification{
        static permission="default";
        static async requestPermission(){window.__demoAlertProbe.permissions++;DemoBrowserNotification.permission="granted";return "granted"}
        constructor(title,options){window.__demoAlertProbe.notifications.push({title,body:options.body,tag:options.tag})}
        close(){}
      }
      Object.defineProperty(window,"AudioContext",{value:DemoAudioContext,configurable:true});
      Object.defineProperty(window,"Notification",{value:DemoBrowserNotification,configurable:true});
    });
    page.on("pageerror",e=>outcome.pageErrors.push(String(e)));
    page.on("request",r=>{
      if(!["GET","HEAD"].includes(r.method()))outcome.writes.push(r.method()+" "+r.url());
    });
    await page.route("**/*",async route=>{
      const req=route.request(),u=new URL(req.url());
      if(u.origin!==HOST){
        if(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(u.hostname))outcome.outside.push(req.url());
        await route.abort("blockedbyclient");
        return;
      }
      if(!["GET","HEAD"].includes(req.method())){await route.abort("blockedbyclient");return}
      const rsp=await route.fetch({url:LOCAL+u.pathname+u.search,maxRedirects:0});
      const headers={...rsp.headers(),
        "content-security-policy":"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"};
      await route.fulfill({response:rsp,headers});
    });
    const resp=await page.goto(HOST+"/",{waitUntil:"domcontentloaded",timeout:35000});
    assert.equal(resp.status(),200);
    await page.getByRole("button",{name:"Orders"}).first().waitFor({timeout:14000});
    await page.getByRole("button",{name:"Orders"}).first().click();
    const start=page.getByRole("button",{name:"Start fictional order arrivals"});
    await start.waitFor({timeout:16000});
    const alertButton=page.getByRole("button",{name:"Enable simulated browser notifications"});
    await alertButton.waitFor({timeout:7000});
    let p=await page.evaluate(()=>window.__demoAlertProbe);
    assert.equal(p.permissions,0,"No permission requested without explicit tap");
    assert.equal(p.notifications.length,0);
    await alertButton.click();
    await page.getByRole("button",{name:"Disable simulated browser notifications"}).waitFor({timeout:7000});
    await start.click();
    await page.getByTestId("fake-incoming-order").first().waitFor({timeout:8000});
    p=await page.evaluate(()=>window.__demoAlertProbe);
    assert.equal(p.permissions,1,"permission request only on opt-in");
    assert.equal(p.notifications.length,1,"one example OS notification for the wave");
    assert.match(p.notifications[0].title,/DEMO ONLY/);
    assert.match(p.notifications[0].body,/fictional/);
    assert.equal(p.notes,3,"one original three-note chime for the first order");
    await page.screenshot({path:DIR+"/"+width+"-demo-orders.png",animations:"disabled"});
    await page.getByRole("button",{name:"Stop fictional order arrivals"}).click();
    await page.getByRole("button",{name:"Disable simulated browser notifications"}).click();
    await page.getByRole("button",{name:"Enable simulated browser notifications"}).waitFor();
    // One-off manual simulation still gives an in-app notification and sound,
    // but system notifications stay disabled after opt-out.
    await page.getByRole("button",{name:"Simulate a fake incoming pickup order"}).click();
    await page.getByText(/FAKE pickup order arrived — TEST ONLY/).first().waitFor({timeout:5500});
    p=await page.evaluate(()=>window.__demoAlertProbe);
    assert.equal(p.notifications.length,1,"no system notification after disabling");
    assert.equal(p.notes,6,"manual fake arrival also plays the original gentle chime");
    assert.deepEqual(outcome.pageErrors,[]);
    assert.deepEqual(outcome.writes,[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
    outcome.alerts=p.notifications;outcome.notes=p.notes;outcome.pass=true;
    console.log("PASS CF-W2E "+width+"px opt-in sound, local system notification, opt-out, no writes");
  }catch(e){
    failures++;
    outcome.failure=String(e).slice(0,1200);
    console.error("FAIL CF-W2E "+width+"px "+outcome.failure);
    try{await page.screenshot({path:DIR+"/"+width+"-failure.png",timeout:3500})}catch{}
  }finally{results.push(outcome);await context.close()}
}
try {
 await run(390,844);
 await run(1366,900);
}finally{
 await browser.close();
 writeFileSync(DIR+"/results.json",JSON.stringify({failures,results},null,2));
}
if(failures)process.exit(1);
