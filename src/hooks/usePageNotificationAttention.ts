import {useCallback,useEffect,useRef,useState} from "react";
import type {Order,MenuItem} from "../types";

export type AttentionPage="orders"|"menu"|"riders"|"marketing"|"payments"|"settings";
export type MerchantNoticeTopic="new_order"|"inventory_low"|"rider"|"marketing"|"payment"|"settings";

const TOPIC_PAGE:Record<MerchantNoticeTopic,AttentionPage>={
  new_order:"orders",inventory_low:"menu",rider:"riders",
  marketing:"marketing",payment:"payments",settings:"settings"
};
export function pageForMerchantNotice(topic:MerchantNoticeTopic):AttentionPage {
  return TOPIC_PAGE[topic];
}

const ANIMATION_MS=1150;
type PulseState={
  scope:string|null;
  activeTab:string;
  pulses:Partial<Record<AttentionPage,number>>;
};
type VerifiedSignals={
  scope:string|null;
  ordersFresh:boolean;
  orders:Order[];
  menuFresh:boolean;
  menuItems:MenuItem[];
  activeTab:string;
};

/**
 * Visual navigation cue. Never creates/acknowledges notifications or changes
 * order/menu facts. Initial verified data is only a baseline; later new IDs
 * trigger a short wiggle. Refreshed data for a different shop cannot leak cues.
 */
export function usePageNotificationAttention({
  scope,ordersFresh,orders,menuFresh,menuItems,activeTab
}:VerifiedSignals){
  // Scope and navigation share one presentation state. Reset during the
  // component's own guarded render instead of synchronously in an effect:
  // no prior-shop wiggle or visited-page movement can paint.
  const [attention,setAttention]=useState<PulseState>(()=>({scope,activeTab,pulses:{}}));
  if(attention.scope!==scope || attention.activeTab!==activeTab){
    const next=attention.scope===scope?{...attention.pulses}:{};
    if(attention.scope===scope && attention.activeTab!==activeTab &&
       Object.values(TOPIC_PAGE).includes(activeTab as AttentionPage)){
      delete next[activeTab as AttentionPage];
    }
    setAttention({scope,activeTab,pulses:next});
  }
  const pulses=attention.scope===scope?attention.pulses:{};
  const seq=useRef(0);
  const timers=useRef(new Map<AttentionPage,ReturnType<typeof setTimeout>>());
  const orderBaseline=useRef<Set<string>|null>(null);
  const stockBaseline=useRef<Set<string>|null>(null);
  const scopeRef=useRef<string|null>(null);
  const previousTab=useRef(activeTab);

  const pulseForTopic=useCallback((topic:MerchantNoticeTopic)=>{
    // A callback captured for merchant A must never animate merchant B.
    if(!scope || scopeRef.current!==scope)return;
    const page=pageForMerchantNotice(topic);
    // Accessibility: keep the ordinary status badge, skip movement for users
    // who have asked their OS/browser to reduce motion.
    if(typeof window!=="undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
    const previous=timers.current.get(page);
    if(previous!==undefined)clearTimeout(previous);
    seq.current+=1;
    const nonce=seq.current;
    setAttention(old=>old.scope===scope
      ? {...old,pulses:{...old.pulses,[page]:nonce}} : old);
    const timer=setTimeout(()=>{
      // An older timer must not erase a newer pulse or a different shop.
      if(timers.current.get(page)!==timer)return;
      timers.current.delete(page);
      setAttention(old=>{
        if(old.scope!==scope || old.pulses[page]!==nonce)return old;
        const next={...old.pulses};delete next[page];
        return {...old,pulses:next};
      });
    },ANIMATION_MS);
    timers.current.set(page,timer);
  },[scope]);

  useEffect(()=>{
    scopeRef.current=scope;
    orderBaseline.current=null;
    stockBaseline.current=null;
    for(const timer of timers.current.values())clearTimeout(timer);
    timers.current.clear();
  },[scope]);

  useEffect(()=>{
    if(!scope||scopeRef.current!==scope||!ordersFresh)return;
    const pending=new Set(orders.filter(o=>o.status==="pending").map(o=>String(o.id)));
    const previous=orderBaseline.current;
    if(previous && [...pending].some(id=>!previous.has(id)))pulseForTopic("new_order");
    orderBaseline.current=pending;
  },[scope,ordersFresh,orders,pulseForTopic]);

  useEffect(()=>{
    if(!scope||scopeRef.current!==scope||!menuFresh)return;
    const lowStock=new Set(menuItems
      .filter(item=>typeof item.stock_quantity==="number" && item.stock_quantity<5)
      .map(item=>String(item.id)));
    const previous=stockBaseline.current;
    if(previous && [...lowStock].some(id=>!previous.has(id)))pulseForTopic("inventory_low");
    stockBaseline.current=lowStock;
  },[scope,menuFresh,menuItems,pulseForTopic]);

  useEffect(()=>{
    const last=previousTab.current;
    previousTab.current=activeTab;
    if(last!==activeTab && Object.values(TOPIC_PAGE).includes(activeTab as AttentionPage)){
      // A navigation tap stops the attention movement. Underlying order/stock
      // counts remain authoritative and are not marked read merely by visiting.
      const page=activeTab as AttentionPage;
      const timer=timers.current.get(page);
      if(timer!==undefined){clearTimeout(timer);timers.current.delete(page);}
    }
  },[activeTab]);

  useEffect(()=>()=>{for(const timer of timers.current.values())clearTimeout(timer);timers.current.clear();},[]);

  return {pulses,pulseForTopic};
}
