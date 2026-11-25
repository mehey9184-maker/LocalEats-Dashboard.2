/** In-memory read-only rate-limit deadline. Never retries a request or stores identity. */
export const DEFAULT_RETRY_AFTER_MS=60_000;
export function retryAfterMs(value:string|null,now:number):number {
 const raw=value?.trim()??"";
 if(/^\d+$/.test(raw)){
  const seconds=Number(raw);
  if(Number.isSafeInteger(seconds) && seconds>=0 && seconds<=Number.MAX_SAFE_INTEGER/1000)return Math.max(1000,seconds*1000);
  return DEFAULT_RETRY_AFTER_MS;
 }
 // HTTP-date, not arbitrary strings accepted by Date.parse.
 if(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(raw)){
  const at=Date.parse(raw);
  if(Number.isFinite(at))return Math.max(1000,at-now);
 }
 return DEFAULT_RETRY_AFTER_MS;
}
export function createReadBackoff(now:()=>number=Date.now){
 const until=new Map<string,number>();
 return {
  remaining(scope:string):number {return Math.max(0,(until.get(scope)??0)-now());},
  observe(scope:string,status:number,retryAfter:string|null):void {
   if(status!==429 && !(status===503 && retryAfter!==null))return;
   const at=now()+retryAfterMs(retryAfter,now());
   until.set(scope,Math.max(until.get(scope)??0,at));
  },
 };
}
