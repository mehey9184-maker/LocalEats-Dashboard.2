interface CorsOriginEnvironment {
  MERCHANT_DASHBOARD_ORIGIN?: string;
  MERCHANT_DASHBOARD_PREVIEW_HOST_PREFIX?: string;
  MERCHANT_DASHBOARD_PREVIEW_HOST_SUFFIX?: string;
  SUPER_ADMIN_ORIGIN?: string;
  CUSTOMER_APP_ORIGIN?: string;
  CUSTOMER_PROFILE_STAGING_ORIGINS?: string;
  VERCEL_ENV?: string;
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
  // Canonical Customer Production origin only; Firebase still authorizes private reads/quotes.
  if (origin === "https://www.localeatssa.co.za") return true;

  const productionOrigin = environment.MERCHANT_DASHBOARD_ORIGIN;
  if (productionOrigin && origin === productionOrigin) return true;

  const superAdminOrigin = normalizeExactBrowserOrigin(
    environment.SUPER_ADMIN_ORIGIN
  );
  if (superAdminOrigin !== null && origin === superAdminOrigin) return true;

  const customerOrigin = normalizeExactBrowserOrigin(environment.CUSTOMER_APP_ORIGIN);
  if (customerOrigin !== null && origin === customerOrigin) return true;

  // Owner-approved disposable Customer P5 Preview catalog reads. Only these
  // exact Vercel deployment/branch-alias origins are accepted in Preview;
  // never allow wildcard host patterns or expose this override in Production.
  if (environment.VERCEL_ENV === "preview" && environment.CUSTOMER_PROFILE_STAGING_ORIGINS) {
    const candidates = environment.CUSTOMER_PROFILE_STAGING_ORIGINS.split(",").map(value=>value.trim());
    if (candidates.length > 0 && candidates.length <= 2 &&
        candidates.every(value=>value.length > 0)) {
      for (const candidate of candidates) {
        const approved = normalizeExactBrowserOrigin(candidate);
        if (!approved || approved !== origin || !approved.startsWith("https://")) continue;
        const hostname = new URL(approved).hostname;
        if (/^project-x7cvt-[a-z0-9-]+-mehey9184-makers-projects\.vercel\.app$/.test(hostname))
          return true;
      }
    }
  }

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
