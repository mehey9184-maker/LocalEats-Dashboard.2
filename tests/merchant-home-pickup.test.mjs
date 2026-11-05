import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {pickupHomeOrders,pickupReadyCount,pickupCsvCell,pickupReportCsv,pickupDayKey} from '../src/services/merchantHomePickup.ts';
const require=createRequire(import.meta.url);
async function component(){
 const result=await build({entryPoints:['src/components/DashboardOverview.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',define:{'import.meta.env':JSON.stringify({VITE_PICKUP_ORDERING_ENABLED:'false'})},plugins:[{name:'isolated-home',setup(b){
  b.onLoad({filter:/[\\/]lib[\\/]firebase\.ts$/},()=>({contents:'export async function updateFirestoreShop(){}',loader:'js'}));
  b.onLoad({filter:/[\\/]lib[\\/]supabase\.ts$/},()=>({contents:'export const supabase={};',loader:'js'}));
  b.onLoad({filter:/[\\/]hooks[\\/]useAuthGuard\.ts$/},()=>({contents:'export const useAuthGuard=()=>({subscribeWithAuthGuard:async()=>null});',loader:'js'}));
  b.onLoad({filter:/[\\/]utils[\\/]availabilityChecker\.ts$/},()=>({contents:'export async function syncShopAvailability(){}',loader:'js'}));
  b.onLoad({filter:/[\\/]components[\\/]MenuManagement\.tsx$/},()=>({contents:'export const FoodPlaceholder=()=>null;',loader:'js'}));
 }}]});const mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,mod,mod.exports);return mod.exports.DashboardOverview;
}
test('merchant Home describes pickup and pay-at-shop without bank, rider or dispatch setup',async()=>{
 const Home=await component();const shop={id:'shop',owner_id:'merchant',name:'Fixture kitchen',opening_time:'08:00',closing_time:'20:00',is_active:true};
 for(const mode of ['compact','advanced']){
 globalThis.localStorage={getItem:key=>key==='localeats_dashboard_layout'?mode:null,setItem:()=>{}};
 const html=renderToStaticMarkup(React.createElement(Home,{orders:[],loading:false,shops:[shop],user:{id:'merchant'},onRefresh(){},onNavigate(){},onEditProfile(){},menuItems:[],menuReadState:"ready",orderReadState:"fresh",trialInfo:null,currentShop:shop,darkMode:false}));
 const text=html.replace(/<[^>]+>/g," ").replace(/\s+/g," ");
 assert.doesNotMatch(text,/Pending Payout|Next payout|Link Payouts|Driver Availability|Delivery Dispatch|Zone Profitability|NEW WALK-IN ORDER|New POS Order/);
 assert.match(text,/Pay at shop/);assert.match(text,/Ready for pickup/);assert.match(text,/View pickup orders/i);
 assert.doesNotMatch(text,/Avg\. Prep|Revenue|Bank account verified/);
 }
});
test('unverified menu counts are presented as loading or unavailable',async()=>{
 const Home=await component();const shop={id:'shop',owner_id:'merchant',name:'Fixture kitchen'};
 for(const state of ['loading','failed']){
  const html=renderToStaticMarkup(React.createElement(Home,{orders:[],loading:false,shops:[shop],user:{id:'merchant'},onRefresh(){},onNavigate(){},onEditProfile(){},menuItems:[],menuReadState:state,trialInfo:null,currentShop:shop,darkMode:false}));
  const text=html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  assert.match(text,state==='loading' ? /Loading…/ : /Unavailable/);
  assert.doesNotMatch(text,/0 listed/);
 }
});
test('Home counts only persisted pickup orders for the current verified shop',()=>{
 const rows=[{shop_id:'shop',delivery_type:'collection',status:'ready'},
 {shop_id:'shop',delivery_type:'collection',status:'ready_for_pickup'},
 {shop_id:'shop',delivery_type:'collection',status:'preparing'},
 {shop_id:'other',delivery_type:'collection',status:'ready'},
 {shop_id:'shop',delivery_type:'delivery',status:'ready'},
 {shop_id:'shop',order_type:'pickup',status:'ready'}];
 assert.equal(pickupHomeOrders(rows,'shop').length,3);assert.equal(pickupReadyCount(pickupHomeOrders(rows,'shop')),2);
 assert.deepEqual(pickupHomeOrders(rows,undefined),[]);
});

test('reports preserve quoted cells and neutralize spreadsheet formulas',()=>{
 assert.equal(pickupCsvCell('Meal, "spicy"'), '"Meal, ""spicy"""');
 assert.equal(pickupCsvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
 assert.equal(pickupCsvCell('  +1+1').startsWith('"\''),true);
 const csv=pickupReportCsv([{id:'o',product_name:'Meal',total_price:25,pickup_status:'ready_for_pickup',payment_status:'unpaid',created_at:'2026-11-06T08:00:00Z'}]);
 assert.match(csv,/Payment status/);assert.match(csv,/"unpaid"/);assert.doesNotMatch(csv,/Revenue|Payout/);
});

test('failed order refresh offers recovery instead of claiming an empty pickup queue',async()=>{
 const Home=await component();const shop={id:'shop',owner_id:'merchant',name:'Fixture kitchen'};
 const html=renderToStaticMarkup(React.createElement(Home,{orders:[],loading:false,shops:[shop],user:{id:'merchant'},onRefresh(){},onNavigate(){},onEditProfile(){},menuItems:[],menuReadState:'ready',orderReadState:'failed',trialInfo:null,currentShop:shop,darkMode:false}));
 const text=html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
 assert.match(text,/Pickup statuses could not be refreshed/);assert.match(text,/Unavailable/);
 assert.doesNotMatch(text,/Awaiting Your First Order|First pickups today|No pickups today/);
});

test('pickup days follow the South African shop date across UTC midnight boundaries',()=>{
 assert.equal(pickupDayKey('2026-11-05T22:30:00Z'),'2026-11-06');
 assert.equal(pickupDayKey('2026-11-05T21:30:00Z'),'2026-11-05');
 assert.equal(pickupDayKey('invalid'),null);
});
