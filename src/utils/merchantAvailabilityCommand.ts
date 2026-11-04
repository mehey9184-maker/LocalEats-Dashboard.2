export type AvailabilityShopLike = {
  id?: string | number;
  is_active?: boolean | null;
  availability_revision?: number | null;
};

export type AvailabilityCommandResult = {
  success: boolean;
  error?: string;
  freshShop?: AvailabilityShopLike | null;
  conflict?: boolean;
};

export type AvailabilityDiagnostic = {
  outcome: string;
  shopId: string;
  requestedOpen?: boolean;
  expectedRevision?: number | null;
  savedRevision?: number | null;
  code?: string;
};

type PendingAvailabilityCommand = {
  shopId: string;
  requestedOpen: boolean;
  promise: Promise<AvailabilityCommandResult>;
};

type Listener = () => void;

let pending: PendingAvailabilityCommand | null = null;
const listeners = new Set<Listener>();
const diagnostics: AvailabilityDiagnostic[] = [];

function notify(): void {
  for (const listener of listeners) listener();
}

export function availabilityRevisionOf(shop: AvailabilityShopLike | null | undefined): number | null {
  if (!shop) return null;
  const revision = Number(shop.availability_revision);
  if (!Number.isSafeInteger(revision) || revision < 0) return null;
  return revision;
}

export function shouldAcceptAvailabilityShop(
  current: AvailabilityShopLike | null | undefined,
  incoming: AvailabilityShopLike | null | undefined,
): boolean {
  if (!incoming || incoming.id === null || incoming.id === undefined) return false;
  const incomingRevision = availabilityRevisionOf(incoming);
  if (incomingRevision === null) return false;
  if (!current || String(current.id) !== String(incoming.id)) return true;
  const currentRevision = availabilityRevisionOf(current);
  if (currentRevision === null) return true;
  return incomingRevision >= currentRevision;
}

export function isSavedAvailabilityRevisionCurrent(expectedRevision: number, saved: AvailabilityShopLike | null | undefined): boolean {
  const savedRevision = availabilityRevisionOf(saved);
  return savedRevision !== null && savedRevision > expectedRevision;
}

export function logAvailabilityDiagnostic(entry: AvailabilityDiagnostic): void {
  const safeEntry: AvailabilityDiagnostic = {
    outcome: String(entry.outcome).slice(0, 40),
    shopId: String(entry.shopId).slice(0, 80),
    requestedOpen: typeof entry.requestedOpen === "boolean" ? entry.requestedOpen : undefined,
    expectedRevision: Number.isSafeInteger(entry.expectedRevision) ? entry.expectedRevision : null,
    savedRevision: Number.isSafeInteger(entry.savedRevision) ? entry.savedRevision : null,
    code: typeof entry.code === "string" && /^[A-Z0-9_]{1,64}$/.test(entry.code) ? entry.code : undefined,
  };
  diagnostics.push(safeEntry);
  if (diagnostics.length > 20) diagnostics.shift();
  console.info("[availability]", {
    outcome: safeEntry.outcome,
    shopId: safeEntry.shopId,
    requestedOpen: safeEntry.requestedOpen,
    expectedRevision: safeEntry.expectedRevision ?? null,
    savedRevision: safeEntry.savedRevision ?? null,
    code: safeEntry.code,
  });
}

export function readAvailabilityDiagnostics(): AvailabilityDiagnostic[] {
  return diagnostics.slice();
}

export function clearAvailabilityDiagnostics(): void {
  diagnostics.length = 0;
}

export function isAvailabilityCommandPending(shopId?: string | number): boolean {
  if (!pending) return false;
  if (shopId === undefined) return true;
  return pending.shopId === String(shopId);
}

export function subscribeAvailabilityCommand(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function runExclusiveAvailabilityCommand(
  shopId: string | number,
  requestedOpen: boolean,
  execute: () => Promise<AvailabilityCommandResult>,
): Promise<AvailabilityCommandResult> {
  const id = String(shopId);
  if (pending) {
    if (pending.shopId === id && pending.requestedOpen === requestedOpen) {
      logAvailabilityDiagnostic({
        outcome: "duplicate_joined",
        shopId: id,
        requestedOpen,
      });
      return pending.promise;
    }
    logAvailabilityDiagnostic({
      outcome: "duplicate_rejected",
      shopId: id,
      requestedOpen,
      code: "AVAILABILITY_PENDING",
    });
    return Promise.resolve({
      success: false,
      error: "Availability is already updating. Wait for the server result.",
    });
  }

  const promise = execute().finally(() => {
    if (pending?.promise === promise) {
      pending = null;
      notify();
    }
  });
  pending = { shopId: id, requestedOpen, promise };
  notify();
  return promise;
}

export function resetAvailabilityCommandForTests(): void {
  pending = null;
  listeners.clear();
  clearAvailabilityDiagnostics();
}
