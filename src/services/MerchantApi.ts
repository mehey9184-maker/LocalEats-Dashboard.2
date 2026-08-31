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
   * If the endpoint does not exist yet or the user has no shop, returns null.
   */
  static async getMerchantShop(): Promise<VerifiedMerchantShop | null> {
    try {
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
        throw new Error(`Failed to fetch merchant shop: ${response.statusText}`);
      }

      const data = await response.json();
      return data.shop || data;
    } catch (error) {
      console.debug("[MerchantApi] Error fetching verified merchant shop:", error);
      return null;
    }
  }
}
