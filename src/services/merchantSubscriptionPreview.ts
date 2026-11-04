/** Owner-proposed subscription price display ONLY.
 * Not a billing product catalog, entitlement contract or payment schedule.
 */
export const MERCHANT_SUBSCRIPTION_FREE_MONTHS=3 as const;
export const MERCHANT_SUBSCRIPTION_PLANS=[
  {id:"plus",name:"Plus",monthlyRand:199},
  {id:"pro",name:"Pro",monthlyRand:399},
  {id:"premium",name:"Premium",monthlyRand:499},
] as const;
export function merchantSubscriptionsNotActivated():true {return true;}
export function merchantSubscriptionPriceLabel(value:number):string {
  return Number.isSafeInteger(value) && value>=0 ? `R${value}` : "Price unavailable";
}
/** Merchants must have an independently verified shop go-live date and
 * explicit consent before any real countdown, plan selection or invoice.
 */
export const MERCHANT_SUBSCRIPTION_START_POLICY="Three free calendar months per shop after verified trading activation; no billing while in testing." as const;
