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
      "Core pickup orders, menu and availability (no order cap proposed)",
      "Cash or existing physical card machine at the shop",
      "Opening hours, basic order history and standard support",
    ],
  },
  {
    id:"pro",label:"Pro",monthlyPriceZar:399,
    headline:"Growth tools (future)",
    proposedBenefits:[
      "Everything in Plus, including core ordering and security",
      "Item, category and busy-period insights (planned)",
      "Marketing drafts, approved offers and QR artwork (planned)",
    ],
  },
  {
    id:"premium",label:"Premium",monthlyPriceZar:499,
    headline:"Advanced growth (future)",
    proposedBenefits:[
      "Everything in Pro; no core features removed from lower plans",
      "Advanced trend comparisons and report exports (planned)",
      "Campaign measurement and optional team workflows (planned)",
    ],
  },
] as const;
export function merchantSubscriptionsActivationEnabled():boolean{return false;}
export function merchantSubscriptionsTrialNotice():string{
  return "Proposed: each shop receives 3 free calendar months from its verified trading launch—not registration or testing. No trading-launch date or payment due date has been verified in this Preview.";
}
export function merchantSubscriptionPaymentNotice():string{
  return "No subscription or payment method is selected, saved, charged or activated here. Benefits and VAT treatment remain proposals. A shop must receive clear terms and explicitly agree before any paid billing; no automatic paid conversion is implied.";
}
