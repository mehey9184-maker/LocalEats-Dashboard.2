import {createMerchantPickupRecovery} from "./merchantPickupRecovery";
import {validateMerchantMenu} from "./merchantMenuPolicy";
import {auth} from "../lib/firebase";
import {isPickupOrder,mapApiOrder,requireOwnedShop,pickupCommand,pickupMutationsDisabled,pickupOrderingEnabled,type PickupAction} from "./merchantPickupPolicy";
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
  code?: string;

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

const pickupRecovery=createMerchantPickupRecovery({
 identity:()=>auth.currentUser?.uid,enabled:pickupOrderingEnabled,mapOrder:mapApiOrder,
 storage:{getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value),removeItem:key=>sessionStorage.removeItem(key)},
 transport:async(order,command,signal,uid)=>{
  const headers=await getApiAuthHeaders();
  if(signal.aborted || auth.currentUser?.uid!==uid)throw new MerchantApiError("Your session changed or the action timed out. Retry previous action.");
  const response=await fetch(`${getApiUrl()}/api/v1/merchant/orders/${encodeURIComponent(String(order.id))}/${command.path}`,{method:"POST",headers,body:JSON.stringify(command.body),signal});
  return {status:response.status,data:await readJsonResponse(response)};
 },
});

export class MerchantApi {
  /** Revoke only this authenticated merchant's device. Never delete another shop's token. */
  static async revokePushDevice(installationId:string):Promise<boolean> {
    const uid=auth.currentUser?.uid;
    if(!uid || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(installationId))return false;
    try{
      const response=await fetch(`${getApiUrl()}/api/v1/push-subscriptions/${encodeURIComponent(installationId)}`,{
        method:"DELETE",headers:await getApiAuthHeaders()
      });
      const data=await readJsonResponse(response);
      return response.ok && data.success===true;
    }catch{return false;}
  }

  /** Register a verified merchant's FCM device with the protected pickup API.
   * A browser's permission alone does not mean FCM can reach this merchant.
   */
  static async registerPushDevice(installationId:string,fcmToken:string):Promise<boolean> {
    const uid=auth.currentUser?.uid;
    if(!uid || !/^[0-9a-f-]{36}$/i.test(installationId) ||
       typeof fcmToken!=="string" || fcmToken.length<20) return false;
    const shop=await this.getMerchantShop();
    if(!shop || String(shop.owner_id)!==uid || auth.currentUser?.uid!==uid) return false;
    try {
      const response=await fetch(`${getApiUrl()}/api/v1/push-subscriptions/${encodeURIComponent(installationId)}`,{
        method:"PUT",headers:await getApiAuthHeaders(),
        body:JSON.stringify({fcm_token:fcmToken,permission_granted:true}),
      });
      const data=await readJsonResponse(response);
      return auth.currentUser?.uid===uid && response.ok && data.success===true;
    }catch{return false;}
  }
  static async setAvailability(shopId:string|number,open:boolean,confirmOutsideHours=false,expectedRevision?:number):Promise<VerifiedMerchantShop> {
    const uid=auth.currentUser?.uid;
    const shop=await this.getMerchantShop();
    if(!uid || !shop || String(shop.id)!==String(shopId)) throw new MerchantApiError("Shop ownership could not be verified.");
    const revision=expectedRevision ?? Number(shop.availability_revision);
    if(!Number.isSafeInteger(revision) || revision<0) throw new MerchantApiError("Availability schema is not activated yet.");
    const response=await fetch(`${getApiUrl()}/api/v1/merchant/shop/availability`,{method:"PATCH",headers:await getApiAuthHeaders(),body:JSON.stringify({shop_id:String(shopId),open,confirm_outside_hours:confirmOutsideHours,expected_revision:revision})});
    const data=await readJsonResponse(response);
    if(!response.ok || data.success!==true){const error=new MerchantApiError(typeof data.error==="string"?data.error:"Availability was not saved.",response.status);error.code=typeof data.code==="string"?data.code:undefined;
      // Preserve the revision for the explicit outside-hours confirmation, never rebase a stale command.
      (error as any).expectedRevision=revision;throw error;}
    if(auth.currentUser?.uid!==uid || !data.shop || String(data.shop.id)!==String(shopId) || typeof data.shop.is_active!=="boolean") throw new MerchantApiError("Availability persistence was not confirmed. Refresh before retrying.");
    requireOwnedShop(data.shop,uid);
    return data.shop;
  }

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

  static hasPendingPickupCommand(order:any):boolean {
    const uid=auth.currentUser?.uid;
    try{return !!uid && !!sessionStorage.getItem(`pickup-command:${uid}:${order.id}`);}catch{return false;}
  }
  private static async sendPickupCommand(order:Record<string,unknown>,command:any) {
    pickupMutationsDisabled();
    return pickupRecovery.send(order,command);
  }
  static async retryPendingPickupOrder(order:Record<string,unknown>) {
    return pickupRecovery.retry(order);
  }
  static async transitionPickupOrder(order:Record<string,unknown>,action:PickupAction,extra:Record<string,unknown>={}):Promise<Record<string,unknown>> {
    if(!auth.currentUser?.uid)throw new MerchantApiError("Sign in before changing an order.");
    if(this.hasPendingPickupCommand(order))throw new MerchantApiError("Use Retry previous action before sending another command.");
    return this.sendPickupCommand(order,pickupCommand(order,action,extra));
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
