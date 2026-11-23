import {isIsolatedCloudflareMerchantPitchPreviewEnabled} from "./cloudflareMerchantPitchGate";

// Honest, local-only demonstration. This is NOT Firebase Cloud Messaging/Web Push.
// The original dashboard, real notification service, and production backend are untouched.
export type DemoPermission = "granted"|"denied"|"default"|"unsupported";

export function createDemoAudioContext():AudioContext|null{
  if(!isIsolatedCloudflareMerchantPitchPreviewEnabled() || typeof window==="undefined")return null;
  try{
    const AudioCtor=window.AudioContext ||
      (window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!AudioCtor)return null;
    const context=new AudioCtor();
    // Called directly from the founder's Start/Simulate click: unlock once.
    void context.resume().catch(()=>{});
    return context;
  }catch{return null;}
}

export function playOriginalDemoArrivalChime(context:AudioContext|null):boolean{
  if(!isIsolatedCloudflareMerchantPitchPreviewEnabled() || !context || context.state==="closed")return false;
  try{
    // Original three-tone major arpeggio; gentle, short, and not borrowed music.
    const notes=[523.25,659.25,783.99];
    const time=context.currentTime;
    for(let i=0;i<notes.length;i++){
      const oscillator=context.createOscillator();
      const volume=context.createGain();
      const start=time+i*0.13;
      oscillator.type="sine";
      oscillator.frequency.setValueAtTime(notes[i],start);
      volume.gain.setValueAtTime(0.0001,start);
      volume.gain.exponentialRampToValueAtTime(0.029,start+0.025);
      volume.gain.exponentialRampToValueAtTime(0.0001,start+0.26);
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start+0.27);
    }
    return true;
  }catch{return false;}
}

export function localNotificationPermission():DemoPermission{
  if(!isIsolatedCloudflareMerchantPitchPreviewEnabled() || typeof window==="undefined" ||
     !("Notification" in window))return "unsupported";
  try{return Notification.permission;}catch{return "unsupported";}
}

export async function askForDemoBrowserNotificationPermission():Promise<DemoPermission>{
  // Only ever called from the explicit "Try demo alert" user click.
  if(!isIsolatedCloudflareMerchantPitchPreviewEnabled())return "unsupported";
  const current=localNotificationPermission();
  if(current!=="default")return current;
  try{return await Notification.requestPermission();}
  catch{return "unsupported";}
}

export function showLocalExampleOrderNotification(count:number):boolean{
  if(!isIsolatedCloudflareMerchantPitchPreviewEnabled() ||
    typeof document==="undefined" || document.visibilityState!=="visible" ||
    localNotificationPermission()!=="granted")return false;
  try{
    // Foreground/browser-only OS notification; DOES NOT work as a Web Push
    // subscription or when the mobile app/preview is closed.
    const n=new Notification("DEMO ONLY · New pickup order",{
      body:`${count} fictional pickup ${count===1?"order":"orders"} arrived. No customer placed a real order.`,
      tag:"localeats-demo-fictional-order",
      silent:true,
    });
    window.setTimeout(()=>n.close(),5000);
    return true;
  }catch{return false;}
}
