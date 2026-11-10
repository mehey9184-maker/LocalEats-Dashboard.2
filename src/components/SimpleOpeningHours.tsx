import React from "react";
import {CalendarClock,Info,MapPin,Store} from "lucide-react";
import type {Shop} from "../types";

/**
 * Settings S2: pickup-first owner-facing overview only. The old Settings
 * hours editor stored user metadata instead of an authoritative shop schedule.
 * Do not allow a falsely successful Save Hours action until the verified shop
 * API supports reading and writing these values safely.
 */
export function SimpleOpeningHours({
  shop,verified,onEditShop
}:{
  shop?:Shop;
  verified:boolean;
  onEditShop:()=>void;
}){
  const hasVerifiedShop=verified && !!shop;
  const available=hasVerifiedShop&&typeof shop?.is_active==="boolean";
  const status=available?(shop?.is_active?"Open":"Closed"):"Not verified";
  return <section data-testid="settings-s2-opening-hours" className="space-y-4">
    <h3 className="font-headline font-bold text-lg text-on-surface">Opening Hours</h3>
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 bg-primary/10 text-primary rounded-xl">
            <Store size={21} strokeWidth={2.2} aria-hidden="true"/>
          </span>
          <div>
            <h4 className="font-bold text-sm text-on-surface">Shop availability</h4>
            <p className="text-xs text-on-surface-variant">Current shop profile status</p>
          </div>
        </div>
        <span className="rounded-full border border-outline-variant/20 px-3 py-1.5 text-xs font-bold text-on-surface">{status}</span>
      </div>
      <p className="text-xs leading-5 text-on-surface-variant">
        {available
          ?"This is the shop's verified availability flag. It does not mean that real customer ordering has been activated."
          :"Shop status cannot be confirmed until your authenticated shop profile is verified."}
      </p>
    </div>
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-10 h-10 bg-primary/10 text-primary rounded-xl">
          <CalendarClock size={21} strokeWidth={2.2} aria-hidden="true"/>
        </span>
        <div>
          <h4 className="font-bold text-sm text-on-surface">Weekly opening hours</h4>
          <p className="text-xs text-on-surface-variant">Schedule awaiting verification</p>
        </div>
      </div>
      <div role="status" className="flex items-start gap-2 rounded-xl border border-outline-variant/15 bg-surface-container-high/40 p-3">
        <Info size={16} aria-hidden="true" className="shrink-0 mt-0.5 text-on-surface-variant"/>
        <p className="text-xs leading-5 text-on-surface-variant">
          The old hours form did not save to the verified shop schedule. Editing and automatic holiday scheduling are hidden until the LocalEats API can confirm changes. No hours or shop status will be changed from this page.
        </p>
      </div>
    </div>
    <button type="button" onClick={onEditShop}
      className="min-h-11 inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <MapPin size={17} aria-hidden="true"/> View shop profile and location
    </button>
  </section>;
}
