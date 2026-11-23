import type {Shop,User} from "../types";

// A demonstration fixture, NOT a Firebase login or an API shop.
// Fail closed on any domain except the one isolated Cloudflare Worker.
const CF_MERCHANT_PITCH_HOST = "localeats-merchant-dashboard-preview.mehey9184.workers.dev";
export const CF_PITCH_DEMO_USER: User = {
  id:"localeats-fictional-cloudflare-merchant",
  email:"demo-only@example.invalid",
  user_metadata:{full_name:"Example Shop Owner",vendor_shop_name:"LocalEats Example Shop"},
};
export const CF_PITCH_DEMO_SHOP: Shop = {
  id:900001,
  name:"LocalEats Example Shop",
  owner_id:CF_PITCH_DEMO_USER.id,
  category:"Kota & Fast Food",
  location:"Fictional demonstration",
  description:"Fictional shop — demonstration only",
  is_active:true,
  approval_status:"approved",
  operating_hours:{open:"08:00",close:"22:00"},
};
export function isIsolatedCloudflareMerchantPitchPreviewEnabled(): boolean {
  return import.meta.env.VITE_MERCHANT_CF_DEMO_READ_ONLY === "true" &&
    import.meta.env.VITE_MERCHANT_PREVIEW_READ_ONLY === "true" &&
    import.meta.env.VITE_MERCHANT_FAKE_ORDERS_ENABLED === "true" &&
    import.meta.env.VITE_PICKUP_ORDERING_ENABLED !== "true" &&
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    window.location.hostname === CF_MERCHANT_PITCH_HOST;
}
