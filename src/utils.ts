import { Order, OrderStatus } from "./types";

export const FLAT_DELIVERY_FEE = 5;

export function getSupportedCity(cityName: string): string {
  const normalized = cityName.toLowerCase();
  
  // High-precision matching for specific sub-areas
  if (normalized.includes("kaalfontein") || normalized.includes("eboni")) return "Kaalfontein";
  if (normalized.includes("ivory park") || normalized.includes("kopanong") || normalized.includes("midrand")) return "Ivory Park";
  if (normalized.includes("tembisa") || normalized.includes("kempton park")) return "Tembisa";
  
  return "Tembisa"; // Default regional hub
}

export interface ParsedAddress {
  formattedAddress: string;
  city: string;
  postalCode: string;
}

export const parseAndNormalizeZAAddress = (rawAddress: string, defaultCity: string = "Tembisa"): ParsedAddress => {
  if (!rawAddress) {
    return { formattedAddress: "", city: defaultCity, postalCode: "" };
  }

  const clean = rawAddress
    .replace(/, South Africa/gi, "")
    .replace(/, ZA/gi, "")
    .replace(/, GP/gi, "")
    .replace(/, Gauteng/gi, "")
    .trim();

  const zipMatch = clean.match(/\b\d{4}\b/);
  const postalCode = zipMatch ? zipMatch[0] : "";

  let city = defaultCity;
  const lowerClean = clean.toLowerCase();
  if (lowerClean.includes("kaalfontein") || lowerClean.includes("eboni")) {
    city = "Kaalfontein";
  } else if (lowerClean.includes("ivory park") || lowerClean.includes("kopanong") || lowerClean.includes("midrand")) {
    city = "Ivory Park";
  } else if (lowerClean.includes("tembisa") || lowerClean.includes("kempton park")) {
    city = "Tembisa";
  } else {
    city = getSupportedCity(clean);
  }

  const formattedAddress = `${clean}, South Africa`;

  return {
    formattedAddress,
    city,
    postalCode,
  };
};

export const formatSAPhone = (value: string) => {
  // Remove all non-digits
  let digits = value.replace(/\D/g, "");
  
  // If user starts with 0, remove it and we'll use +27
  if (digits.startsWith("0")) {
    digits = digits.substring(1);
  } else if (digits.startsWith("27")) {
    digits = digits.substring(2);
  }

  // Cap at 9 digits (excluding +27)
  digits = digits.substring(0, 9);

  // Re-build standard format: +27 82 123 4567
  let formatted = "+27";
  if (digits.length > 0) formatted += " " + digits.substring(0, 2);
  if (digits.length > 2) formatted += " " + digits.substring(2, 5);
  if (digits.length > 5) formatted += " " + digits.substring(5, 9);
  
  return {
    raw: digits.length === 0 ? "" : "+27" + digits,
    formatted: digits.length === 0 ? "" : formatted
  };
};

export const safeStripOrderColumns = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  // Columns that frequently cause PGRST204 errors if unmigrated in database schema
  const unmigratedBlacklist = new Set(["city", "rider_name", "rider_phone", "whatsapp"]);

  try {
    const { data: sampleData, error } = await supabaseClient.from("orders").select().limit(1);
    if (!error && sampleData && sampleData.length > 0) {
      const validColumns = new Set(Object.keys(sampleData[0]));
      const cleaned: Record<string, unknown> = {};
      for (const key of Object.keys(data)) {
        if (validColumns.has(key) && !unmigratedBlacklist.has(key)) {
          cleaned[key] = data[key];
        } else {
          console.log(`[SafeStrip] Stripping un-migrated column: ${key}`);
        }
      }
      return cleaned;
    }
  } catch (e) {
    console.warn("Failed to dynamically probe order columns:", e);
  }

  const defaultColumns = new Set([
    "id", "shop_id", "user_id", "product_name", "product_variant", 
    "total_price", "price", "lat", "lng", "status", "payment_method", 
    "country", "created_at", "customer_name", "phone", "email", "address", 
    "notes", "acceptance_message", "accepted_at", "completed_at", 
    "estimated_delivery_time", "items", "coupon_code", "discount_amount", 
    "delivery_fee", "rider_id", "restaurant_name", "delivery_status", 
    "order_type", "merchant_rating", "merchant_feedback", 
    "terminal_masked_card", "terminal_sync_status"
  ]);

  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    if (defaultColumns.has(key) && !unmigratedBlacklist.has(key)) {
      cleaned[key] = data[key];
    }
  }
  return cleaned;
};

export const isOrderDelivery = (order: Partial<Order>): boolean => {
  if (!order) return false;
  
  // If explicitly set to collection or pickup, it is not a delivery
  if (
    order.order_type === "collection" ||
    order.order_type === "pickup"
  ) {
    return false;
  }
  
  // If explicitly set to delivery, it is definitely a delivery
  if (order.order_type === "delivery") {
    return true;
  }
  
  // If not explicitly set, check delivery fee or address
  if (
    order.delivery_fee !== undefined &&
    order.delivery_fee !== null &&
    Number(order.delivery_fee) > 0
  ) {
    return true;
  }
  
  // Check address keywords to see if it is a delivery address
  if (order.address) {
    const addr = order.address.toLowerCase().trim();
    if (
      addr !== "" &&
      addr !== "collection" &&
      addr !== "pickup" &&
      addr !== "in-store" &&
      addr !== "instore"
    ) {
      return true;
    }
  }
  
  return false;
};

export const getOrderTransitionData = (
  order: Order,
  newStatus: OrderStatus,
  shopName: string,
  shopId: number
): Partial<Order> => {
  const updateData: Partial<Order> = { status: newStatus };

  if (newStatus === "preparing" && !order.accepted_at) {
    updateData.accepted_at = new Date().toISOString();
  }
  if (newStatus === "completed" && !order.completed_at) {
    updateData.completed_at = new Date().toISOString();
  }

  const isDelivery = isOrderDelivery(order);
  const isTransitioningToActive = newStatus === "preparing" || newStatus === "ready" || newStatus === "accepted";

  if (isTransitioningToActive && isDelivery && !order.delivery_status) {
    updateData.delivery_status = "finding_rider";
    updateData.delivery_fee = FLAT_DELIVERY_FEE;
    updateData.order_type = "delivery";
    updateData.status = "accepted"; // Force 'accepted' for Rider App query compatibility
    updateData.restaurant_name = order.restaurant_name || shopName;
    updateData.shop_id = order.shop_id || shopId;
    updateData.price = order.price || order.total_price || 0;
    updateData.total_price = order.total_price || order.price || 0;

    if (!order.items || order.items.length === 0) {
      updateData.items = order.product_name ? [order.product_name] : ["Food Delivery"];
    }
  }

  if (newStatus === "completed" && order.delivery_status === "finding_rider") {
    (updateData as Record<string, unknown>).delivery_status = null;
  }

  return updateData;
};
