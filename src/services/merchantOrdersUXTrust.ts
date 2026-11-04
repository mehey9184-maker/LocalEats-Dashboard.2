import type { MerchantOrderReadState } from "./merchantDashboardFreshness";

export type MerchantOrdersConfidence = "checking" | "verified" | "stale" | "unavailable";

/**
 * Whether order counts can be presented as current. Never infer an empty queue
 * from an unverified shop or an API failure.
 */
export function merchantOrdersConfidence(
  state: MerchantOrderReadState,
  verifiedAt: number | null | undefined,
  now: number = Date.now(),
): MerchantOrdersConfidence {
  if (state === "checking") return "checking";
  if (state === "unavailable") return typeof verifiedAt === "number" && Number.isFinite(verifiedAt) ? "stale" : "unavailable";
  if (state !== "confirmed" || typeof verifiedAt !== "number" || !Number.isFinite(verifiedAt) ||
      !Number.isFinite(now) || verifiedAt > now) return "unavailable";
  return now - verifiedAt > 90_000 ? "stale" : "verified";
}

export function merchantOrdersEmptyMessage(
  confidence: MerchantOrdersConfidence,
  view: "active" | "history",
  filtersApplied: boolean,
): { title: string; description: string } {
  if (confidence === "checking") return {
    title: "Checking orders…",
    description: "We're verifying the latest orders. An empty queue has not been confirmed.",
  };
  if (confidence === "unavailable") return {
    title: "Orders unavailable",
    description: "We couldn't verify orders from the API. Your shop's order count is unknown until a successful refresh.",
  };
  if (confidence === "stale") return {
    title: "Latest orders not verified",
    description: "Previously loaded records may be out of date. Refresh to check the current queue.",
  };
  if (filtersApplied) return {
    title: "No matching orders",
    description: "The latest verified list has no orders matching your filters. Clear filters to see the full list.",
  };
  return view === "active" ? {
    title: "No current orders",
    description: "No active orders were found in the latest verified API response. Check again for new orders.",
  } : {
    title: "No order history in this list",
    description: "No completed or cancelled orders were found in the latest verified API response.",
  };
}
