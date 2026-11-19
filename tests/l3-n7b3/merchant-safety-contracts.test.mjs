import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('Legacy profile bridge refuses false success without an approved server save',()=>{
 const adapter=source('src/lib/supabase.ts');
 const start=adapter.indexOf('async updateUser(');
 assert.notEqual(start,-1);
 const block=adapter.slice(start,start+740);
 assert.match(block,/data:\s*\{user:\s*null\}/);
 assert.match(block,/error:\s*new Error/);
 assert.doesNotMatch(block,/error:\s*null/);
});
test('Unapproved terminal settings cannot write shops or advertise real integration',()=>{
 const app=source('src/App.tsx');
 const start=app.indexOf('{/* Direct Terminal Integration */}');
 const end=app.indexOf('{/* Auto-Accept Orders */}',start);
 assert(start>-1&&end>start);
 const terminal=app.slice(start,end);
 assert.match(terminal,/Card-terminal integration is not enabled/);
 assert.match(terminal,/disabled/);
 for(const field of ['require_terminal_sync','terminal_provider','terminal_serial']){
  assert.doesNotMatch(terminal,new RegExp('\\b'+field+'\\b'));
 }
 assert.doesNotMatch(terminal,/supabase\.from|updateFirestoreShop|MerchantApi\./);
});
test('Receipt retry passes the actual queued job, never a mismatched ID',()=>{
 const orders=source('src/components/OrdersManagement.tsx');
 assert.match(orders,/retryQueuedPrintDirect\?: \(job: QueuedPrintJob\) => Promise<void>/);
 assert.match(orders,/retryQueuedPrintDirect\?\.\(job\)/);
 assert.doesNotMatch(orders,/retryQueuedPrintDirect\?\.\(job\.id\)/);
});
test('Foreground push only removes a callable unsubscribe',()=>{
 const app=source('src/App.tsx');
 assert.match(app,/unsubscribe=typeof fn==="function"\?fn:undefined/);
});
test('Shop availability calls do not pass the unused legacy client-side write adapter',()=>{
 const app=source('src/App.tsx');
 for(const match of app.matchAll(/syncShopAvailability\(\{/g)){
  const stop=app.indexOf('});',match.index);
  const fragment=app.slice(match.index,stop<0?match.index+450:stop);
  assert.doesNotMatch(fragment,/updateFirestoreShop|\bsupabase\s*,/);
 }
});
