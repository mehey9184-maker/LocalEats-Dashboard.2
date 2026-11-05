import { OrderContractError } from "./orderContract.js";
import type { StoredOrder } from "./orderService.js";

/**
 * A bounded recovery read for the authenticated merchant inbox.
 * The recent 250 rows are useful history, but must never be treated as a
 * guarantee that all unfinished orders are present. A separate paged scan
 * retrieves older unfinished orders. The server rejects unsafe partial reads.
 */
export const MERCHANT_INBOX_RECENT_LIMIT = 250;
export const MERCHANT_INBOX_PAGE_SIZE = 250;
export const MERCHANT_INBOX_MAX_OPEN = 1000;

// Applied as a literal PostgREST filter (never interpolates client input).
// Unknown/null statuses are intentionally considered unfinished, not hidden.
export const MERCHANT_UNFINISHED_FILTER =
  "status.is.null,status.not.in.(cancelled,collected,delivered,completed)";

export interface MerchantInboxSource {
  recent(): Promise<StoredOrder[]>;
  unfinishedPage(start: number, endInclusive: number): Promise<StoredOrder[]>;
}

const ensureRows = (
  input: unknown,
  ownedShopIds: ReadonlySet<string>,
  maximum: number,
): StoredOrder[] => {
  if (!Array.isArray(input) || input.length > maximum) {
    throw new OrderContractError(503, "MERCHANT_INBOX_INCOMPLETE", "The merchant order inbox could not be completely verified.");
  }
  for (const row of input as StoredOrder[]) {
    if (!row || typeof row !== "object" || !row.id || row.shop_id == null ||
      !ownedShopIds.has(String(row.shop_id))) {
      // Never send another shop's order to a merchant, even if an upstream
      // row filter or test double behaves unexpectedly.
      throw new OrderContractError(503, "MERCHANT_INBOX_SCOPE_ERROR", "The merchant order inbox could not be verified.");
    }
  }
  return input as StoredOrder[];
};

export async function readCompleteMerchantInbox(
  source: MerchantInboxSource,
  shopIds: readonly string[],
): Promise<StoredOrder[]> {
  if (!shopIds.length || shopIds.some(id => !id)) {
    throw new OrderContractError(503, "MERCHANT_INBOX_SCOPE_ERROR", "Verified shop ownership is required.");
  }
  const allowed = new Set(shopIds);
  // Historical view remains capped and backward-compatible, but is not the
  // source of truth for orders that are still open.
  const recent = ensureRows(await source.recent(), allowed, MERCHANT_INBOX_RECENT_LIMIT);
  const all = new Map<string, StoredOrder>(recent.map(row => [row.id, row]));

  for (let offset = 0; offset <= MERCHANT_INBOX_MAX_OPEN; offset += MERCHANT_INBOX_PAGE_SIZE) {
    const end = offset === MERCHANT_INBOX_MAX_OPEN
      ? offset // One-row sentinel: fail closed if the bound was exceeded.
      : offset + MERCHANT_INBOX_PAGE_SIZE - 1;
    const page = ensureRows(await source.unfinishedPage(offset, end), allowed,
      end - offset + 1);
    if (offset === MERCHANT_INBOX_MAX_OPEN) {
      if (page.length) {
        throw new OrderContractError(503, "MERCHANT_INBOX_CAPACITY_REVIEW",
          "Too many unfinished orders to verify safely. The complete order inbox is temporarily unavailable.");
      }
      break;
    }
    // Unfinished records take precedence over possibly stale recent copies.
    for (const row of page) all.set(row.id, row);
    if (page.length < MERCHANT_INBOX_PAGE_SIZE) break;
  }

  return [...all.values()].sort((a, b) => {
    const byDate = String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
    return byDate || String(b.id).localeCompare(String(a.id));
  });
}
