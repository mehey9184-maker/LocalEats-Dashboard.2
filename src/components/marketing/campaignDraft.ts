import { validateMenuUrl } from "./counterSign";

type MenuSource = { id: string | number; shop_id?: string | number; name: string; price: number; is_available?: boolean };
export function menuSpotlight(shopName: string, url: string, item?: MenuSource): string {
  validateMenuUrl(url);
  const lead = item && Number.isFinite(Number(item.price)) && Number(item.price) >= 0
    ? `${item.name} · R${Number(item.price).toFixed(2)} at ${shopName}.`
    : `Find your next favourite at ${shopName}.`;
  return `${lead}\nBrowse our menu: ${url}\nPickup only. Pay at the shop when ordering is available.`;
}

export function marketingOrderSummary(orders: Record<string, unknown>[], shopId?: string | number) {
  const rows = shopId === undefined ? [] : orders.filter(row => String(row.shop_id) === String(shopId));
  const customers = new Map<string, number>();
  let knownValue = 0, priced = 0, paidValue = 0;
  for (const row of rows) {
    const identity = typeof row.user_id === "string" && row.user_id.trim() ? row.user_id : null;
    if (identity) customers.set(identity, (customers.get(identity) || 0) + 1);
    const raw = row.total_price ?? row.total;
    const amount = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
    if (Number.isFinite(amount) && amount >= 0) {
      knownValue += amount; priced++;
      if (row.payment_status === "paid") paidValue += amount;
    }
  }
  const repeatCount = [...customers.values()].filter(count => count > 1).length;
  return { totalOrders: rows.length, totalUniqueDiners: customers.size, repeatCount,
    repeatRate: customers.size ? Math.round(repeatCount / customers.size * 100) : 0,
    avgSpend: priced ? knownValue / priced : null, paidValue };
}
