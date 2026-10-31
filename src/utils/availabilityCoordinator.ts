/**
 * Merchant availability coordinator.
 *
 * Every Merchant availability control (header, banner, status selector, holiday mode,
 * dashboard and bulk switch) funnels through syncShopAvailability. This module gives all of
 * them the same three guarantees without changing any screen:
 *
 *  1. A shop snapshot older than one already seen (lower availability_revision) is rejected,
 *     so a slow read can never overwrite a newer saved state on screen.
 *  2. Only one availability command per shop is in flight at a time. A repeat of the same
 *     target joins the pending command (one API call); a different target is refused until
 *     the pending command finishes, so rapid clicks can never queue conflicting writes.
 *  3. Sanitised diagnostics record what was requested and what the server saved. Entries are
 *     built from an allow-list of primitive fields, so tokens, UIDs and customer data cannot
 *     be logged here even by mistake.
 *
 * The server stays the only authority: nothing here decides whether a shop is open.
 */

export interface AvailabilityShopSnapshot {
  id?: string | number | null;
  availability_revision?: number | string | null;
}

export interface AvailabilityDiagnostic {
  at: string;
  shopId: string;
  event: string;
  requestedOpen: boolean | null;
  expectedRevision: number | null;
  savedRevision: number | null;
  code: string | null;
  status: number | null;
}

export type ExclusiveOutcome<T> =
  | { kind: "ran"; result: T }
  | { kind: "joined"; result: T }
  | { kind: "busy" };

const MAX_DIAGNOSTICS = 50;
const knownRevisions = new Map<string, number>();
const latestSnapshots = new Map<string, AvailabilityShopSnapshot>();
const inFlight = new Map<string, { open: boolean; promise: Promise<unknown> }>();
const diagnostics: AvailabilityDiagnostic[] = [];

export function revisionOf(shop: AvailabilityShopSnapshot | null | undefined): number | null {
  if (!shop) return null;
  const raw = shop.availability_revision;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function knownRevision(shopId: string | number): number | undefined {
  return knownRevisions.get(String(shopId));
}

/** Remember the highest revision ever seen for a shop. Never lowers it. */
export function noteShopRevision(shop: AvailabilityShopSnapshot | null | undefined): void {
  if (!shop || shop.id === null || shop.id === undefined) return;
  const incoming = revisionOf(shop);
  if (incoming === null) return;
  const key = String(shop.id);
  const known = knownRevisions.get(key);
  if (known === undefined || incoming > known) knownRevisions.set(key, incoming);
  if (known === undefined || incoming >= known) latestSnapshots.set(key, shop);
}

/** The newest snapshot seen for a shop, used to replace a read that arrived late. */
export function latestKnownShop<T extends AvailabilityShopSnapshot>(shopId: string | number): T | undefined {
  return latestSnapshots.get(String(shopId)) as T | undefined;
}

/**
 * True only when the snapshot is provably older than one already seen. A snapshot with the
 * same revision is accepted (time-based expiry changes the effective state without a new
 * revision). A snapshot with no revision is accepted so older API responses still work.
 */
export function isStaleShopSnapshot(shop: AvailabilityShopSnapshot | null | undefined): boolean {
  if (!shop || shop.id === null || shop.id === undefined) return false;
  const incoming = revisionOf(shop);
  if (incoming === null) return false;
  const known = knownRevisions.get(String(shop.id));
  return known !== undefined && incoming < known;
}

/** Accept a snapshot unless stale. Returns whether it was accepted. */
export function acceptShopSnapshot(shop: AvailabilityShopSnapshot | null | undefined): boolean {
  if (isStaleShopSnapshot(shop)) {
    if (shop) {
      recordAvailabilityEvent({
        shopId: String(shop.id),
        event: "stale_snapshot_rejected",
        expectedRevision: knownRevision(shop.id as string | number) ?? null,
        savedRevision: revisionOf(shop),
      });
    }
    return false;
  }
  noteShopRevision(shop);
  return true;
}

export async function runExclusiveAvailability<T>(
  shopId: string | number,
  open: boolean,
  task: () => Promise<T>,
): Promise<ExclusiveOutcome<T>> {
  const key = String(shopId);
  const current = inFlight.get(key);
  if (current) {
    if (current.open === open) return { kind: "joined", result: (await current.promise) as T };
    return { kind: "busy" };
  }
  const promise = task();
  inFlight.set(key, { open, promise });
  try {
    return { kind: "ran", result: await promise };
  } finally {
    inFlight.delete(key);
  }
}

const asBoolean = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);
const asInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : null;

export function recordAvailabilityEvent(entry: {
  shopId: string | number;
  event: string;
  requestedOpen?: boolean | null;
  expectedRevision?: number | null;
  savedRevision?: number | null;
  code?: string | null;
  status?: number | null;
}): void {
  const safe: AvailabilityDiagnostic = {
    at: new Date().toISOString(),
    shopId: String(entry.shopId).slice(0, 80),
    event: String(entry.event).slice(0, 40),
    requestedOpen: asBoolean(entry.requestedOpen),
    expectedRevision: asInteger(entry.expectedRevision),
    savedRevision: asInteger(entry.savedRevision),
    code: typeof entry.code === "string" ? entry.code.slice(0, 64) : null,
    status: asInteger(entry.status),
  };
  diagnostics.push(safe);
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift();
  try {
    console.info("[availability]", JSON.stringify(safe));
  } catch {
    /* Diagnostics must never affect an availability result. */
  }
}

export function getAvailabilityDiagnostics(): AvailabilityDiagnostic[] {
  return diagnostics.slice();
}

/** Test helper only. */
export function resetAvailabilityCoordinatorForTests(): void {
  knownRevisions.clear();
  latestSnapshots.clear();
  inFlight.clear();
  diagnostics.length = 0;
}
