import { getApiAuthHeaders } from "../lib/apiAuth";

export type VerifiedMerchantShop = {
  id: string | number;
  owner_id: string;
  name?: string;
  is_active?: boolean;
  [key: string]: any;
};

export class MerchantApi {
  /**
   * Fetches the verified shop for the authenticated merchant from the authoritative API.
   * Returns null ONLY if the merchant explicitly has no shop (404).
   * Throws errors for authentication, authorization, or server failures.
   */
  static async getMerchantShop(): Promise<VerifiedMerchantShop | null> {
    const headers = await getApiAuthHeaders();
    const response = await fetch("/api/v1/merchant/shop", {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.debug("[MerchantApi] Endpoint not found or no shop mapped for merchant.");
        return null;
      }
      if (response.status === 401) {
        throw new Error("Authentication failed (401)");
      }
      if (response.status === 403) {
        throw new Error("Authorization failed (403)");
      }
      throw new Error(`Failed to fetch merchant shop (HTTP ${response.status}): ${response.statusText}`);
    }

    const data = await response.json();
    return data.shop || data;
  }
}
