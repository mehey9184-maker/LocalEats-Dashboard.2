import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=source("src/App.tsx"),ui=source("src/components/InstallAppInvite.tsx");
const bridge=source("src/services/pwaInstallInvite.ts");
const vite=source("vite.config.ts");

test("PWA: existing standalone manifest remains active and brand identity is correct",()=>{
  assert.match(vite,/VitePWA\(/);
  assert.match(vite,/display: "standalone"/);
  assert.match(vite,/icons:/);
  assert.match(vite,/name: "LocalEats Merchant Dashboard"/);
  assert.match(vite,/start_url: "\/"/); // Preserve existing installed Merchant app identity
  assert.doesNotMatch(vite,/id: "\/merchant-dashboard"/);
});
test("PWA: optional invitation only after verified sign-in, with real user choice and iOS steps",()=>{
  assert.match(app,/import \{ InstallAppInvite \} from "\.\/components\/InstallAppInvite"/);
  assert.match(app,/storageKey="localeats_merchant_install_defer_v2"/);
  assert.match(app,/appName="LocalEats Merchant"/);
  assert.match(app,/eligible=\{Boolean\(/);
  assert.match(app,/merchantShopGate\.status === "ready"/); assert.match(app,/!onboardingOpen &&\s+!isNotificationCenterOpen/);
  assert.match(ui,/Install now/);
  assert.match(ui,/Maybe later/);
  assert.match(ui,/Add to Home Screen/);
  assert.match(ui,/const event = consumeInstallEvent\(\)/);
  assert.match(ui,/await event\.prompt\(\)/);
  assert.match(ui,/appAlreadyInstalled\(\)/);
  assert.match(ui,/hasDeferredInstall\(storageKey\)/);
  assert.match(bridge,/window\.addEventListener\("beforeinstallprompt"/);
  assert.match(bridge,/window\.addEventListener\("appinstalled"/);
  assert.match(bridge,/INSTALL_REMINDER_HOURS = 20/);
  assert.match(bridge,/AUTO_INSTALL_DELAY_MS = 10 \* 60 \* 1000/);
  assert.match(bridge,/hours = INSTALL_REMINDER_HOURS/);
  assert.match(bridge,/const installedMarker = "localeats_pwa_installed_verified_v1"/);
  assert.match(ui,/let remaining = AUTO_INSTALL_DELAY_MS/);
  assert.match(ui,/document.addEventListener\("visibilitychange", sync\)/);
  assert.match(ui,/document.removeEventListener\("visibilitychange", sync\)/);
  assert.match(ui,/document.visibilityState !== "visible"/);
  assert.match(ui,/allowAutoShow && ready/);
  assert.match(ui,/!hasDeferredInstall\(storageKey\) && canPrompt/);
  assert.match(app,/allowAutoShow=\{/);
  assert.doesNotMatch(ui,/window\.location\.href/);
});
test("Merchant Home offers a persistent manual install entry without nagging after deferral",()=>{
  const home=source("src/components/DashboardOverview.tsx");
  assert.match(home,/onInstallApp\?: \(\) => void/);
  assert.match(home,/onClick=\{onInstallApp\}/);
  assert.match(home,/isAppInstalled \? "App Installed" : "Install App"/);
  assert.match(home,/disabled=\{isAppInstalled\}/);
  assert.match(home,/className="sm:hidden"/); // mobile CTA is at the very top of Home
  assert.ok(home.indexOf('className="sm:hidden"') < home.indexOf("Storefront Ownership Sync & Repair Card"));
  assert.match(app,/hidden sm:inline-flex min-h-11 min-w-11/); // fixed tablet/desktop toolbar
  assert.match(app,/onClick=\{\(\) => setManualInstallOpen\(true\)\}/);
  assert.match(app,/isPwaInstalled \? "App Installed" : "Install App"/);
  assert.match(app,/subscribeToInstallability\(\(\) => setIsPwaInstalled\(appAlreadyInstalled\(\)\)\)/);
  assert.ok(app.indexOf('Always visible in the fixed desktop/tablet header') <
    app.indexOf('setSoundAlerts(!soundAlerts)'), "Install entry precedes the bell in the visible top bar");
  assert.match(app,/manualOpen=\{manualInstallOpen\}/); // Dashboard click still opens manually
  assert.match(app,/allowAutoShow=\{activeTab === "dashboard"/);
  assert.match(home,/Install LocalEats Merchant app/); // accessible button name
  assert.match(ui,/deferInstallOffer\(storageKey\)/); // snooze is preserved for automatic offers
  assert.match(home,/min-h-11/);
  assert.match(app,/onInstallApp=\{\(\) => setManualInstallOpen\(true\)\}/);
  assert.match(app,/manualOpen=\{manualInstallOpen\}/);
  assert.match(app,/onManualClose=\{\(\) => setManualInstallOpen\(false\)\}/);
  assert.match(ui,/const showManual = Boolean\(manualOpen && eligible && !installed\)/);
  assert.match(ui,/if \(!showManual && !showAutomatic\) return null/);
  assert.match(ui,/hasDeferredInstall\(storageKey\)/);
  assert.match(ui,/onAppleDevice \|\| !canPrompt/);
  assert.match(ui,/Not every browser supports website installation/);
});

test("PWA: browser eligibility, cancellation, already-installed state and respectful cooldown",async()=>{
  const handlers=new Map();
  const data=new Map();
  globalThis.window={
    addEventListener:(type,handler)=>handlers.set(type,handler),
    matchMedia:()=>({matches:false}),
    localStorage:{getItem:(key)=>data.get(key)??null,setItem:(key,v)=>data.set(key,String(v))}
  };
  Object.defineProperty(globalThis,"navigator",{value:{userAgent:"Mozilla/5.0 Android Chrome",maxTouchPoints:0,standalone:false},configurable:true});
  const service=await import("../src/services/pwaInstallInvite.ts");
  assert.equal(service.appAlreadyInstalled(),false);
  assert.equal(service.appleMobileBrowser(),false);
  assert.equal(service.availableInstallEvent(),null);
  let changes=0;
  const unsubscribe=service.subscribeToInstallability(()=>changes++);
  const fake=new Event("beforeinstallprompt",{cancelable:true});
  fake.prompt=async()=>({outcome:"dismissed"});
  fake.userChoice=Promise.resolve({outcome:"dismissed"});
  handlers.get("beforeinstallprompt")(fake);
  assert.equal(fake.defaultPrevented,true);
  assert.equal(service.availableInstallEvent(),fake);
  assert.equal(service.consumeInstallEvent(),fake);
  assert.equal(service.availableInstallEvent(),null);
  assert.equal(changes,2);
  assert.equal(service.hasDeferredInstall("test"),false);
  service.deferInstallOffer("test");
  assert.equal(service.hasDeferredInstall("test"),true);
  assert.equal(service.hasDeferredInstall("test",Date.now()+19*3600000),true);
  assert.equal(service.hasDeferredInstall("test",Date.now()+21*3600000),false);
  navigator.userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
  assert.equal(service.appleMobileBrowser(),true);
  handlers.get("appinstalled")(new Event("appinstalled"));
  assert.equal(service.appAlreadyInstalled(),true);
  assert.equal(window.localStorage.getItem("localeats_pwa_installed_verified_v1"),"true");
  unsubscribe();
});
