import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readCompleteMerchantInbox, MERCHANT_UNFINISHED_FILTER, MERCHANT_INBOX_PAGE_SIZE,
  MERCHANT_INBOX_MAX_OPEN } from "./merchantInboxRead.js";
import type { StoredOrder } from "./orderService.js";

const fake=(i:number,shop_id="shop-1",status="pending"):StoredOrder=>({
  id:String(i).padStart(8,"0"),
  shop_id,user_id:"synthetic-customer",rider_id:null,status,delivery_status:"none",
  payment_method:"cash",price:25,total_price:27.5,delivery_fee:0,service_fee:2.5,
  discount_amount:0,tip_amount:0,items:[],lat:null,lng:null,
  created_at:new Date(Date.UTC(2026,10,5,0,i%60,Math.floor(i/60))).toISOString()
});
const source=(recent:StoredOrder[],unfinished:StoredOrder[])=>{
 const pages:Array<[number,number]>=[];
 return {
  pages,
  recent:async()=>recent,
  unfinishedPage:async(start:number,end:number)=>{
    pages.push([start,end]);return unfinished.slice(start,end+1);
  }
 };
};

test("250 newest completed orders never hide an older unresolved order",async()=>{
 const finished=Array.from({length:250},(_,i)=>fake(i+1,"shop-1","collected"));
 const unresolved=fake(9999,"shop-1","pending");
 const query=source(finished,[unresolved]);
 const result=await readCompleteMerchantInbox(query,["shop-1"]);
 assert.equal(result.length,251);
 assert.ok(result.find(x=>x.id===unresolved.id));
 assert.deepEqual(query.pages,[[0,249]]);
});

test("unfinished rows take precedence over earlier history copy, no duplicate",async()=>{
 const previous=fake(1,"shop-1","preparing");
 const updated={...previous,status:"ready_for_pickup"};
 const result=await readCompleteMerchantInbox(source([previous],[updated]),["shop-1"]);
 assert.equal(result.length,1);
 assert.equal(result[0]?.status,"ready_for_pickup");
});

test("paginates more than one page of open orders, with a one-row overflow sentinel",async()=>{
 const open=Array.from({length:601},(_,i)=>fake(i,"shop-1",i%2?"pending":"preparing"));
 const q=source(open.slice(0,250),open);
 const rows=await readCompleteMerchantInbox(q,["shop-1"]);
 assert.equal(rows.length,601);
 assert.deepEqual(q.pages,[[0,249],[250,499],[500,749]]);
});

test("1000 active orders are permitted, but 1001 is a fail-closed hard limit",async()=>{
 const exactly=Array.from({length:MERCHANT_INBOX_MAX_OPEN},(_,i)=>fake(i));
 const q=source([],exactly);
 assert.equal((await readCompleteMerchantInbox(q,["shop-1"])).length,1000);
 assert.deepEqual(q.pages.at(-1),[1000,1000]);
 const exceeded=source([],Array.from({length:1001},(_,i)=>fake(i)));
 await assert.rejects(()=>readCompleteMerchantInbox(exceeded,["shop-1"]),error=>
   (error as {code?:string})?.code==="MERCHANT_INBOX_CAPACITY_REVIEW");
});

test("a transient failure in any unfinished page never returns a partial inbox",async()=>{
 const q={
  recent:async()=>Array.from({length:250},(_,i)=>fake(i, "shop-1","delivered")),
  unfinishedPage:async(start:number)=> {
    if(start===0)return Array.from({length:MERCHANT_INBOX_PAGE_SIZE},(_,i)=>fake(i,"shop-1","preparing"));
    throw Error("Simulated Supabase outage during page 2");
  }
 };
 await assert.rejects(()=>readCompleteMerchantInbox(q,["shop-1"]),/Simulated Supabase outage/);
});

test("rejects missing verified shop scope and upstream cross-shop leaked rows",async()=>{
 await assert.rejects(()=>readCompleteMerchantInbox(source([],[]),[]),error=>
   (error as {code?:string})?.code==="MERCHANT_INBOX_SCOPE_ERROR");
 const notOwned=source([fake(1,"shop-other")],[]);
 await assert.rejects(()=>readCompleteMerchantInbox(notOwned,["shop-1"]),error=>
   (error as {code?:string})?.code==="MERCHANT_INBOX_SCOPE_ERROR");
 const pendingCrossShop=source([],[fake(1,"shop-other")]);
 await assert.rejects(()=>readCompleteMerchantInbox(pendingCrossShop,["shop-1"]),error=>
   (error as {code?:string})?.code==="MERCHANT_INBOX_SCOPE_ERROR");
});

test("rejects malformed or truncated API pages and protects against silent empty inbox",async()=>{
 const q=source([],[]);
 const bad={...q,recent:async()=>null as unknown as StoredOrder[]};
 await assert.rejects(()=>readCompleteMerchantInbox(bad,["shop-1"]),error=>
   (error as {code?:string})?.code==="MERCHANT_INBOX_INCOMPLETE");
 const tooLong=source(Array.from({length:251},(_,i)=>fake(i)),[]);
 await assert.rejects(()=>readCompleteMerchantInbox(tooLong,["shop-1"]),error=>
   (error as {code?:string})?.code==="MERCHANT_INBOX_INCOMPLETE");
});

test("read-only merchant HTTP handler validates ownership, scoping and pages before JSON response",()=>{
 const handler=readFileSync(new URL("../routes/orders.ts",import.meta.url),"utf8");
 assert.match(handler,/authenticateFirebase/);
 assert.match(handler,/\.eq\("owner_id", uid\)/);
 assert.match(handler,/\.is\("archived_at", null\)/);
 assert.match(handler,/readCompleteMerchantInbox\(/);
 assert.match(handler,/\.in\("shop_id", shopIds\)/);
 assert.match(handler,/\.or\(MERCHANT_UNFINISHED_FILTER\)/);
 assert.match(handler,/\.range\(start, end\)/);
 assert.match(handler,/orders: orders\.map\(\(order\) => withoutDeliveryProofState\(order\)\)/);
 assert.match(handler,/if \(error \|\| !data\) throw new OrderContractError/);
 assert.equal(MERCHANT_UNFINISHED_FILTER,
   "status.is.null,status.not.in.(cancelled,collected,delivered,completed)");
 assert.doesNotMatch(handler,/create.*merchant.*notification/i);
});
