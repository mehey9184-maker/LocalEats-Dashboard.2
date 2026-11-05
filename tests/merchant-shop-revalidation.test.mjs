import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {transformSync} from 'esbuild';

// Execute the actual App callbacks with synthetic identity/API dependencies.
// Extract through the TypeScript AST so formatting does not define this test.
const source=readFileSync('src/App.tsx','utf8');
const tree=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declarations=new Map();let auth;
function visit(node){
 if(ts.isVariableDeclaration(node) && ['merchantShopRequest','verifiedMerchantUid','acceptAuthoritativeMerchantShop','resolveMerchantShop'].includes(node.name.getText(tree)))
  declarations.set(node.name.getText(tree),node.parent.parent.getText(tree));
 if(ts.isCallExpression(node) && node.expression.getText(tree)==='onAuthStateChanged')auth=node.arguments[1].getText(tree);
 ts.forEachChild(node,visit);
}visit(tree);
assert.equal(declarations.size,4);assert.ok(auth);
const compiled=transformSync([...declarations.values(),`const authCallback=${auth};`,`export {authCallback,resolveMerchantShop};`].join('\n'),{loader:'tsx',format:'cjs',target:'es2022'}).code;
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(){
 const history=[];let gate,shop,user,apiReads=0;
 const identity={currentUser:{uid:'A'}};
 const controls={format:async fb=>({id:fb.uid}),read:async()=>({id:'shop-'+identity.currentUser.uid,owner_id:identity.currentUser.uid,approval_status:'approved'})};
 const dependencies={useRef:value=>({current:value}),useCallback:callback=>callback,firebaseAuth:identity,
  MerchantApi:{getMerchantShop:()=>{apiReads++;return controls.read();}},
  formatFirebaseUserSession:fb=>controls.format(fb),registerVerifiedShopId(){},clearVerifiedShopOwnership(){},clearMerchantShopOperationalCache(){},
  setShops:rows=>shop=rows[0],setOrders(){},setMenuItems(){},setMerchantShopGate:value=>{gate=value;history.push(value.status);},setUser:value=>user=value,
  getMerchantShopErrorMessage:()=> 'Verification unavailable',setDarkMode(){},setIsSessionChecking(){},setIsAuthReady(){},setLoading(){},localStorage:{setItem(){},removeItem(){}},console:{log(){},warn(){}}};
 const module={exports:{}};new Function('module','exports',...Object.keys(dependencies),compiled)(module,module.exports,...Object.values(dependencies));
 return {callbacks:module.exports,identity,controls,history,gate:()=>gate,shop:()=>shop,user:()=>user,reads:()=>apiReads};
}
test('delayed account A formatting cannot reset account B after B is verified',async()=>{
 const f=fixture(),old=deferred();f.controls.format=fb=>fb.uid==='A' ? old.promise : Promise.resolve({id:fb.uid});
 const first=f.callbacks.authCallback({uid:'A'});f.identity.currentUser={uid:'B'};
 await f.callbacks.authCallback({uid:'B'});assert.equal(f.gate().status,'ready');const before=f.history.length;
 old.resolve({id:'A'});await first;
 assert.equal(f.history.length,before);assert.equal(f.gate().status,'ready');assert.equal(f.shop().owner_id,'B');assert.equal(f.user().id,'B');
});
test('a stale resolver request cannot mutate state or invalidate the current request',async()=>{
 const f=fixture();f.identity.currentUser={uid:'B'};await f.callbacks.authCallback({uid:'B'});
 const before=f.history.length,reads=f.reads();await f.callbacks.resolveMerchantShop('A',true);
 assert.equal(f.history.length,before);assert.equal(f.reads(),reads);assert.equal(f.gate().status,'ready');
});
test('same-account background refresh preserves verified UI, but a current failure locks it',async()=>{
 const f=fixture();await f.callbacks.authCallback({uid:'A'});const pending=deferred();f.controls.read=()=>pending.promise;
 const refresh=f.callbacks.resolveMerchantShop('A',true);assert.equal(f.gate().status,'ready');
 pending.reject(Error('offline'));await refresh;assert.equal(f.gate().status,'error');assert.equal(f.shop(),undefined);
});
test('an obsolete signed-out notification cannot clear a currently verified account',async()=>{
 const f=fixture();f.identity.currentUser={uid:'B'};await f.callbacks.authCallback({uid:'B'});
 const before=f.history.length;await f.callbacks.authCallback(null);
 assert.equal(f.history.length,before);assert.equal(f.user().id,'B');assert.equal(f.gate().status,'ready');
});
test('an old in-flight failure cannot clear a newer verified account',async()=>{
 const f=fixture(),old=deferred();f.controls.read=()=>old.promise;
 const first=f.callbacks.authCallback({uid:'A'});await Promise.resolve();
 f.identity.currentUser={uid:'B'};f.controls.read=async()=>({id:'B-shop',owner_id:'B',approval_status:'approved'});
 await f.callbacks.authCallback({uid:'B'});old.reject(Error('old outage'));await first;
 assert.equal(f.gate().status,'ready');assert.equal(f.shop().owner_id,'B');assert.equal(f.user().id,'B');
});
