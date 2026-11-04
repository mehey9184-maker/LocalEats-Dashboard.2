/**
 * A read-only, shop-scoped order refresh coordinator.
 *  - Coalesces overlapping manual/poll/focus/reconnect reads.
 *  - Ignores late success or failure after an account or shop change.
 *  - Never caches, writes, or fabricates merchant orders.
 */
export type MerchantOrderReadResult<T> =
  | {kind:"fresh";rows:T[]}
  | {kind:"failed";error:unknown}
  | {kind:"stale"};

export function createMerchantOrderReadCoordinator<T>() {
  let context:string|null=null;
  let generation=0;
  let inFlight:Promise<MerchantOrderReadResult<T>>|null=null;

  return {
    activate(nextContext:string|null):void {
      if(context===nextContext)return;
      context=nextContext;
      generation++;
      inFlight=null;
    },
    refresh(expectedContext:string,read:()=>Promise<T[]>):Promise<MerchantOrderReadResult<T>> {
      if(!expectedContext || context!==expectedContext) return Promise.resolve({kind:"stale"});
      if(inFlight)return inFlight;

      const ticket=generation;
      // Defer the call one microtask so inFlight is set before any resolution.
      const task:Promise<MerchantOrderReadResult<T>>=Promise.resolve().then(read).then(
        (rows):MerchantOrderReadResult<T>=>{
          if(generation!==ticket || context!==expectedContext)return {kind:"stale"};
          if(!Array.isArray(rows))return {kind:"failed",error:new Error("Order service returned an invalid list.")};
          return {kind:"fresh",rows};
        },
        (error):MerchantOrderReadResult<T>=>{
          if(generation!==ticket || context!==expectedContext)return {kind:"stale"};
          return {kind:"failed",error};
        }
      ).finally(()=>{
        if(inFlight===task)inFlight=null;
      });
      inFlight=task;
      return task;
    }
  };
}
