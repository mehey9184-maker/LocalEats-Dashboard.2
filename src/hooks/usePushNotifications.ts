import {useState,useCallback,useEffect} from "react";
import {toast} from "sonner";
import {onAuthStateChanged} from "firebase/auth";
import type {SupabaseClient} from "@supabase/supabase-js";
import {auth,requestNotificationPermissionAndGetToken} from "../lib/firebase";
import {MerchantApi} from "../services/MerchantApi";

export type RoleType="rider"|"client"|"merchant";
interface PushNotificationHook {
  pushEnabled:boolean;
  requestPushPermissions:(userId:string|undefined,role:RoleType,supabaseClient:SupabaseClient)=>Promise<void>;
  urlBase64ToUint8Array:(base64String:string)=>Uint8Array;
}

/**
 * Merchant FCM registration. The server must acknowledge the subscription:
 * OS permission alone is not evidence that an owner will receive new orders.
 * No direct Supabase writes or generic WebPush subscription are allowed here.
 */
export const usePushNotifications=(initialState=false):PushNotificationHook=>{
  const [pushEnabled,setPushEnabled]=useState(initialState);
  useEffect(()=>onAuthStateChanged(auth,()=>setPushEnabled(false)),[]);

  const urlBase64ToUint8Array=useCallback((base64String:string):Uint8Array=>{
    const padding="=".repeat((4-base64String.length%4)%4);
    const raw=window.atob((base64String+padding).replace(/-/g,"+").replace(/_/g,"/"));
    return Uint8Array.from(raw,c=>c.charCodeAt(0));
  },[]);

  const requestPushPermissions=useCallback(async(
    userId:string|undefined,role:RoleType,_supabaseClient:SupabaseClient
  )=>{
    setPushEnabled(false);
    if(role!=="merchant"){
      toast.info("Background pickup push is only available to verified shop owners in this pilot.");
      return;
    }
    if(!userId || userId!==auth.currentUser?.uid){
      toast.error("Sign in to your verified merchant account before enabling notifications.");
      return;
    }
    if(typeof window==="undefined" || !("Notification" in window) ||
       !("serviceWorker" in navigator) || !window.isSecureContext){
      toast.error("This browser cannot receive secure background notifications.");
      return;
    }
    if(!import.meta.env.VITE_FIREBASE_VAPID_KEY){
      toast.error("Web Push certificate is not configured yet. Keep the Orders page open.");
      return;
    }
    try{
      const token=await requestNotificationPermissionAndGetToken();
      if(!token){
        toast.error("Notification permission or device registration failed. Orders still refresh in-app.");
        return;
      }
      const key="localeats-merchant-push-installation:"+userId;
      const previous=localStorage.getItem(key);
      const installation=previous && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(previous)
        ? previous : crypto.randomUUID();
      if(!previous || previous!==installation)localStorage.setItem(key,installation);
      const saved=await MerchantApi.registerPushDevice(installation,token);
      if(!saved || auth.currentUser?.uid!==userId){
        toast.error("Your device was not registered with LocalEats. Orders still refresh in-app.");
        return;
      }
      setPushEnabled(true);
      toast.success("This merchant device is registered for pickup notifications.");
    }catch{
      toast.error("Could not connect push notifications. Keep Orders open for live updates.");
    }
  },[]);
  return {pushEnabled,requestPushPermissions,urlBase64ToUint8Array};
};
