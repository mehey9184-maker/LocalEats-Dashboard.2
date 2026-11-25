import {auth} from "../lib/firebase";

let generation=0;
let observedUid=auth.currentUser?.uid;
auth.beforeAuthStateChanged?.(()=>{generation++;});
auth.onAuthStateChanged?.(user=>{if(user?.uid!==observedUid){observedUid=user?.uid;generation++;}});
export function captureMerchantReadSession(){
 const uid=auth.currentUser?.uid, ticket=generation;
 return {uid,current:()=>!!uid && auth.currentUser?.uid===uid && ticket===generation};
}

// Bounds token acquisition, fetch, and response parsing. Abort cannot undo a
// request already delivered; all operations using this helper are GET only.
export async function boundedMerchantRead<T>(
 work:(signal:AbortSignal,check:()=>void,uid:string)=>Promise<T>,
 session:ReturnType<typeof captureMerchantReadSession>,outer?:AbortSignal,timeoutMs=15000,
):Promise<T>{
 const controller=new AbortController();
 let timer:ReturnType<typeof setTimeout>|undefined;
 const stop=()=>controller.abort(outer?.reason ?? Error("Merchant read cancelled."));
 const check=()=>{
  controller.signal.throwIfAborted();
  if(!session.uid || !session.current())throw Error("Your merchant session changed. Refresh in your account.");
 };
 const aborted=new Promise<never>((_,reject)=>{
  controller.signal.addEventListener("abort",()=>reject(controller.signal.reason),{once:true});
 });
 try{
  if(outer?.aborted)stop();else outer?.addEventListener("abort",stop,{once:true});
  timer=setTimeout(()=>controller.abort(Error("Merchant read timed out. Retry verification.")),timeoutMs);
  const operation=Promise.resolve().then(()=>{check();return work(controller.signal,check,session.uid!);});
  const result=await Promise.race([operation,aborted]);
  check();return result;
 }finally{clearTimeout(timer);outer?.removeEventListener("abort",stop);}
}
