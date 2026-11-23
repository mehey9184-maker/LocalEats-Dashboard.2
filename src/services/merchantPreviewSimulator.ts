// The order workshop is fake and local-only. Only explicitly approved preview
// hostnames may expose it, and only while all demo/no-write flags agree.
export function isApprovedMerchantDemoHostname(hostname:string,cloudflarePreviewHostname?:string):boolean{
 const normalized=hostname.trim().toLowerCase();
 const vercel=/^local-eats-dashboard-2-6m8o-[a-z0-9]+-mehey9184-makers-projects\.vercel\.app$/.test(normalized);
 const configured=(cloudflarePreviewHostname??"").trim().toLowerCase();
 // Explicit exact hostname only. No wildcard *.pages.dev and no Production custom domain.
 const cloudflare=/^(?:[a-z0-9-]+\.)?[a-z0-9-]+\.pages\.dev$/.test(configured) &&
   configured===normalized;
 return vercel||cloudflare;
}

export function isMerchantPreviewSimulatorEnabled():boolean{
 return import.meta.env.VITE_MERCHANT_PREVIEW_READ_ONLY==="true" &&
   import.meta.env.VITE_MERCHANT_FAKE_ORDERS_ENABLED==="true" &&
   import.meta.env.VITE_PICKUP_ORDERING_ENABLED!=="true" &&
   typeof window!=="undefined" &&
   isApprovedMerchantDemoHostname(
     window.location.hostname,
     import.meta.env.VITE_MERCHANT_PREVIEW_CLOUDFLARE_HOSTNAME
   );
}

// Presentation rollout is separate from the fake-order sandbox and from
// authorizing real pickup/order/payment writes.
export function isMerchantOrdersFocusedEnabled(): boolean {
  const inReviewPreview =
    import.meta.env.VITE_MERCHANT_ORDERS_FOCUSED_UI === "true" &&
    isMerchantPreviewSimulatorEnabled();

  const onApprovedMerchantProduction =
    import.meta.env.PROD &&
    typeof window !== "undefined" &&
    window.location.hostname === "dashboard.localeatssa.co.za" &&
    // A later pickup activation must have its own explicit review.
    import.meta.env.VITE_PICKUP_ORDERING_ENABLED !== "true";

  return inReviewPreview || onApprovedMerchantProduction;
}
