import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
function callback(scope){
 const source=readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8');
 const start=source.indexOf('const acceptAuthoritativeMerchantShop = useCallback(');
 const end=source.indexOf('const resolveMerchantShop =',start);
 const state={orders:['old-order'],menu:['old-menu'],shop:null};
 const request={current:3};
 const context={useCallback:fn=>fn,firebaseAuth:{currentUser:{uid:'synthetic-A'}},verifiedMerchantScope:{current:scope},verifiedMerchantUid:{current:'synthetic-A'},menuReadRequest:request,registerVerifiedShopId(){},setShops(rows){state.shop=rows[0]},setOrders(rows){state.orders=rows},setMenuItems(rows){state.menu=rows},setMerchantShopGate(){}};
 const fn=vm.runInNewContext(stripTypeScriptTypes(source.slice(start,end))+'\nacceptAuthoritativeMerchantShop',context);
 return {fn,state,request};
}
test('designation change clears previous menu/orders and invalidates stale menu read',()=>{const r=callback('synthetic-A:shop-1');r.fn('synthetic-A',{id:'shop-2',owner_id:'synthetic-A',approval_status:'approved'});assert.equal(r.state.menu.length,0);assert.equal(r.state.orders.length,0);assert.equal(r.request.current,4)});
test('same verified shop background refresh retains its current facts',()=>{const r=callback('synthetic-A:shop-1');r.fn('synthetic-A',{id:'shop-1',owner_id:'synthetic-A',approval_status:'approved'});assert.equal(r.state.menu[0],'old-menu');assert.equal(r.request.current,3)});
test('foreign ownership cannot replace current verified shop',()=>{const r=callback('synthetic-A:shop-1');assert.throws(()=>r.fn('synthetic-A',{id:'shop-2',owner_id:'synthetic-B',approval_status:'approved'}));assert.equal(r.state.shop,null)});
