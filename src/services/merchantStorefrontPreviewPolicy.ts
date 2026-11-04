/**
 * Storefront F1/S5 reconciliation: hard stop for shop/profile and availability
 * writes in the unmerged Merchant Preview line. This is deliberately not
 * configurable with a public Vite env var. Production activation needs its
 * own security and rollout review; keep this lock while in Preview.
 */
export function merchantStorefrontPreviewOnly(): boolean { return true; }
export function merchantStorefrontWritesEnabled(): boolean { return false; }
export function merchantStorefrontPreviewNotice(): string {
  return "Read-only Merchant Preview: shop onboarding, profile saves, status changes, image uploads, map pin writes and follower updates are unavailable. The test map pin stays in this browser tab only.";
}
