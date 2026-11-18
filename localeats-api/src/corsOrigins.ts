import {privateMyKotaCorsAllowed} from "./routes/privateMyKotaTest.js";
import {isIsolatedCustomerPushCorsOrigin} from "./middleware/customerPushPreviewAdmission.js";
interface CorsOriginEnvironment {
  MERCHANT_DASHBOARD_ORIGIN?: string;
  MERCHANT_DASHBOARD_PREVIEW_HOST_PREFIX?: string;
  MERCHANT_DASHBOARD_PREVIEW_HOST_SUFFIX?: string;
  SUPER_ADMIN_ORIGIN?: string;
  CUSTOMER_APP_ORIGIN?: string;
  RIDER_APP_ORIGIN?: string;
}

const normalizeExactBrowserOrigin = (value?: string): string | null => {
  const configuredOrigin = value?.trim();
  if (!configuredOrigin) return null;

  try {
    const parsedOrigin = new URL(configuredOrigin);
    const isBrowserProtocol =
      parsedOrigin.protocol === "https:" || parsedOrigin.protocol === "http:";

    if (
      !isBrowserProtocol ||
      parsedOrigin.hostname.includes("*") ||
      parsedOrigin.username !== "" ||
      parsedOrigin.password !== "" ||
      parsedOrigin.pathname !== "/" ||
      parsedOrigin.search !== "" ||
      parsedOrigin.hash !== "" ||
      parsedOrigin.origin !== configuredOrigin
    ) {
      return null;
    }

    return parsedOrigin.origin;
  } catch {
    return null;
  }
};

export const isAllowedOrigin = (
  origin?: string,
  environment: CorsOriginEnvironment = process.env
): boolean => {
  if (origin === undefined) return true;
  // Exact isolated Preview origin only when server-side test UID/expiry gates pass.
  if (privateMyKotaCorsAllowed(origin,environment as NodeJS.ProcessEnv)) return true;
  // Canonical Customer Production origin only; Firebase still authorizes private reads/quotes.
  if (origin === "https://www.localeatssa.co.za") return true;

  const productionOrigin = environment.MERCHANT_DASHBOARD_ORIGIN;
  if (productionOrigin && origin === productionOrigin) return true;

  const superAdminOrigin = normalizeExactBrowserOrigin(
    environment.SUPER_ADMIN_ORIGIN
  );
  if (superAdminOrigin !== null && origin === superAdminOrigin) return true;

  // Only when the isolated sender is explicitly enabled: one exact staging
  // Customer origin. No wildcard CORS for ordinary PR Previews.
  if(isIsolatedCustomerPushCorsOrigin(origin,environment as NodeJS.ProcessEnv)) return true;

  // L3-N3 pinned read-only Customer Preview pairing. Only the dedicated
  // staging API build may read from this exact immutable Customer origin;
  // generic PR Previews and Production cannot borrow this exception.
  const stage=environment as NodeJS.ProcessEnv;
  if(origin==="https://localeats-customer-staging-r52d-mejyo1nm2.vercel.app" &&
     stage.VERCEL_ENV==="preview" &&
     stage.LOCALEATS_STAGING_ONLY==="true" &&
     stage.PICKUP_WRITES_ENABLED==="false" &&
     stage.FIREBASE_PROJECT_ID==="localeats-staging" &&
     stage.SUPABASE_URL==="https://rgpbdajhlrwfmhopzgzk.supabase.co") return true;

  const customerOrigin = normalizeExactBrowserOrigin(environment.CUSTOMER_APP_ORIGIN);
  if (customerOrigin !== null && origin === customerOrigin) return true;

  const riderOrigin = normalizeExactBrowserOrigin(environment.RIDER_APP_ORIGIN);
  if (riderOrigin !== null && origin === riderOrigin) return true;

  const previewHostPrefix =
    environment.MERCHANT_DASHBOARD_PREVIEW_HOST_PREFIX;
  const previewHostSuffix =
    environment.MERCHANT_DASHBOARD_PREVIEW_HOST_SUFFIX;
  if (!previewHostPrefix || !previewHostSuffix) return false;

  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.origin === origin
      && parsedOrigin.protocol === "https:"
      && parsedOrigin.hostname.startsWith(previewHostPrefix)
      && parsedOrigin.hostname.endsWith(previewHostSuffix);
  } catch {
    return false;
  }
};
