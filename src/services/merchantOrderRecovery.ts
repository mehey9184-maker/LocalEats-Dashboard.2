/** Read-only, scope-generation guarded coordinator. Ordinary polling coalesces.
 * A wake during a primary read may reserve one trailing reconciliation;
 * wakes during the trailing read coalesce, never create an unbounded chain.
 */
export type MerchantOrderReadResult<T> =
  | {kind:"fresh";rows:T[]}
  | {kind:"failed";error:unknown}
  | {kind:"stale"};
type ReadOptions={wake?:boolean;canFollowup?:()=>boolean};
type Flight<T>={promise:Promise<MerchantOrderReadResult<T>>;controller:AbortController;trailing:boolean;queued?:Promise<MerchantOrderReadResult<T>>};
export function createMerchantOrderReadCoordinator<T>() {
  let context:string|null=null;
  let generation=0;
  let inFlight:Flight<T>|null=null;
  const stale=():MerchantOrderReadResult<T>=>({kind:"stale"});
  const start=(expectedContext:string,read:(signal:AbortSignal)=>Promise<T[]>,trailing=false):Flight<T>=>{
    const ticket=generation,controller=new AbortController();
    const current=()=>generation===ticket && context===expectedContext && !controller.signal.aborted;
    const flight:Flight<T>={controller,trailing,promise:Promise.resolve(stale())};
    flight.promise=Promise.resolve().then(()=>{
      if(!current())return [];
      return read(controller.signal);
    }).then((rows):MerchantOrderReadResult<T>=>{
      if(!current())return stale();
      if(!Array.isArray(rows))return {kind:"failed",error:new Error("Order service returned an invalid list.")};
      return {kind:"fresh",rows};
    },(error):MerchantOrderReadResult<T>=>current()?{kind:"failed",error}:stale()).finally(()=>{
      if(inFlight===flight)inFlight=null;
    });
    inFlight=flight;
    return flight;
  };
  return {
    activate(nextContext:string|null):void {
      if(context===nextContext)return;
      context=nextContext;
      generation++;
      inFlight?.controller.abort();
      inFlight=null;
    },
    refresh(expectedContext:string,read:(signal:AbortSignal)=>Promise<T[]>,options:ReadOptions={}):Promise<MerchantOrderReadResult<T>> {
      if(!expectedContext || context!==expectedContext)return Promise.resolve(stale());
      if(!inFlight)return start(expectedContext,read).promise;
      const flight=inFlight;
      if(!options.wake || flight.trailing)return flight.promise;
      if(flight.queued)return flight.queued;
      const ticket=generation;
      flight.queued=flight.promise.then(()=>{
        if(ticket!==generation || context!==expectedContext || (options.canFollowup && !options.canFollowup()))return stale();
        if(inFlight)return inFlight.promise;
        return start(expectedContext,read,true).promise;
      });
      return flight.queued;
    }
  };
}
