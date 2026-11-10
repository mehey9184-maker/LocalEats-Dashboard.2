// L1C-3: never expose the fake-order tester on a Production hostname.
// The owner-only training UI is strictly limited to a no-write Merchant Preview build.
export function isMerchantPreviewSimulatorEnabled(): boolean {
  return import.meta.env.VITE_MERCHANT_PREVIEW_READ_ONLY === "true" &&
    import.meta.env.VITE_MERCHANT_FAKE_ORDERS_ENABLED === "true" &&
    import.meta.env.VITE_PICKUP_ORDERING_ENABLED !== "true" &&
    typeof window !== "undefined" &&
    /^local-eats-dashboard-2-6m8o-[a-z0-9]+-mehey9184-makers-projects\.vercel\.app$/.test(window.location.hostname);
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
