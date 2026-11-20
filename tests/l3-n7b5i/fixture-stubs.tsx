// L3-N7B5I Home visual fixture: synthetic data only, no external transport.
import React,{useCallback} from "react";
import {UtensilsCrossed} from "lucide-react";
export const observed={tables:[] as string[],writes:0,subscriptions:0};
type Empty={count:number;data:never[];error:null};
const empty:Promise<Empty>=Promise.resolve({count:0,data:[],error:null});
const chain={
 select(){return chain;},eq(){return chain;},gt(){return chain;},
 in(){return chain;},order(){return chain;},limit(){return chain;},
 then:empty.then.bind(empty)
};
export const supabase={
 from(table:string){
  observed.tables.push(table);
  if(table!=="shop_followers")throw Error("Home tried a non-follower database: "+table);
  return chain;
 },
 removeChannel:async()=>{},
 channel:()=>{observed.subscriptions++;throw Error("Live realtime channels must not initialize");}
};
export function useAuthGuard(){
 const subscribeWithAuthGuard=useCallback(async()=>null,[]);
 return {subscribeWithAuthGuard};
}
export async function syncShopAvailability(){
 observed.writes++;
 throw Error("Synthetic Home refuses all hosted availability changes");
}
export const FoodPlaceholder=({size=48}:{size?:number})=>
 <div className="w-full h-full bg-surface-container flex flex-col items-center justify-center text-on-surface-variant/40">
  <UtensilsCrossed size={size}/>
 </div>;
Object.assign(window,{l3n7b5iObserved:observed});
