import {useState,useCallback,useEffect,useRef} from "react";
import {toast} from "sonner";
import {onAuthStateChanged} from "firebase/auth";
import type {SupabaseClient} from "@supabase/supabase-js";
import {auth,requestNotificationPermissionAndGetToken} from "../lib/firebase";
import {MerchantApi} from "../services/MerchantApi";

export type RoleType="rider"|"client"|"merchant";
interface PushNotificationHook {
  pushEnabled:boolean;
  pushBusy:boolean;
  requestPushPermissions:(userId:string|undefined,role:RoleType,supabaseClient:SupabaseClient)=>Promise<void>;
  disablePushNotifications:()=>Promise<void>;
  urlBase64ToUint8Array:(base64String:string)=>Uint8Array;
}
const INSTALL_PREFIX="localeats-merchant-push-installation:";
const VALID_INSTALLATION=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const installationKey=(uid:string)=>INSTALL_PREFIX+uid;

/**
 * Web push registration is a server-acknowledged, account-scoped state:
 * - permission granted does not imply server registration
 * - only a stored, previously acknowledged installation is auto-revalidated
 * - switching Firebase users invalidates prior UI status immediately
 * - disabling requires the API to revoke the installation before reporting off
 * - no browser permission is requested in background or on a timer
 * The verified API orders inbox remains authoritative if FCM is unavailable.
 */
export const usePushNotifications=(initialState=false):PushNotificationHook=>{
  const [pushEnabled,setPushEnabled]=useState(initialState);
  const [pushBusy,setPushBusy]=useState(false);
  const sequence=useRef(0);
  const inFlight=useRef(false);

  const urlBase64ToUint8Array=useCallback((base64String:string):Uint8Array=>{
    const padding="=".repeat((4-base64String.length%4)%4);
    const raw=window.atob((base64String+padding).replace(/-/g,"+").replace(/_/g,"/"));
    return Uint8Array.from(raw,c=>c.charCodeAt(0));
  },[]);

  const canUsePush=()=>typeof window!=="undefined" &&
    "Notification" in window && "serviceWorker" in navigator &&
    window.isSecureContext && Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY);

  const revalidate=useCallback(async(uid:string,epoch:number)=>{
    if(inFlight.current || !canUsePush())return;
    if(Notification.permission!=="granted"){
      setPushEnabled(false);
      return;
    }
    const existing=localStorage.getItem(installationKey(uid));
    if(!existing || !VALID_INSTALLATION.test(existing))return;
    inFlight.current=true;
    try {
      const token=await requestNotificationPermissionAndGetToken();
      if(!token || auth.currentUser?.uid!==uid || sequence.current!==epoch)return;
      const confirmed=await MerchantApi.registerPushDevice(existing,token);
      if(sequence.current===epoch && auth.currentUser?.uid===uid) setPushEnabled(confirmed);
    }catch{
      if(sequence.current===epoch)setPushEnabled(false);
    }finally{inFlight.current=false;}
  },[]);

  useEffect(()=>{
    const unsubscribe=onAuthStateChanged(auth,user=>{
      const epoch=++sequence.current;
      setPushEnabled(false);
      const uid=user?.uid;
      if(uid)void revalidate(uid,epoch);
    });
    // Foreground recovery rechecks existing consent/token after long periods
    // offline; it never silently opts-in an unregistered account.
    const refresh=()=>{
      const uid=auth.currentUser?.uid;
      if(uid && document.visibilityState==="visible")void revalidate(uid,sequence.current);
    };
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",refresh);
    return()=>{
      ++sequence.current;
      unsubscribe();
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",refresh);
    };
  },[revalidate]);

  const requestPushPermissions=useCallback(async(
    userId:string|undefined,role:RoleType,_supabaseClient:SupabaseClient
  )=>{
    if(inFlight.current)return;
    if(role!=="merchant"){
      toast.info("Background pickup push is only available to verified shop owners in this pilot.");
      return;
    }
    if(!userId || userId!==auth.currentUser?.uid){
      toast.error("Sign in to your verified merchant account before enabling notifications.");
      return;
    }
    if(!canUsePush()){
      toast.error("This browser or LocalEats Web Push configuration is unavailable. Keep Orders open.");
      return;
    }
    inFlight.current=true;
    setPushBusy(true);
    setPushEnabled(false);
    const epoch=sequence.current;
    try{
      const token=await requestNotificationPermissionAndGetToken();
      if(!token){
        toast.error("Browser notification permission or device registration failed. Orders still refresh in-app.");
        return;
      }
      if(auth.currentUser?.uid!==userId || sequence.current!==epoch)return;
      const key=installationKey(userId);
      const old=localStorage.getItem(key);
      const installation=old && VALID_INSTALLATION.test(old) ? old : crypto.randomUUID();
      const saved=await MerchantApi.registerPushDevice(installation,token);
      if(auth.currentUser?.uid!==userId || sequence.current!==epoch)return;
      if(!saved){
        toast.error("LocalEats could not confirm this device. Orders still refresh in-app.");
        return;
      }
      localStorage.setItem(key,installation);
      setPushEnabled(true);
      toast.success("Merchant device registered. Browser delivery still depends on network and system permissions.");
    }catch{
      toast.error("Could not register this device. Keep Orders open for verified updates.");
    }finally{
      inFlight.current=false;
      setPushBusy(false);
    }
  },[]);

  const disablePushNotifications=useCallback(async()=>{
    if(inFlight.current)return;
    const uid=auth.currentUser?.uid;
    if(!uid){setPushEnabled(false);return;}
    const key=installationKey(uid),installation=localStorage.getItem(key);
    if(!installation || !VALID_INSTALLATION.test(installation)){
      localStorage.removeItem(key);
      setPushEnabled(false);
      return;
    }
    inFlight.current=true;
    setPushBusy(true);
    const epoch=sequence.current;
    try{
      const revoked=await MerchantApi.unregisterPushDevice(installation);
      if(auth.currentUser?.uid!==uid || sequence.current!==epoch)return;
      if(!revoked){
        toast.error("Could not confirm push was disabled on the server. Retry while connected.");
        return;
      }
      localStorage.removeItem(key);
      setPushEnabled(false);
      toast.success("LocalEats push notifications disabled for this merchant device.");
    }catch{
      toast.error("The server could not confirm device removal. Retry to disable.");
    }finally{
      inFlight.current=false;
      setPushBusy(false);
    }
  },[]);

  return {pushEnabled,pushBusy,requestPushPermissions,disablePushNotifications,urlBase64ToUint8Array};
};
