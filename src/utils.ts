import { Order, OrderStatus } from "./types";

export const FLAT_DELIVERY_FEE = 5;

export function getSupportedCity(cityName: string): string {
  const normalized = cityName.toLowerCase();
  
  // High-precision matching for specific sub-areas
  if (normalized.includes("kaalfontein") || normalized.includes("eboni") || normalized.includes("ebony")) return "Kaalfontein";
  if (normalized.includes("ivory park") || normalized.includes("kopanong")) return "Ivory Park";
  if (normalized.includes("clayville")) return "Clayville";
  if (normalized.includes("rabie ridge") || normalized.includes("rabie")) return "Rabie Ridge";
  if (normalized.includes("midrand")) return "Midrand";
  if (normalized.includes("kempton park") || normalized.includes("kempton")) return "Kempton Park";
  if (normalized.includes("tembisa") || normalized.includes("thembisa")) return "Tembisa";
  if (normalized.includes("johannesburg") || normalized.includes("joburg")) return "Johannesburg";
  if (normalized.includes("pretoria") || normalized.includes("tshwane")) return "Pretoria";
  if (normalized.includes("cape town")) return "Cape Town";
  
  return cityName ? cityName.charAt(0).toUpperCase() + cityName.slice(1) : "Tembisa";
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

  // Remove administrative/governmental clutter, province, and country codes
  let clean = rawAddress
    .replace(/,?\s*South Africa/gi, "")
    .replace(/,?\s*ZA\b/gi, "")
    .replace(/,?\s*GP\b/gi, "")
    .replace(/,?\s*Gauteng/gi, "")
    .replace(/,?\s*City of [^,]+ Metropolitan Municipality/gi, "")
    .replace(/,?\s*[^,]+ Metropolitan Municipality/gi, "")
    .replace(/,?\s*Local Municipality/gi, "")
    .replace(/,?\s*[^,]+ Ward \d+/gi, "")
    .replace(/,?\s*Ward \d+/gi, "")
    .replace(/,?\s*Region [A-Z0-9]+/gi, "")
    .replace(/,?\s*Subregion [A-Z0-9]+/gi, "")
    .trim();

  // Extract 4-digit postal code if present
  const zipMatch = clean.match(/\b\d{4}\b/);
  const postalCode = zipMatch ? zipMatch[0] : "";

  // Remove standalone postal code numbers from main street/suburb text
  clean = clean.replace(/,?\s*\b\d{4}\b/g, "").trim();

  // Clean up duplicate commas, extra spaces, and filter empty parts
  const parts = clean
    .split(",")
    .map((s) => s.trim())
    .filter((s, idx, arr) => s.length > 0 && arr.indexOf(s) === idx);

  clean = parts.join(", ");

  let city = defaultCity;
  const lowerClean = clean.toLowerCase();
  if (lowerClean.includes("kaalfontein") || lowerClean.includes("eboni") || lowerClean.includes("ebony")) {
    city = "Kaalfontein";
  } else if (lowerClean.includes("ivory park") || lowerClean.includes("kopanong")) {
    city = "Ivory Park";
  } else if (lowerClean.includes("clayville")) {
    city = "Clayville";
  } else if (lowerClean.includes("rabie ridge") || lowerClean.includes("rabie")) {
    city = "Rabie Ridge";
  } else if (lowerClean.includes("midrand")) {
    city = "Midrand";
  } else if (lowerClean.includes("kempton park") || lowerClean.includes("kempton")) {
    city = "Kempton Park";
  } else if (lowerClean.includes("tembisa") || lowerClean.includes("thembisa")) {
    city = "Tembisa";
  } else {
    city = getSupportedCity(clean);
  }

  const formattedAddress = clean || rawAddress;

  return {
    formattedAddress,
    city,
    postalCode,
  };
};

export const shortenAddress = (address: string, maxParts = 2): string => {
  if (!address) return "";
  const parsed = parseAndNormalizeZAAddress(address);
  const parts = parsed.formattedAddress.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= maxParts) return parts.join(", ");
  return parts.slice(0, maxParts).join(", ");
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

// --- South African Suburb & Section Fuzzy Search Helper ---
export interface ZAAddressAliasSuggestion {
  alias: string;
  canonicalSuburb: string;
  city: string;
  province: string;
  postalCode: string;
  score: number;
  formattedSuggestion: string;
}

export const ZA_SUBURB_DICTIONARY: Array<{
  alias: string;
  canonicalSuburb: string;
  city: string;
  province: string;
  postalCode: string;
  keywords: string[];
}> = [
  {
    alias: "Hospital View",
    canonicalSuburb: "Hospital View, Tembisa",
    city: "Tembisa",
    province: "Gauteng",
    postalCode: "1632",
    keywords: ["hospital", "view", "tembisa", "thembisa", "hospitall", "hospitaal"],
  },
  {
    alias: "Winnie Mandela",
    canonicalSuburb: "Winnie Mandela Park, Tembisa",
    city: "Tembisa",
    province: "Gauteng",
    postalCode: "1632",
    keywords: ["winnie", "mandela", "park", "tembisa", "thembisa", "winny"],
  },
  {
    alias: "Esangweni",
    canonicalSuburb: "Esangweni, Tembisa",
    city: "Tembisa",
    province: "Gauteng",
    postalCode: "1632",
    keywords: ["esangweni", "sangweni", "tembisa", "thembisa", "isangweni"],
  },
  {
    alias: "Oakmoor",
    canonicalSuburb: "Oakmoor Station, Tembisa",
    city: "Tembisa",
    province: "Gauteng",
    postalCode: "1632",
    keywords: ["oakmoor", "oakmor", "station", "tembisa", "thembisa"],
  },
  {
    alias: "Phomolong",
    canonicalSuburb: "Phomolong, Tembisa",
    city: "Tembisa",
    province: "Gauteng",
    postalCode: "1632",
    keywords: ["phomolong", "fomolong", "phomong", "tembisa", "thembisa"],
  },
  {
    alias: "Sethokga",
    canonicalSuburb: "Sethokga, Tembisa",
    city: "Tembisa",
    province: "Gauteng",
    postalCode: "1632",
    keywords: ["sethokga", "setokga", "tembisa", "thembisa"],
  },
  {
    alias: "Rabasotho",
    canonicalSuburb: "Rabasotho, Tembisa",
    city: "Tembisa",
    province: "Gauteng",
    postalCode: "1632",
    keywords: ["rabasotho", "rabasoto", "hall", "tembisa"],
  },
  {
    alias: "Makhulong",
    canonicalSuburb: "Makhulong, Tembisa",
    city: "Tembisa",
    province: "Gauteng",
    postalCode: "1632",
    keywords: ["makhulong", "makulong", "stadium", "tembisa"],
  },
  {
    alias: "Ebony Park",
    canonicalSuburb: "Ebony Park, Kaalfontein",
    city: "Kaalfontein",
    province: "Gauteng",
    postalCode: "1632",
    keywords: ["ebony", "park", "eboni", "ebonipark", "kaalfontein"],
  },
  {
    alias: "Kaalfontein",
    canonicalSuburb: "Kaalfontein Ext 1-7",
    city: "Kaalfontein",
    province: "Gauteng",
    postalCode: "1632",
    keywords: ["kaalfontein", "kalfontein", "kaal", "fontein"],
  },
  {
    alias: "Ivory Park Ext 2",
    canonicalSuburb: "Ivory Park Extension 2",
    city: "Ivory Park",
    province: "Gauteng",
    postalCode: "1689",
    keywords: ["ivory", "park", "ext", "2", "kopanong", "midrand"],
  },
  {
    alias: "Ivory Park Ext 3",
    canonicalSuburb: "Ivory Park Extension 3",
    city: "Ivory Park",
    province: "Gauteng",
    postalCode: "1689",
    keywords: ["ivory", "park", "ext", "3", "kopanong", "midrand"],
  },
  {
    alias: "Rabie Ridge",
    canonicalSuburb: "Rabie Ridge",
    city: "Midrand",
    province: "Gauteng",
    postalCode: "1619",
    keywords: ["rabie", "ridge", "rabi", "midrand"],
  },
  {
    alias: "Clayville",
    canonicalSuburb: "Clayville Industrial, Olifantsfontein",
    city: "Tembisa",
    province: "Gauteng",
    postalCode: "1666",
    keywords: ["clayville", "olifantsfontein", "industrial", "clay"],
  },
  {
    alias: "Birch Acres",
    canonicalSuburb: "Birch Acres, Kempton Park",
    city: "Tembisa",
    province: "Gauteng",
    postalCode: "1618",
    keywords: ["birch", "acres", "kempton", "park"],
  },
  {
    alias: "Chloorkop",
    canonicalSuburb: "Chloorkop, Kempton Park",
    city: "Tembisa",
    province: "Gauteng",
    postalCode: "1624",
    keywords: ["chloorkop", "chlorkop", "kempton"],
  },
  {
    alias: "Vorna Valley",
    canonicalSuburb: "Vorna Valley, Midrand",
    city: "Ivory Park",
    province: "Gauteng",
    postalCode: "1686",
    keywords: ["vorna", "valley", "midrand", "mall", "of", "africa"],
  },
  {
    alias: "Halfway House",
    canonicalSuburb: "Halfway House, Midrand",
    city: "Ivory Park",
    province: "Gauteng",
    postalCode: "1685",
    keywords: ["halfway", "house", "midrand"],
  },
  {
    alias: "Alexandra",
    canonicalSuburb: "Alexandra, Sandton",
    city: "Tembisa",
    province: "Gauteng",
    postalCode: "2090",
    keywords: ["alexandra", "alex", "sandton", "wynberg"],
  },
];

export function getLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function getZASuburbFuzzyMatches(
  query: string,
  limit: number = 4
): ZAAddressAliasSuggestion[] {
  if (!query || query.trim().length < 2) return [];

  const normQuery = query.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
  const queryTokens = normQuery.split(/\s+/).filter(Boolean);

  const results: Array<ZAAddressAliasSuggestion> = [];

  for (const entry of ZA_SUBURB_DICTIONARY) {
    let matchScore = 0;
    const entryAliasNorm = entry.alias.toLowerCase();

    if (entryAliasNorm.includes(normQuery) || normQuery.includes(entryAliasNorm)) {
      matchScore += 0.8;
    }

    for (const token of queryTokens) {
      if (entry.keywords.some((kw) => kw.includes(token) || token.includes(kw))) {
        matchScore += 0.4;
      }
      for (const kw of entry.keywords) {
        if (Math.abs(kw.length - token.length) <= 2) {
          const dist = getLevenshteinDistance(token, kw);
          if (dist === 1) matchScore += 0.3;
          else if (dist === 2) matchScore += 0.15;
        }
      }
    }

    if (matchScore > 0.3) {
      results.push({
        alias: entry.alias,
        canonicalSuburb: entry.canonicalSuburb,
        city: entry.city,
        province: entry.province,
        postalCode: entry.postalCode,
        score: matchScore,
        formattedSuggestion: `${entry.canonicalSuburb}, ${entry.city}, Gauteng, South Africa`,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .filter((v, idx, self) => self.findIndex((t) => t.alias === v.alias) === idx)
    .slice(0, limit);
}
