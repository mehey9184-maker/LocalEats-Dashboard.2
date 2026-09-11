import { getApiAuthHeaders } from "../lib/apiAuth";

export type MerchantMenuItem = {
  id: string | number;
  shop_id: string | number;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  category: string | null;
  is_available: boolean;
  popularity_score: number | null;
  customizations: unknown;
  created_at: string;
};
export type MerchantMenuInput = {
  name: string;
  price: number;
  description?: string | null;
  image_url?: string | null;
  category?: string;
  is_available?: boolean;
};

const isMenuItem = (value: unknown): value is MerchantMenuItem => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (typeof item.id === "string" || typeof item.id === "number") &&
    (typeof item.shop_id === "string" || typeof item.shop_id === "number") &&
    typeof item.name === "string" && typeof item.price === "number" && Number.isFinite(item.price) &&
    typeof item.is_available === "boolean";
};

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
  private static async menuRequest(path: string, method: "GET" | "POST" | "PATCH", input?: unknown) {
    const apiUrl = getApiUrl().replace(/\/+$/, "");
    const headers = await getApiAuthHeaders();
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/api/v1/merchant/menu${path}`, {
        method, headers, ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      });
    } catch {
      throw new MerchantApiError("Unable to reach the LocalEats menu service. Refresh the menu before retrying a save.");
    }
    const data = await readJsonResponse(response);
    if (!response.ok || data.success !== true) {
      throw new MerchantApiError(typeof data.error === "string" ? data.error : "Unable to complete menu request.", response.status);
    }
    return data;
  }

  static async getMenu(shopId: string | number): Promise<MerchantMenuItem[]> {
    const data = await this.menuRequest(`?shop_id=${encodeURIComponent(shopId)}`, "GET");
    if (!Array.isArray(data.menu) || !data.menu.every(isMenuItem) ||
        data.menu.some((item) => String(item.shop_id) !== String(shopId))) {
      throw new MerchantApiError("LocalEats menu service returned an invalid menu.");
    }
    return data.menu;
  }

  static async createMenuItem(input: MerchantMenuInput & { shop_id: string | number }): Promise<MerchantMenuItem> {
    const data = await this.menuRequest("", "POST", input);
    if (!isMenuItem(data.item) || String(data.item.shop_id) !== String(input.shop_id)) {
      throw new MerchantApiError("LocalEats menu service did not confirm the created item. Refresh before retrying.");
    }
    return data.item;
  }

  static async updateMenuItem(itemId: string | number, input: Partial<MerchantMenuInput>): Promise<MerchantMenuItem> {
    const data = await this.menuRequest(`/${encodeURIComponent(itemId)}`, "PATCH", input);
    if (!isMenuItem(data.item) || String(data.item.id) !== String(itemId)) {
      throw new MerchantApiError("LocalEats menu service did not confirm the updated item. Refresh before retrying.");
    }
    return data.item;
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
    if (!Array.isArray(data.orders)) {
      throw new MerchantApiError("LocalEats order service returned invalid orders.", response.status);
    }
    return data.orders;
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
