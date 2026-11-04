/** Proposed LocalEats merchant plans, for display in Merchant Preview only.
 * This is NOT an entitlement, subscription, pricing or payment API.
 * Tier features require separate product and owner approval.
 */
export const MERCHANT_FREE_MONTHS=3 as const;
export const PROPOSED_MERCHANT_PLANS=[
  {
    id:"plus",label:"Plus",monthlyPriceZar:199,
    headline:"Essential shop operations",
    proposedBenefits:[
      "Pickup order and menu management",
      "Cash or physical card payment at the shop",
      "Basic order history and shop information",
    ],
  },
  {
    id:"pro",label:"Pro",monthlyPriceZar:399,
    headline:"Growth tools (future)",
    proposedBenefits:[
      "Everything in Plus",
      "More detailed shop performance insights (planned)",
      "Marketing campaign preparation tools (planned)",
    ],
  },
  {
    id:"premium",label:"Premium",monthlyPriceZar:499,
    headline:"Advanced growth (future)",
    proposedBenefits:[
      "Everything in Pro",
      "Advanced reporting and comparison views (planned)",
      "Additional campaign planning and support options (planned)",
    ],
  },
] as const;
export function merchantSubscriptionsActivationEnabled():boolean{return false;}
export function merchantSubscriptionsTrialNotice():string{
  return "Proposed: the first 3 calendar months are free for each shop, starting only from its verified trading launch. No verified launch date or payment due date is available in this Preview.";
}
export function merchantSubscriptionPaymentNotice():string{
  return "No plan is selected, billed or activated here. Pricing, included benefits and tax treatment require final approval. A shop must receive its terms and agree before paid billing can begin.";
}
