/** A bounded waiting budget, not cancellation of provider-side work.
 * Late resolutions/rejections are consumed by Promise.race. No later stage
 * begins after timeout; callers must treat a started send as uncertain.
 */
export class ProviderDeadlineError extends Error {
 constructor(){super("Provider response deadline exceeded.");this.name="ProviderDeadlineError";}
}
export function createProviderBudget(ms:number){
 let expired=false,closed=false;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const deadline=new Promise<never>((_,reject)=>{
  timer=setTimeout(()=>{expired=true;reject(new ProviderDeadlineError());},ms);
 });
 // The budget may be closed before the first step; consume rejection even then.
 void deadline.catch(()=>{});
 return {
  async run<T>(work:()=>Promise<T>):Promise<T>{
   if(expired||closed)throw new ProviderDeadlineError();
   return Promise.race([Promise.resolve().then(()=>{
    if(expired||closed)throw new ProviderDeadlineError();
    return work();
   }),deadline]);
  },
  close(){closed=true;clearTimeout(timer);}
 };
}
