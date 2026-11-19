import test from 'node:test';import assert from 'node:assert/strict';
import {assertPickupReception} from './acceptancePolicy.js';import {OrderContractError} from './orderContract.js';
test('quote cannot promise ordering for a paused or unverified reception',()=>{
 delete process.env.PICKUP_ACCEPTANCE_ENABLED;assert.doesNotThrow(()=>assertPickupReception({}));
 process.env.PICKUP_ACCEPTANCE_ENABLED='true';
 assert.throws(()=>assertPickupReception({}),(e:unknown)=>e instanceof OrderContractError&&e.code==='ACCEPTANCE_UNAVAILABLE');
 assert.throws(()=>assertPickupReception({pickup_reception_paused:true}),(e:unknown)=>e instanceof OrderContractError&&e.code==='SHOP_RECEPTION_PAUSED');
 assert.doesNotThrow(()=>assertPickupReception({pickup_reception_paused:false}));
 delete process.env.PICKUP_ACCEPTANCE_ENABLED;
});
