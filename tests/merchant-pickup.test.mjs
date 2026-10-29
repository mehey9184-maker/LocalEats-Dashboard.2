import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isPickupOrder,requireOwnedShop,pickupState,mapApiOrder,pickupCommand,pickupMutationsDisabled,pickupPaymentLabel} from '../src/services/merchantPickupPolicy.ts';
const order={id:'o',shop_id:'shop-string',delivery_type:'collection',status:'pending',payment_status:'unpaid',revision:0,total_price:25};
test('shop authority requires actual Firebase UID equality',()=>{
 assert.equal(requireOwnedShop({id:'s',owner_id:'u'},'u').id,'s');
 for(const uid of ['', 'other'])assert.throws(()=>requireOwnedShop({id:'s',owner_id:'u'},uid));
 assert.throws(()=>requireOwnedShop({id:'s'},'u'));
});
test('only persisted collection identifies pickup; historical unknown/delivery is not reclassified',()=>{
 assert.equal(isPickupOrder(order),true);assert.equal(isPickupOrder({order_type:'pickup'}),false);
 assert.equal(isPickupOrder({delivery_type:'delivery'}),false);
 const mapped=mapApiOrder({...order,status:'ready_for_pickup'});assert.equal(mapped.status,'ready');assert.equal(mapped.pickup_status,'ready_for_pickup');
 assert.throws(()=>mapApiOrder({...order,total_price:NaN}));
});
test('accept/ready commands preserve canonical status and concurrency contract',()=>{
 const accept=pickupCommand(order,'accept');assert.equal(accept.path,'accept');assert.equal(accept.body.expected_revision,0);
 assert.equal(pickupCommand({...order,status:'preparing',revision:1},'ready').path,'ready');
 assert.throws(()=>pickupCommand(order,'ready'));
 for(const status of ['cancelled','collected','unknown'])assert.throws(()=>pickupCommand({...order,status},'accept'));
 assert.throws(()=>pickupState({...order,payment_status:'paid'}));
});
test('independent payment and real handover required; no Collected-to-paid inference',()=>{
 const ready={...order,status:'ready_for_pickup',revision:2};
 assert.throws(()=>pickupCommand(ready,'collect',{handover_confirmed:true}));
 assert.equal(pickupCommand(ready,'confirm_payment',{payment_method:'card_machine'}).path,'payment-confirmation');
 assert.throws(()=>pickupCommand({...ready,payment_status:'paid'},'collect'));
 assert.equal(pickupCommand({...ready,payment_status:'paid'},'collect',{handover_confirmed:true}).path,'collect');
 assert.equal(pickupPaymentLabel({...ready,payment_method:'card_machine'}),'Unpaid · pay at shop');
 assert.equal(pickupPaymentLabel({...ready,payment_status:null}),'Payment status unavailable');
});
test('all pickup writes stop before transport and original entry is retained',()=>{
 let sent=false;assert.throws(()=>{pickupMutationsDisabled();sent=true;});assert.equal(sent,false);
 const service=readFileSync(new URL('../src/services/MerchantApi.ts',import.meta.url),'utf8');
 const start=service.indexOf('static async transitionPickupOrder');
 assert.ok(service.indexOf('pickupMutationsDisabled();',start)<service.indexOf('await fetch(',start));
 const entry=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');assert.match(entry,/import App from '.\/App.tsx'/);assert.doesNotMatch(entry,/PickupMerchantApp/);
 const workflow=readFileSync(new URL('../src/hooks/useOrderWorkflow.ts',import.meta.url),'utf8');assert.match(workflow,/Pickup orders cannot enter Rider dispatch/);
});

test('pickup rows with missing schema/state cannot be silently displayed as pending',()=>{
 assert.throws(()=>mapApiOrder({...order,revision:undefined}));
 assert.throws(()=>mapApiOrder({...order,status:'cancelled',payment_status:'paid'}));
});

test('command extras cannot override revision/identity and rejection needs a real reason',()=>{
 assert.throws(()=>pickupCommand(order,'accept',{expected_revision:99}));
 assert.throws(()=>pickupCommand(order,'reject'));
 assert.equal(pickupCommand(order,'reject',{reason:'Out of stock'}).body.expected_revision,0);
});
import {validateMerchantMenu,menuWritesUnavailable} from '../src/services/merchantMenuPolicy.ts';
test('authoritative menu rejects cross-shop and invalid prices, deduplicates real IDs',()=>{
 const item={id:'item',shop_id:'my-kota',name:'Kota',price:25,is_available:true};
 assert.deepEqual(validateMerchantMenu([item,item],'my-kota'),[item]);
 for(const row of [{...item,shop_id:'other'},{...item,price:NaN},{...item,price:-1}])assert.throws(()=>validateMerchantMenu([row],'my-kota'));
 assert.throws(()=>validateMerchantMenu([item,{...item,price:30}],'my-kota'));
 assert.equal(menuWritesUnavailable(),true);
});
test('historical payment method and completion never prove payment',()=>{
 for(const payment_method of ['online','card','cod','cash'])assert.equal(pickupPaymentLabel({payment_method,status:'completed'}),'Payment status unavailable');
 assert.equal(pickupPaymentLabel({payment_status:'paid',payment_method:'cash'}),'Paid');
 assert.equal(pickupPaymentLabel({payment_status:'unpaid',payment_method:'online'}),'Unpaid');
});
