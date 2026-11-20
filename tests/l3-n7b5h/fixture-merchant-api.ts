// L3-N7B5H: synthetic-only Merchant API. All reads are manually resolved by
// isolated Chromium; no auth tokens, Firebase, network or hosted writes.
import {auth} from "../l3-n6/fixture-auth";

type Row=Record<string,unknown>;
type PendingRead={owner:string|null;complete:(orders:Row[])=>void};
const reads:PendingRead[]=[];
const counters={readCalls:0,writeCalls:0};

const syntheticOrder=(owner:string):Row=>({
 id:`fake-pickup-${owner}`,
 shop_id:owner==="merchant-a"?"synthetic-shop-a":"synthetic-shop-b",
 user_id:"anonymous-synthetic-only",
 customer_name:`Synthetic ${owner}`,
 delivery_type:"collection",order_type:"collection",
 status:"pending",pickup_status:"pending",revision:0,payment_status:"unpaid",
 total_price:25,service_fee:0,delivery_fee:0,
 items:[{name:"Synthetic Kota",quantity:1,unit_price:25,line_total:25}],
 created_at:"2026-11-20T00:00:00Z",
 updated_at:"2026-11-20T00:00:00Z"
});

export const syntheticFixture={
 reads,
 counters,
 get outstanding(){return reads.map(r=>r.owner);},
 resolveOwner(owner:string){
  const index=reads.findIndex(r=>r.owner===owner);
  if(index<0)throw Error("No pending synthetic read for "+owner);
  const [request]=reads.splice(index,1);
  request.complete([syntheticOrder(owner)]);
 }
};
Object.assign(window,{l3n7b5hFixture:syntheticFixture});

export class MerchantApi {
 static async getOrders():Promise<Row[]>{
  counters.readCalls++;
  const owner=auth.currentUser?.uid??null;
  return new Promise<Row[]>(complete=>reads.push({owner,complete}));
 }
 static hasPendingPickupCommand(_order:Row){void _order;return false;}
 static async transitionPickupOrder(){
  counters.writeCalls++;
  throw Error("Real pickup mutations are forbidden in synthetic fixture");
 }
}
