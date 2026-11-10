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
  const [pulses,setPulses]=useState<Partial<Record<AttentionPage,number>>>({});
  const seq=useRef(0);
  const timers=useRef(new Map<AttentionPage,ReturnType<typeof setTimeout>>());
  const orderBaseline=useRef<Set<string>|null>(null);
  const stockBaseline=useRef<Set<string>|null>(null);
  const scopeRef=useRef<string|null>(null);
  const previousTab=useRef(activeTab);

  const stopPage=useCallback((page:AttentionPage)=>{
    const timer=timers.current.get(page);
    if(timer!==undefined){clearTimeout(timer);timers.current.delete(page);}
    setPulses(old=>{
      if(old[page]===undefined)return old;
      const next={...old};delete next[page];return next;
    });
  },[]);

  const pulseForTopic=useCallback((topic:MerchantNoticeTopic)=>{
    if(!scopeRef.current)return;
    const page=pageForMerchantNotice(topic);
    // Accessibility: keep the ordinary status badge, skip movement for users
    // who have asked their OS/browser to reduce motion.
    if(typeof window!=="undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
    const previous=timers.current.get(page);
    if(previous!==undefined)clearTimeout(previous);
    seq.current+=1;
    const nonce=seq.current;
    setPulses(old=>({...old,[page]:nonce}));
    const timer=setTimeout(()=>{
      timers.current.delete(page);
      setPulses(old=>{
        if(old[page]!==nonce)return old;
        const next={...old};delete next[page];return next;
      });
    },ANIMATION_MS);
    timers.current.set(page,timer);
  },[]);

  useEffect(()=>{
    scopeRef.current=scope;
    orderBaseline.current=null;
    stockBaseline.current=null;
    for(const timer of timers.current.values())clearTimeout(timer);
    timers.current.clear();
    setPulses({});
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
    if(last!==activeTab && activeTab in TOPIC_PAGE){
      // A navigation tap stops the attention movement. Underlying order/stock
      // counts remain authoritative and are not marked read merely by visiting.
      stopPage(activeTab as AttentionPage);
    }
  },[activeTab,stopPage]);

  useEffect(()=>()=>{for(const timer of timers.current.values())clearTimeout(timer);timers.current.clear();},[]);

  return {pulses,pulseForTopic};
}
