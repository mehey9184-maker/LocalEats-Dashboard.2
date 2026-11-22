// Dedicated public, zero-data Cloudflare Workshop Worker only.
// The original Vercel fake-order preview guard is deliberately unchanged.
// This grant NEVER applies to the authenticated Merchant Dashboard, real order
// controls, arbitrary Cloudflare Workers, custom domains or localhost.
export const CLOUDFLARE_WORKSHOP_HOST = "localeats-merchant-workshop-preview.mehey9184.workers.dev";

export function isIsolatedCloudflareWorkshopPreviewEnabled(): boolean {
  return import.meta.env.VITE_MERCHANT_WORKSHOP_CLOUDFLARE_PREVIEW === "true" &&
    import.meta.env.VITE_MERCHANT_PREVIEW_READ_ONLY === "true" &&
    import.meta.env.VITE_PICKUP_ORDERING_ENABLED !== "true" &&
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    window.location.hostname === CLOUDFLARE_WORKSHOP_HOST;
}
