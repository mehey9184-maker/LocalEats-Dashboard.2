import {validateMerchantMenu} from "./merchantMenuPolicy";
import {auth} from "../lib/firebase";
import {isPickupOrder,mapApiOrder,requireOwnedShop,pickupCommand,pickupMutationsDisabled,type PickupAction} from "./merchantPickupPolicy";
import { getApiAuthHeaders } from "../lib/apiAuth";

export type VerifiedMerchantShop = {
  id: string | number;
  owner_id: string;
  name?: string;
  is_active?: boolean;
  [key: string]: any;
};

export type MerchantShopCreateInput = {
  name: string;
  category: string;
  description: string;
  phone: string;
  location: string;
  latitude: number;
  longitude: number;
  opening_time: string;
  closing_time: string;
  logo_url: string;
  story: string;
};

type MerchantApiResponse = {
  shop?: VerifiedMerchantShop;
  order?: Record<string, unknown>;
  orders?: Record<string, unknown>[];
  error?: string;
  [key: string]: unknown;
};

export class MerchantApiError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "MerchantApiError";
    this.status = status;
  }
}

const getApiUrl = (): string => {
  const apiUrl = import.meta.env.VITE_LOCALEATS_API_URL;
  if (!apiUrl) {
    throw new MerchantApiError("LocalEats merchant service is not configured.");
  }
  return apiUrl;
};

const readJsonResponse = async (response: Response): Promise<MerchantApiResponse> => {
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new MerchantApiError("LocalEats merchant service returned an invalid response.", response.status);
  }

  try {
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new MerchantApiError("LocalEats merchant service returned an unexpected JSON response.", response.status);
    }
    return data as MerchantApiResponse;
  } catch (error) {
    if (error instanceof MerchantApiError) throw error;
    throw new MerchantApiError("LocalEats merchant service returned invalid JSON.", response.status);
  }
};

export class MerchantApi {
  static async getMenuItems(shopId: string | number): Promise<any[]> {
    const uid = auth.currentUser?.uid;
    const shop = await this.getMerchantShop();
    if (!shop || String(shop.id) !== String(shopId)) throw new MerchantApiError("Menu shop ownership could not be verified.");
    const response = await fetch(`${getApiUrl()}/api/v1/catalog/shops/${encodeURIComponent(String(shop.id))}/menu`, {headers: await getApiAuthHeaders()});
    const data = await readJsonResponse(response);
    if (!response.ok || data.success !== true || !Array.isArray(data.menu_items)) throw new MerchantApiError("Unable to load the authoritative shop menu.", response.status);
    if (!uid || auth.currentUser?.uid !== uid) throw new MerchantApiError("Your session changed. Refresh the menu.");
    return validateMerchantMenu(data.menu_items, shop.id);
  }

  static async getOrders(): Promise<Record<string, unknown>[]> {
    const apiUrl = getApiUrl();
    const headers = await getApiAuthHeaders();
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/api/v1/merchant/orders`, { method: "GET", headers });
    } catch {
      throw new MerchantApiError("Unable to reach the LocalEats order service.");
    }
    const data = await readJsonResponse(response);
    if (!response.ok) {
      throw new MerchantApiError(
        typeof data.error === "string" ? data.error : "Unable to load orders.",
        response.status,
      );
    }
    if (data.success!==true || !Array.isArray(data.orders)) {
      throw new MerchantApiError("LocalEats order service returned invalid orders.", response.status);
    }
    return data.orders.map(mapApiOrder);
  }

  static async transitionPickupOrder(order:Record<string,unknown>,action:PickupAction,extra:Record<string,unknown>={}):Promise<Record<string,unknown>> {
    const command=pickupCommand(order,action,extra);
    pickupMutationsDisabled(); // Deliberate local gate: no activation environment flag or hidden bypass.
    const headers=await getApiAuthHeaders();
    const response=await fetch(`${getApiUrl()}/api/v1/merchant/orders/${encodeURIComponent(String(order.id))}/${command.path}`,{method:"POST",headers,body:JSON.stringify(command.body)});
    const result=await readJsonResponse(response);
    if(!response.ok || result.success!==true || !result.order || typeof result.order.id!=="string")throw new MerchantApiError(typeof result.error==="string" ? result.error : "The API did not confirm persistence.",response.status);
    return mapApiOrder(result.order);
  }

  static async transitionOrder(orderId: string, action: "accept" | "ready"): Promise<Record<string, unknown>> {
    const apiUrl = getApiUrl();
    const headers = await getApiAuthHeaders();
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/api/v1/merchant/orders/${encodeURIComponent(orderId)}/${action}`, {
        method: "POST",
        headers,
      });
    } catch {
      throw new MerchantApiError("Unable to reach the LocalEats order service.");
    }
    const data = await readJsonResponse(response);
    if (!response.ok) {
      throw new MerchantApiError(
        typeof data.error === "string" ? data.error : "Unable to update order.",
        response.status,
      );
    }
    if (!data.order || typeof data.order !== "object" || Array.isArray(data.order)) {
      throw new MerchantApiError("LocalEats order service returned an invalid order.", response.status);
    }
    return data.order;
  }

  /**
   * Fetches the verified shop for the authenticated merchant from the authoritative API.
   * Returns null ONLY if the merchant explicitly has no shop (404).
   * Throws errors for authentication, authorization, or server failures.
   */
  static async getMerchantShop(): Promise<VerifiedMerchantShop | null> {
    const apiUrl = getApiUrl();

    const headers = await getApiAuthHeaders();
    let response: Response;

    try {
      response = await fetch(`${apiUrl}/api/v1/merchant/shop`, {
        method: "GET",
        headers,
      });
    } catch {
      throw new MerchantApiError("Unable to reach the LocalEats merchant service.");
    }

    const data = await readJsonResponse(response);
    if (response.status === 404) {
      if (data.error === "Merchant shop not mapped") {
        return null;
      }
      throw new MerchantApiError("LocalEats merchant service returned an unexpected not-found response.", 404);
    }

    if (!response.ok) {
      throw new MerchantApiError(
        typeof data.error === "string" ? data.error : "Unable to verify merchant shop.",
        response.status,
      );
    }

    const shop = data.shop || (data as VerifiedMerchantShop);
    if (!shop || shop.id === null || shop.id === undefined) {
      throw new MerchantApiError("LocalEats merchant service returned an invalid shop.", response.status);
    }

    requireOwnedShop(shop,auth.currentUser?.uid || "");
    return shop as VerifiedMerchantShop;
  }

  static async createShop(input: MerchantShopCreateInput): Promise<VerifiedMerchantShop> {
    const apiUrl = getApiUrl();
    const headers = await getApiAuthHeaders();
    let response: Response;

    try {
      response = await fetch(`${apiUrl}/api/v1/merchant/shop`, {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      });
    } catch {
      throw new MerchantApiError("Unable to reach the LocalEats merchant service.");
    }

    const data = await readJsonResponse(response);
    if (!response.ok) {
      throw new MerchantApiError(
        typeof data.error === "string" ? data.error : "Unable to create merchant shop.",
        response.status,
      );
    }

    const shop = data.shop || (data as VerifiedMerchantShop);
    if (!shop || shop.id === null || shop.id === undefined) {
      throw new MerchantApiError("LocalEats merchant service returned an invalid shop.", response.status);
    }

    return shop as VerifiedMerchantShop;
  }
}
