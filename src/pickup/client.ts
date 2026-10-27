export type PickupOrder = {id:string;shop_id:string;user_id:string;status:string;delivery_type:string;delivery_status:string;
 payment_status:string;payment_method:string;revision:number;customer_name:string;phone:string;total_price:number;
 items:{menu_item_id:string;name:string;quantity:number;unit_price:number;line_total:number}[];created_at:string};
export type Location = {lat:number;lng:number};
export class PickupApiError extends Error {
 status:number; code:string;
 constructor(status:number,code:string,message:string) {super(message);this.status=status;this.code=code;}
}
export type PickupQuote={lines:{menu_item_id:string;name:string;quantity:number;unit_minor:number;line_minor:number}[];total_minor:number;service_fee_minor:number;subtotal_minor:number;pricing_fingerprint:string};
type ApiResponse={success?:boolean;code?:string;error?:string;order?:PickupOrder;replayed?:boolean;orders?:PickupOrder[];
 shops?:{id:string;name:string;location:string;distance_km:number}[];
 menu_items?:{id:string;name:string;price:number;is_available:boolean}[];quote?:PickupQuote;
 notifications?:{id:string;order_id:string}[];events?:{id:string;kind:string;occurred_at:string;details?:{reason?:string}}[]};
export function createPickupApi(baseUrl:string,token:()=>Promise<string>,transport:typeof fetch=fetch) {
 const request=async(path:string,method="GET",body?:unknown,publicRead=false):Promise<ApiResponse>=>{
   const bearer=publicRead ? "" : await token();
   if(!publicRead && !bearer) throw new PickupApiError(401,"UNAUTHORIZED","Sign in again to continue.");
   let response:Response;
   try {response=await transport(baseUrl.replace(/\/$/,"")+path,{method,cache:"no-store",
     headers:{"Content-Type":"application/json",...(bearer ? {Authorization:"Bearer fb-"+bearer} : {})},
     ...(body===undefined ? {} : {body:JSON.stringify(body)})});}
   catch {throw new PickupApiError(0,"CONNECTION_LOST","Connection lost. The outcome may be unknown. Retry the same request.");}
   let result:ApiResponse;
   try {result=await response.json();} catch {throw new PickupApiError(response.status,"INVALID_RESPONSE","The service returned an invalid response.");}
   if(!response.ok || result?.success!==true) throw new PickupApiError(response.status,result?.code ?? "REQUEST_FAILED",result?.error ?? "Request failed.");
   return result;
 };
 return {
  shops:(location:Location)=>request("/api/v1/catalog/pickup-shops?lat="+location.lat+"&lng="+location.lng,"GET",undefined,true),
  menu:(id:string)=>request("/api/v1/catalog/shops/"+encodeURIComponent(id)+"/menu","GET",undefined,true),
  quote:(intent:unknown)=>request("/api/v1/orders/quote","POST",intent),
  create:async(intent:unknown):Promise<{order:PickupOrder;replayed:boolean}>=>{
    const result=await request("/api/v1/orders","POST",intent);
    if(!result.order?.id || typeof result.replayed!=="boolean") throw new PickupApiError(503,"UNCONFIRMED","Order persistence is unconfirmed. Retry the same request.");
    return {order:result.order,replayed:result.replayed};
  },
  orders:(merchant=false)=>request(merchant ? "/api/v1/merchant/orders" : "/api/v1/orders"),
  order:(id:string)=>request("/api/v1/orders/"+encodeURIComponent(id)),
  command:(id:string,action:string,payload:unknown,merchant=true)=>request((merchant ? "/api/v1/merchant/orders" : "/api/v1/orders")+"/"+encodeURIComponent(id)+"/"+action,"POST",payload),
  notifications:()=>request("/api/v1/notifications"),
  subscribe:(id:string,fcm_token:string)=>request("/api/v1/push-subscriptions/"+id,"PUT",{fcm_token,permission_granted:true}),
  revoke:(id:string)=>request("/api/v1/push-subscriptions/"+id,"DELETE"),
 };
}
export const pickupStatus=(order:PickupOrder,events:{kind:string}[]=[])=>{
 if(order.status==="cancelled") return events.some(e=>e.kind==="merchant_rejected") ? "Rejected" : "Cancelled";
 return ({pending:"Pending",preparing:"Preparing",ready_for_pickup:"Ready for pickup",collected:"Collected / Completed"} as Record<string,string>)[order.status] ?? "Status unavailable";
};
