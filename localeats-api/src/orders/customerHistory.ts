import { OrderContractError } from "./orderContract.js";

export const CUSTOMER_HISTORY_PAGE_SIZE = 50;

export function customerHistoryBefore(query: Record<string, unknown>): string | null {
  const time = query.before_created_at;
  const id = query.before_id;
  if (time === undefined && id === undefined) return null;
  if (typeof time !== "string" || typeof id !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(time) ||
      !Number.isFinite(Date.parse(time)) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new OrderContractError(400, "INVALID_HISTORY_CURSOR", "Refresh order history before loading older orders.");
  }
  return `created_at.lt.${time},and(created_at.eq.${time},id.lt.${id})`;
}
