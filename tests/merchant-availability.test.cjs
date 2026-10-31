const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function transpile(file){return ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;}
function loadCoordinator(){const mod={exports:{}};vm.runInNewContext(transpile('src/utils/availabilityCoordinator.ts'),{exports:mod.exports,console:{info(){}}});return mod.exports;}
function load(api,confirm=true){const storage=new Map([['localeats_manual_status_override_shop','stale']]);const events=[];class ApiError extends Error{};const coordinator=loadCoordinator();
 const code=ts.transpileModule(fs.readFileSync('src/utils/availabilityChecker.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context={exports:{},require:(m)=>/availabilityCoordinator/.test(m)?coordinator:({MerchantApi:api,MerchantApiError:ApiError}),Date,Intl,console,localStorage:{removeItem:k=>storage.delete(k)},CustomEvent:class{constructor(name,init){this.detail=init.detail;}},window:{confirm:()=>confirm,dispatchEvent:e=>events.push(e)}};
 vm.runInNewContext(code,context);return {f:context.exports,coordinator,ApiError,storage,events};}
test('failed persistence never announces success or overwrites server state',async()=>{const c=load({setAvailability:async()=>{throw Error('offline')}});let success=false;const result=await c.f.syncShopAvailability({shopId:'shop',isOpen:true,onSuccess:()=>success=true});assert.equal(result.success,false);assert.equal(success,false);assert.equal(c.events.length,0);assert.equal(c.f.isShopOpen({id:'shop',is_active:false}),false);});
test('confirmed persistence clears stale override and updates UI once',async()=>{const c=load({setAvailability:async()=>({id:'shop',is_active:true})});assert.equal((await c.f.syncShopAvailability({shopId:'shop',isOpen:true})).success,true);assert.equal(c.events.length,1);assert.equal(c.storage.size,0);});
test('outside-hours confirmation preserves original revision',async()=>{const calls=[];let c;c=load({setAvailability:async(...args)=>{calls.push(args);if(calls.length===1){const e=new c.ApiError('confirm');e.code='OUTSIDE_HOURS_CONFIRMATION_REQUIRED';e.expectedRevision=7;throw e;}return {id:'shop',is_active:true};}});assert.equal((await c.f.syncShopAvailability({shopId:'shop',isOpen:true})).success,true);assert.equal(calls[1][2],true);assert.equal(calls[1][3],7);});
test('declining outside-hours confirmation performs no mutation',async()=>{let calls=0,c;c=load({setAvailability:async()=>{calls++;const e=new c.ApiError('confirm');e.code='OUTSIDE_HOURS_CONFIRMATION_REQUIRED';throw e;}},false);assert.equal((await c.f.syncShopAvailability({shopId:'shop',isOpen:true})).success,false);assert.equal(calls,1);assert.equal(c.events.length,0);});

// ---- Stale-state and duplicate-command regression tests ----
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const shopAt=(rev,open)=>({id:'shop',is_active:open,availability_revision:rev});

test('a delayed read with an older revision never replaces a newer saved state',async()=>{
  const c=load({setAvailability:async()=>shopAt(5,true)});
  assert.equal((await c.f.syncShopAvailability({shopId:'shop',isOpen:true})).success,true);
  const late=shopAt(4,false);
  assert.equal(c.coordinator.acceptShopSnapshot(late),false,'older revision must be rejected');
  assert.equal(c.coordinator.latestKnownShop('shop').is_active,true,'newest saved state is kept');
  assert.equal(c.coordinator.acceptShopSnapshot(shopAt(5,true)),true,'same revision is accepted (expiry changes state without a new revision)');
  assert.equal(c.coordinator.acceptShopSnapshot(shopAt(6,false)),true,'newer revision is accepted');
  assert.equal(c.coordinator.acceptShopSnapshot({id:'shop',is_active:true}),true,'older API responses without a revision still work');
  assert.equal(c.coordinator.acceptShopSnapshot({id:'other',availability_revision:1}),true,'other shops are independent');
});

test('rapid duplicate clicks with the same target make exactly one API call',async()=>{
  const gate=deferred();let calls=0;
  const c=load({setAvailability:async()=>{calls++;await gate.promise;return shopAt(5,false);}});
  let ok1=0,ok2=0;
  const a=c.f.syncShopAvailability({shopId:'shop',isOpen:false,onSuccess:()=>ok1++});
  const b=c.f.syncShopAvailability({shopId:'shop',isOpen:false,onSuccess:()=>ok2++});
  await tick();assert.equal(calls,1);
  gate.resolve();const [ra,rb]=await Promise.all([a,b]);
  assert.equal(calls,1,'second click must not create a second save');
  assert.equal(ra.success,true);assert.equal(rb.success,true);
  assert.equal(ok1,1);assert.equal(ok2,1,'each caller still gets its own success callback');
  assert.equal(c.events.length,1,'one confirmation event, one UI update');
});

test('a conflicting command while one is saving is refused with no API call, then works after',async()=>{
  const gate=deferred();let calls=0;const targets=[];
  const c=load({setAvailability:async(id,open)=>{calls++;targets.push(open);if(calls===1)await gate.promise;return shopAt(4+calls,open);}});
  let refused=null;
  const close=c.f.syncShopAvailability({shopId:'shop',isOpen:false});
  await tick();
  const open=await c.f.syncShopAvailability({shopId:'shop',isOpen:true,onError:m=>refused=m});
  assert.equal(open.success,false);assert.match(open.error,/still being saved/);assert.equal(refused,open.error);
  assert.equal(calls,1,'the refused command never reached the API');
  gate.resolve();assert.equal((await close).success,true);
  assert.equal((await c.f.syncShopAvailability({shopId:'shop',isOpen:true})).success,true);
  assert.deepEqual(targets,[false,true],'final state follows the last accepted command, never a racing one');
});

test('different shops do not block each other',async()=>{
  const gate=deferred();let calls=0;
  const c=load({setAvailability:async(id,open)=>{calls++;await gate.promise;return {id,is_active:open,availability_revision:1};}});
  const a=c.f.syncShopAvailability({shopId:'one',isOpen:true});const b=c.f.syncShopAvailability({shopId:'two',isOpen:false});
  await tick();assert.equal(calls,2);gate.resolve();await Promise.all([a,b]);
});

test('commands carry the last known revision; the first command sends none',async()=>{
  const seen=[];
  const c=load({setAvailability:async(id,open,confirm,expected)=>{seen.push(expected);return shopAt(7+seen.length,open);}});
  await c.f.syncShopAvailability({shopId:'shop',isOpen:false});
  await c.f.syncShopAvailability({shopId:'shop',isOpen:true});
  assert.equal(seen[0],undefined);assert.equal(seen[1],8);
});

test('a revision conflict refreshes from the server, shows a plain message and never auto-retries',async()=>{
  let sets=0;let ref;
  const c=load({setAvailability:async()=>{sets++;const e=new ref.ApiError('AVAILABILITY_CHANGED');e.code='AVAILABILITY_CHANGED';e.status=409;throw e;},getMerchantShop:async()=>shopAt(9,false)});
  ref=c;
  const result=await c.f.syncShopAvailability({shopId:'shop',isOpen:true});
  assert.equal(result.success,false);assert.equal(sets,1,'no silent rebase or retry');
  assert.match(result.error,/changed elsewhere/);assert.doesNotMatch(result.error,/AVAILABILITY_CHANGED/);
  assert.equal(c.events.length,1);assert.equal(c.events[0].detail.availability_revision,9);
  assert.equal(c.coordinator.latestKnownShop('shop').is_active,false);
});

test('two tabs: a stale tab cannot silently override a newer save',async()=>{
  // Fake server that enforces the revision exactly like merchant_set_availability.
  const server={rev:4,open:true,log:[]};
  const makeTab=()=>{const holder={};const tab=load({setAvailability:(...a)=>holder.api.setAvailability(...a),getMerchantShop:()=>holder.api.getMerchantShop()});
    holder.api={
      setAvailability:async(id,open,confirm,expected)=>{const rev=expected??server.rev;
        if(rev!==server.rev){const e=new tab.ApiError('AVAILABILITY_CHANGED');e.code='AVAILABILITY_CHANGED';e.status=409;throw e;}
        server.open=open;server.rev++;server.log.push(open?'open':'close');return shopAt(server.rev,server.open);},
      getMerchantShop:async()=>shopAt(server.rev,server.open)};
    return tab;};
  const tabA=makeTab(),tabB=makeTab();
  // Both tabs have loaded revision 4.
  tabA.coordinator.noteShopRevision(shopAt(4,true));tabB.coordinator.noteShopRevision(shopAt(4,true));
  assert.equal((await tabA.f.syncShopAvailability({shopId:'shop',isOpen:false})).success,true);  // tab A closes -> revision 5
  const stale=await tabB.f.syncShopAvailability({shopId:'shop',isOpen:true});                    // tab B still believes revision 4
  assert.equal(stale.success,false,'the stale tab is told the shop changed');
  assert.equal(server.open,false,'the stale tab did NOT reopen the shop');
  assert.deepEqual(server.log,['close']);
  assert.equal(tabB.events[0].detail.is_active,false,'the stale tab now shows the server state');
  assert.equal((await tabB.f.syncShopAvailability({shopId:'shop',isOpen:true})).success,true,'after the refresh the merchant can deliberately reopen');
  assert.deepEqual(server.log,['close','open']);
});

test('diagnostics record what was requested and saved without tokens, uids or messages',async()=>{
  let ref;
  const c=load({setAvailability:async(id,open)=>{if(open===true){const e=new ref.ApiError('Bearer eyJSECRETTOKEN uid=abc123');e.code='SOMETHING_ELSE';e.status=503;throw e;}return shopAt(5,false);}});ref=c;
  await c.f.syncShopAvailability({shopId:'shop',isOpen:false});
  await c.f.syncShopAvailability({shopId:'shop',isOpen:true});
  c.coordinator.recordAvailabilityEvent({shopId:'shop',event:'probe',requestedOpen:true,token:'SECRETX',uid:'UIDX',authorization:'Bearer SECRETX'});
  const log=c.coordinator.getAvailabilityDiagnostics();const text=JSON.stringify(log);
  const saved=log.find(e=>e.event==='command_saved');
  assert.equal(saved.requestedOpen,false);assert.equal(saved.savedRevision,5);assert.equal(saved.shopId,'shop');
  const failed=log.find(e=>e.event==='command_failed');assert.equal(failed.status,503);assert.equal(failed.code,'SOMETHING_ELSE');
  for(const secret of ['eyJSECRETTOKEN','abc123','SECRETX','UIDX','Bearer'])assert.equal(text.includes(secret),false,`log must not contain ${secret}`);
});
