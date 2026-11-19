import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matchesActiveFirebaseUid} from '../src/services/merchantSessionScope.ts';
import {getAdapterErrorMessage,getAdapterErrorCode} from '../src/services/merchantAdapterError.ts';

test('cached or unauthenticated identities cannot claim the active Firebase UID',()=>{
 for(const cached of [null,{},[],{id:'merchant-b'}, {id:null}, {id:''}, {user_metadata:{shop_id:'verified-shop'}}]){
  assert.equal(matchesActiveFirebaseUid(cached,'merchant-a'),false);
 }
 assert.equal(matchesActiveFirebaseUid({id:'merchant-a'},null),false);
 assert.equal(matchesActiveFirebaseUid({id:'merchant-a'},'merchant-a'),true);
});
test('service error fields are narrowed rather than blindly trusted',()=>{
 assert.equal(getAdapterErrorCode({code:'42703'}),'42703');
 assert.equal(getAdapterErrorCode({code:42703}),null);
 assert.equal(getAdapterErrorMessage(new Error('network lost')),'network lost');
 assert.equal(getAdapterErrorMessage({message:'retry'}),'retry');
 assert.equal(getAdapterErrorMessage({message:{role:'admin'}}),'Unconfirmed service error');
});
test('Orders layout defaults to original Kanban while Switch selects a real alternative',()=>{
 const source=readFileSync(new URL('../src/components/OrdersManagement.tsx',import.meta.url),'utf8');
 assert.match(source,/useState<"kanban"\|"list">\("kanban"\)/);
 assert.match(source,/onClick=\{\(\) => setLayoutMode\(current => current==="kanban"/);
 assert.match(source,/layoutMode==="list"/);
 assert.doesNotMatch(source,/Layout: \{true \?/);
});
test('legacy orders cannot be deleted by a missing client-side OrderService symbol',()=>{
 const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/OrderService\.deleteAllOrdersForShops/);
});
