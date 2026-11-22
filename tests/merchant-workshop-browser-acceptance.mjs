// Isolated Chromium checks of the REAL React workshop component.
// The recognized Vercel-style hostname is virtual and served only by a
// local Vite fixture, without DNS, deployment, live auth or network APIs.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";

const dir="artifacts/workshop-acceptance";
mkdirSync(dir,{recursive:true});

const PREVIEW_ORIGIN="https://local-eats-dashboard-2-6m8o-acceptance-mehey9184-makers-projects.vercel.app";
const PROD_ORIGIN="https://dashboard.localeatssa.co.za";
const PAGE="/tests/fixtures/workshop-acceptance.html";
const LOCAL_ORIGIN="http://127.0.0.1:4173";

const browser=await chromium.launch({headless:true});
const observations=[];
let failures=0;

const check=async (label,fn)=>{
  try{
    await fn();
    observations.push({check:label,status:"PASS"});
    console.log(`PASS ${label}`);
  }catch(error){
    failures++;
    observations.push({check:label,status:"FAIL",message:String(error).slice(0,450)});
    console.error(`FAIL ${label} ${error}`);
  }
};

const makePage=async (viewport,origin,options={})=>{
  const context=await browser.newContext({
    viewport,
    reducedMotion:options.reducedMotion?"reduce":"no-preference",
    serviceWorkers:"block",
    ignoreHTTPSErrors:true,
  });
  const page=await context.newPage();
  const blocked=[];
  const requests=[];
  const consoleErrors=[];
  page.on("pageerror",err=>consoleErrors.push(String(err)));
  page.on("request",req=>requests.push({method:req.method(),url:req.url()}));
  await page.route("**/*",async route=>{
    const req=route.request();
    const url=new URL(req.url());
    if(req.method()!=="GET" || url.origin!==origin){
      blocked.push(`${req.method()} ${url.origin}${url.pathname}`);
      return route.abort("blockedbyclient");
    }
    // Every request is fulfilled by 127.0.0.1; no actual Vercel/domain
    // request or internet call leaves this headless test.
    const urlLocal=LOCAL_ORIGIN+url.pathname+url.search;
    try {
      const response=await route.fetch({url:urlLocal,maxRedirects:0});
      await route.fulfill({response});
    }catch(error){
      blocked.push(`LOCAL_FIXTURE_FAILED: ${url.pathname} ${String(error).slice(0,160)}`);
      await route.abort("failed");
    }
  });
  await page.goto(origin+PAGE,{waitUntil:"domcontentloaded",timeout:45000});
  return {page,context,blocked,requests,consoleErrors};
};

const runPositive=async (width,height,tag)=>{
  const state=await makePage({width,height},PREVIEW_ORIGIN,{reducedMotion:tag==="mobile-320"});
  const {page,blocked,consoleErrors,requests}=state;
  const dialog=page.getByRole("dialog",{name:"LocalEats Kitchen Workshop"});
  await check(`${tag} workshop renders as explicitly fictional modal`,async()=>{
    await dialog.waitFor({timeout:25000});
    assert.equal(await page.getByTestId("workshop-fake-ticket").count(),1);
    assert.ok(await page.getByText("Demo only · No real orders").isVisible());
    assert.ok(await page.getByText("Sample customer 1").isVisible());
    assert.ok(await page.getByText("Example R 25.00").isVisible());
    assert.ok(await page.getByText("not Firebase or device notifications.").isVisible());
  });
  await check(`${tag} no horizontal viewport overflow`,async()=>{
    // The dialog owns the vertical scroll. No horizontal offscreen controls.
    const dims=await page.evaluate(()=>({
      viewport:window.innerWidth,
      documentWidth:document.documentElement.scrollWidth,
      modalWidth:document.querySelector('[role="dialog"]')?.getBoundingClientRect().width,
    }));
    assert.ok(dims.documentWidth<=dims.viewport+2,JSON.stringify(dims));
    assert.ok(dims.modalWidth<=dims.viewport+2,JSON.stringify(dims));
  });
  await page.screenshot({path:`${dir}/${tag}-start.png`,fullPage:false,animations:"disabled"});
  await check(`${tag} pause, step and restart controls`,async()=>{
    await page.getByRole("button",{name:"Pause"}).click();
    const readTick=async()=>Number((await page.getByText(/Simulation step \d+/).innerText()).match(/\d+/)?.[0]||-1);
    const paused=await readTick();
    await page.waitForTimeout(2500);
    assert.equal(await readTick(),paused,"Clock must not advance while paused");
    await page.getByRole("button",{name:"Next step"}).click();
    assert.equal(await readTick(),paused+1);
    await page.getByRole("button",{name:"Restart"}).click();
    assert.equal(await readTick(),0);
    await page.getByRole("button",{name:"Pause"}).click();
  });
  await check(`${tag} accessibility controls and simulated arrivals`,async()=>{
    const heading=page.getByRole("heading",{name:"LocalEats Kitchen Workshop"});
    assert.ok(await heading.isVisible());
    assert.ok(await page.getByRole("button",{name:"Close the workshop demo"}).isVisible());
    await page.getByRole("button",{name:"Close the workshop demo"}).focus();
    await page.keyboard.press("Shift+Tab");
    const focused=await page.evaluate(()=>document.activeElement?.textContent?.trim());
    assert.equal(focused,"Restart");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("aria-label")),"Close the workshop demo");
  });
  await page.screenshot({path:`${dir}/${tag}-after-controls.png`,fullPage:false,animations:"disabled"});
  if(tag==="desktop"){
    await check("desktop workshop remains bounded after 30 artificial steps",async()=>{
      // The preceding control test already pauses the demo.
      // Make this stress test independent of its incoming toggle state.
      if (await page.getByRole("button",{name:"Pause"}).count()){
        await page.getByRole("button",{name:"Pause"}).click();
      }
      assert.equal(await page.getByRole("button",{name:"Resume"}).count(),1);
      for(let i=0;i<30;i++) await page.getByRole("button",{name:"Next step"}).click();
      const tickets=await page.getByTestId("workshop-fake-ticket").count();
      assert.ok(tickets<=10,`expected <=10, got ${tickets}`);
      await page.screenshot({path:`${dir}/desktop-after-30-steps.png`,fullPage:false,animations:"disabled"});
    });
    await check("desktop workshop closes with Escape and can reopen",async()=>{
      await page.keyboard.press("Escape");
      assert.equal(await dialog.count(),0);
      await page.getByRole("button",{name:"Reopen Workshop Demo"}).click();
      await dialog.waitFor();
      assert.equal(await page.getByTestId("workshop-fake-ticket").count(),1);
    });
  }
  await check(`${tag} no network writes, external APIs or runtime crashes`,async()=>{
    assert.deepEqual(blocked,[],`unexpected requests: ${JSON.stringify(blocked)}`);
    assert.equal(requests.some(req=>req.method!=="GET"),false);
    assert.equal(requests.some(req=>/\/api\/|supabase|firebase|fcm|analytics|sentry|cloudflare/i.test(new URL(req.url).pathname)),false);
    assert.deepEqual(consoleErrors,[]);
  });
  observations.push({check:`${tag} request summary`,status:"INFO",count:requests.length,origin:"localhost mocked preview origin"});
  await state.context.close();
};

try {
  await runPositive(320,740,"mobile-320");
  await runPositive(390,844,"mobile-390");
  await runPositive(1366,900,"desktop");
  await check("original Preview hostname guard refuses Production domain",async()=>{
    const state=await makePage({width:1366,height:900},PROD_ORIGIN);
    await state.page.waitForTimeout(1800);
    assert.equal(await state.page.getByRole("dialog",{name:"LocalEats Kitchen Workshop"}).count(),0);
    assert.equal(await state.page.getByTestId("workshop-fake-ticket").count(),0);
    assert.deepEqual(state.blocked,[]);
    await state.context.close();
  });
  await check("original Preview hostname guard refuses localhost",async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
    const page=await context.newPage();
    await page.goto(LOCAL_ORIGIN+PAGE,{waitUntil:"domcontentloaded"});
    await page.waitForTimeout(1800);
    assert.equal(await page.getByRole("dialog",{name:"LocalEats Kitchen Workshop"}).count(),0);
    await context.close();
  });
}finally{
  await browser.close();
  writeFileSync(`${dir}/acceptance-results.json`,JSON.stringify({failed:failures,steps:observations},null,2));
}
if(failures) process.exit(1);
console.log("WORKSHOP_ISOLATED_BROWSER_ACCEPTANCE_PASS");
