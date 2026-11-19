import {useCallback,useEffect,useRef,useState} from 'react';
import {auth} from '../lib/firebase';
import {pickupReception,type Reception} from '../services/pickupReception';
import {pickupOrderingEnabled} from '../services/merchantPickupPolicy';
export function PickupReception({shopId,ownerId}:{shopId?:string|number;ownerId?:string}){
 const [state,setState]=useState<Reception|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [stateScope,setStateScope]=useState('');
 const generation=useRef(0);
 const enabled=import.meta.env.VITE_PICKUP_ACCEPTANCE_ENABLED==='true';
 const load=useCallback(async(resume?:number)=>{
  const current=++generation.current;const uid=auth.currentUser?.uid;
  if(!enabled||!shopId||!uid||uid!==ownerId){setState(null);setBusy(false);return;}
  setBusy(true);setError('');
  const controller=new AbortController();let deadline:ReturnType<typeof setTimeout>|undefined;
  try{
   const next=await Promise.race([pickupReception(String(shopId),resume,controller.signal),new Promise<never>((_resolve,reject)=>{
    deadline=setTimeout(()=>{controller.abort();reject(Error('Reception request timed out'));},15000);
   })]);
   if(current===generation.current&&auth.currentUser?.uid===uid){setState(next);setStateScope(`${shopId}:${uid}`);}
  }catch{if(current===generation.current){setState(null);setError('Couldn’t verify order reception. Refresh before receiving new orders.');}}
  finally{clearTimeout(deadline);if(current===generation.current)setBusy(false);}
 },[enabled,shopId,ownerId]);
 useEffect(()=>{void load();const invalidate=()=>{generation.current++;};return invalidate;},[load]);
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==='visible')void load();};
  window.addEventListener('focus',refresh);window.addEventListener('localeats-reception-update',refresh);
  const timer=enabled?setInterval(refresh,60000):undefined;
  return ()=>{clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('localeats-reception-update',refresh);};
 },[load,enabled]);
 if(!enabled||!shopId||!ownerId||auth.currentUser?.uid!==ownerId)return null;
 const verified=stateScope===`${shopId}:${ownerId}`?state:null;
 return <section aria-label="Pickup order reception" className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 space-y-2">
  <h3 className="font-bold">{verified?.paused?'New orders paused':verified?'Order reception available':'Checking order reception'}</h3>
  <p role="status" className="text-sm text-on-surface-variant">{error||(!verified?'Checking the shop service…':verified.paused?'Two orders weren’t accepted in time. Resume when someone can respond within five minutes.':'Opening hours and approval still apply. Pending orders must be accepted within five minutes.')}</p>
  {!!verified?.reminders&&<p role="status" className="text-sm font-bold">{verified.reminders} pending request{verified.reminders===1?' needs':'s need'} a response. Check your pending orders before their acceptance deadlines.</p>}
  <div className="flex flex-wrap gap-2">
   {verified?.paused&&<button type="button" disabled={busy||!pickupOrderingEnabled()} onClick={()=>void load(verified.revision)} className="min-h-[44px] px-4 rounded-xl bg-primary text-on-primary font-bold disabled:opacity-50">{busy?'Confirming…':'Start receiving orders'}</button>}
   <button type="button" disabled={busy} onClick={()=>void load()} className="min-h-[44px] px-4 rounded-xl border border-outline-variant disabled:opacity-50">{busy?'Checking…':'Refresh reception'}</button>
  </div>
 </section>;
}
