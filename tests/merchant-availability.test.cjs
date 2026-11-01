const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function transpile(file){return ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;}
function loadCommand(){
  const context={exports:{},module:{exports:{}},console};
  vm.runInNewContext(transpile('src/utils/merchantAvailabilityCommand.ts'),context);
  return context.exports;
}
function load(api,confirm=true,command=loadCommand()){
  const storage=new Map([['localeats_manual_status_override_shop','stale']]);const events=[];class ApiError extends Error{};
  const context={exports:{},require:(id)=>String(id).includes('merchantAvailabilityCommand')?command:{MerchantApi:api,MerchantApiError:ApiError},Date,Intl,console,localStorage:{removeItem:k=>storage.delete(k)},CustomEvent:class{constructor(name,init){this.detail=init.detail;}},window:{confirm:()=>confirm,dispatchEvent:e=>events.push(e)}};
  vm.runInNewContext(transpile('src/utils/availabilityChecker.ts'),context);return {f:context.exports,command,ApiError,storage,events};
}
test('failed persistence never announces success or overwrites server state',async()=>{const c=load({setAvailability:async()=>{throw Error('offline')}});let success=false;const result=await c.f.syncShopAvailability({shopId:'shop',isOpen:true,onSuccess:()=>success=true});assert.equal(result.success,false);assert.equal(success,false);assert.equal(c.events.length,0);assert.equal(c.f.isShopOpen({id:'shop',is_active:false}),false);});
test('confirmed persistence clears stale override and updates UI once',async()=>{const c=load({setAvailability:async()=>({id:'shop',is_active:true,availability_revision:5})});assert.equal((await c.f.syncShopAvailability({shopId:'shop',isOpen:true})).success,true);assert.equal(c.events.length,1);assert.equal(c.storage.size,0);});
test('outside-hours confirmation preserves original revision',async()=>{const calls=[];let c;c=load({setAvailability:async(...args)=>{calls.push(args);if(calls.length===1){const e=new c.ApiError('confirm');e.code='OUTSIDE_HOURS_CONFIRMATION_REQUIRED';e.expectedRevision=7;throw e;}return {id:'shop',is_active:true,availability_revision:8};}});assert.equal((await c.f.syncShopAvailability({shopId:'shop',isOpen:true})).success,true);assert.equal(calls[1][2],true);assert.equal(calls[1][3],7);});
test('declining outside-hours confirmation performs no mutation',async()=>{let calls=0,c;c=load({setAvailability:async()=>{calls++;const e=new c.ApiError('confirm');e.code='OUTSIDE_HOURS_CONFIRMATION_REQUIRED';throw e;}},false);assert.equal((await c.f.syncShopAvailability({shopId:'shop',isOpen:true})).success,false);assert.equal(calls,1);assert.equal(c.events.length,0);});
test('stale older revision is ignored while equal or newer revision is accepted',()=>{
  const c=loadCommand();
  const current={id:'shop',is_active:false,availability_revision:5};
  assert.equal(c.shouldAcceptAvailabilityShop(current,{id:'shop',is_active:true,availability_revision:4}),false);
  assert.equal(c.shouldAcceptAvailabilityShop(current,{id:'shop',is_active:false,availability_revision:5}),true);
  assert.equal(c.shouldAcceptAvailabilityShop(current,{id:'shop',is_active:true,availability_revision:6}),true);
});
test('duplicate rapid clicks share one pending mutation',async()=>{
  let calls=0;let release;const started=new Promise(resolve=>release=resolve);
  const c=load({setAvailability:async()=>{calls++;await started;return {id:'shop',is_active:false,availability_revision:5};}});
  const first=c.f.syncShopAvailability({shopId:'shop',isOpen:false});
  const second=c.f.syncShopAvailability({shopId:'shop',isOpen:false});
  const opposite=await c.f.syncShopAvailability({shopId:'shop',isOpen:true});
  assert.equal(opposite.success,false);
  assert.match(opposite.error,/already updating/);
  assert.equal(c.command.isAvailabilityCommandPending('shop'),true);
  release();
  const [a,b]=await Promise.all([first,second]);
  assert.equal(calls,1);
  assert.equal(a.success,true);
  assert.equal(b.success,true);
  assert.equal(c.command.isAvailabilityCommandPending('shop'),false);
});
test('delayed older read cannot overwrite a newer confirmed shop',()=>{
  const c=loadCommand();
  let displayed={id:'shop',is_active:false,availability_revision:5};
  const delayed={id:'shop',is_active:true,availability_revision:4};
  if(c.shouldAcceptAvailabilityShop(displayed,delayed)) displayed=delayed;
  assert.equal(displayed.is_active,false);
  assert.equal(displayed.availability_revision,5);
});
test('revision conflict refreshes from the server and does not report success',async()=>{
  let c;c=load({
    setAvailability:async()=>{const e=new c.ApiError('changed');e.code='AVAILABILITY_CHANGED';e.expectedRevision=4;throw e;},
    getMerchantShop:async()=>({id:'shop',is_active:true,availability_revision:6}),
  });
  const result=await c.f.syncShopAvailability({shopId:'shop',isOpen:false});
  assert.equal(result.success,false);
  assert.equal(result.conflict,true);
  assert.equal(result.freshShop.availability_revision,6);
  assert.equal(c.events.length,1);
  assert.equal(c.events[0].detail.is_active,true);
});
test('saved revision must be newer than the command expected revision',()=>{
  const c=loadCommand();
  assert.equal(c.isSavedAvailabilityRevisionCurrent(4,{id:'shop',availability_revision:4}),false);
  assert.equal(c.isSavedAvailabilityRevisionCurrent(4,{id:'shop',availability_revision:5}),true);
});
test('two-tab simulation keeps the newest confirmed revision',()=>{
  const c=loadCommand();
  let displayed={id:'shop',is_active:true,availability_revision:4};
  const tabA={id:'shop',is_active:false,availability_revision:5};
  const tabB={id:'shop',is_active:true,availability_revision:4};
  if(c.shouldAcceptAvailabilityShop(displayed,tabA)) displayed={...displayed,...tabA};
  if(c.shouldAcceptAvailabilityShop(displayed,tabB)) displayed={...displayed,...tabB};
  assert.equal(displayed.is_active,false);
  assert.equal(displayed.availability_revision,5);
});
test('availability diagnostics retain only allowlisted sanitized fields',()=>{
  const c=loadCommand();
  c.logAvailabilityDiagnostic({outcome:'saved',shopId:'shop',requestedOpen:true,expectedRevision:4,savedRevision:5,code:'SAVED',token:'secret-token',uid:'private-uid',message:'private message'});
  const stored=JSON.parse(JSON.stringify(c.readAvailabilityDiagnostics()[0]));
  assert.deepEqual(Object.keys(stored).sort(),['code','expectedRevision','outcome','requestedOpen','savedRevision','shopId'].sort());
  assert.doesNotMatch(JSON.stringify(stored),/secret-token|private-uid|private message/);
});
