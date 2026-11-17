import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {getNotificationWorkers, runBrowserNotificationCheck, waitForMessagingWorker} from "../src/lib/merchantPushDiagnostics.ts";

const origin="https://merchant.example";
const worker=(path="/firebase-messaging-sw.js")=>({scriptURL:origin+path,state:"activated"});
const root={scope:origin+"/",active:worker("/sw.js")};

test("a root scope fallback cannot masquerade as the FCM registration",async()=>{
  const workers=await getNotificationWorkers({getRegistrations:async()=>[root]},origin);
  assert.equal(workers.fcm,undefined);
  assert.equal(workers.pwa,root);
});

test("wait for an explicitly registered worker to activate before using PushManager",async()=>{
  const installing=Object.assign(new EventTarget(),{state:"installing"});
  const registration={active:null,installing,waiting:null};
  let resolved=false;
  const ready=waitForMessagingWorker(registration).then(()=>{resolved=true;});
  await Promise.resolve();
  assert.equal(resolved,false);
  installing.state="activated";
  installing.dispatchEvent(new Event("statechange"));
  await ready;
  assert.equal(resolved,true);
});

test("a visibility probe rejection preserves Chrome display acceptance",async()=>{
  const result=await runBrowserNotificationCheck({
    showNotification:async()=>{},
    getNotifications:async()=>{throw new Error("unavailable");},
  });
  assert.equal(result,"readback-unavailable");
});

test("an empty initial listing can become visible on a bounded second probe",async()=>{
  let tag;
  let reads=0;
  const result=await runBrowserNotificationCheck({
    showNotification:async(title,options)=>{tag=options.tag;},
    getNotifications:async(options)=>{
      assert.equal(options.tag,tag);
      return ++reads===2?[{tag}]:[];
    },
  },async()=>{});
  assert.equal(result,"listed-after-retry");
  assert.equal(reads,2);
});

test("background test reports a failed display without leaking payload or errors",async()=>{
  const events=[];
  let handler;
  const client={postMessage:message=>events.push(JSON.parse(JSON.stringify(message)))};
  runInNewContext(readFileSync(new URL("../public/firebase-messaging-sw.js",import.meta.url),"utf8"),{
    self:{addEventListener(){},registration:{showNotification:async()=>{throw new Error("private detail");}}},
    clients:{matchAll:async()=>[client]},
    importScripts(){},
    firebase:{initializeApp(){},messaging:()=>({onBackgroundMessage(fn){handler=fn;}})},
  });
  await handler({data:{type:"merchant_push_test",test_id:"private-id"}});
  assert.deepEqual(events,[
    {type:"merchant-push-test-background",display:"failed"},
  ]);
});
