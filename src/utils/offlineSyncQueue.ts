// LocalEats Service Worker Offline Sync Queue
// Stores offline order updates & inventory modifications in IndexedDB
// Automatically syncs when network connectivity returns via SW Background Sync

import { SupabaseClient } from "@supabase/supabase-js";

export interface OfflineMutation {
  id: string;
  type: "UPDATE_ORDER" | "UPDATE_MENU" | "UPDATE_STOCK";
  payload: Record<string, unknown>;
  timestamp: string;
  retryCount: number;
}

const DB_NAME = "localeats_offline_sync_db";
const STORE_NAME = "pending_mutations";

export function initOfflineSyncDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueOfflineMutation(
  mutation: Omit<OfflineMutation, "id" | "timestamp" | "retryCount">
): Promise<void> {
  try {
    const db = await initOfflineSyncDb();
    const item: OfflineMutation = {
      ...mutation,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    console.log(`[OfflineSyncQueue] Queued mutation (${item.type}):`, item.id);

    // Dispatch event so ConnectivityMonitor & headers update pending count immediately
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("offline_queue_updated"));
    }

    // Register SW Background Sync if available
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      const reg = await navigator.serviceWorker.ready;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((reg as any).sync) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (reg as any).sync.register("sync-offline-updates");
      }
    }
  } catch (err) {
    console.error("[OfflineSyncQueue] Failed to queue mutation:", err);
  }
}

export async function getQueuedMutations(): Promise<OfflineMutation[]> {
  try {
    const db = await initOfflineSyncDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as OfflineMutation[]);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[OfflineSyncQueue] Error getting queued items:", err);
    return [];
  }
}

export async function removeQueuedMutation(id: string): Promise<void> {
  try {
    const db = await initOfflineSyncDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("offline_queue_updated"));
    }
  } catch (err) {
    console.error(`[OfflineSyncQueue] Error removing item ${id}:`, err);
  }
}

export async function processOfflineSyncQueue(supabase: SupabaseClient): Promise<number> {
  if (!navigator.onLine) {
    console.log("[OfflineSyncQueue] Browser is offline. Delaying sync.");
    return 0;
  }

  const mutations = await getQueuedMutations();
  if (mutations.length === 0) return 0;

  console.log(`[OfflineSyncQueue] Synchronizing ${mutations.length} pending mutations...`);
  let syncedCount = 0;

  for (const item of mutations) {
    try {
      if (item.type === "UPDATE_ORDER") {
        const { id, status, delivery_status, cancellation_reason } = item.payload;
        const updateObj: Record<string, unknown> = {};
        if (status) updateObj.status = status;
        if (delivery_status !== undefined) updateObj.delivery_status = delivery_status;
        if (cancellation_reason) updateObj.cancellation_reason = cancellation_reason;

        const { error } = await supabase.from("orders").update(updateObj).eq("id", id);
        if (!error) {
          await removeQueuedMutation(item.id);
          syncedCount++;
        }
      } else if (item.type === "UPDATE_MENU" || item.type === "UPDATE_STOCK") {
        const { id, is_available, stock_quantity, price } = item.payload;
        const updateObj: Record<string, unknown> = {};
        if (typeof is_available === "boolean") updateObj.is_available = is_available;
        if (typeof stock_quantity === "number") updateObj.stock_quantity = stock_quantity;
        if (typeof price === "number") updateObj.price = price;

        const { error } = await supabase.from("products").update(updateObj).eq("id", id);
        if (!error) {
          await removeQueuedMutation(item.id);
          syncedCount++;
        }
      }
    } catch (err) {
      console.error(`[OfflineSyncQueue] Sync failed for ${item.id}:`, err);
    }
  }

  console.log(`[OfflineSyncQueue] Successfully synchronized ${syncedCount} offline operations.`);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("offline_queue_updated"));
  }
  return syncedCount;
}
