interface CorsOriginEnvironment {
  MERCHANT_DASHBOARD_ORIGIN?: string;
  MERCHANT_DASHBOARD_PREVIEW_HOST_PREFIX?: string;
  MERCHANT_DASHBOARD_PREVIEW_HOST_SUFFIX?: string;
  SUPER_ADMIN_ORIGIN?: string;
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

  const productionOrigin = environment.MERCHANT_DASHBOARD_ORIGIN;
  if (productionOrigin && origin === productionOrigin) return true;

  const superAdminOrigin = normalizeExactBrowserOrigin(
    environment.SUPER_ADMIN_ORIGIN
  );
  if (superAdminOrigin !== null && origin === superAdminOrigin) return true;

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
