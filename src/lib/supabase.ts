import {projectCachedMerchantSession} from "./merchantSessionMetadata";
import type { User } from "../types";
import {legacyOrderWriteError} from "./legacyOrderWrite";
/**
 * Firestore Compatibility & Migration Bridge
 * 
 * This module seamlessly adapts Supabase-style query chaining (.from(...).select(...).eq(...))
 * to read-only Firestore queries and subscriptions, plus Firebase Auth.
 * Generic mutations fail closed; business persistence requires the LocalEats API.
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  Unsubscribe
} from "firebase/firestore";
import { db, auth, firebaseSignIn, firebaseSignUp, firebaseSignOutUser, firebaseResetPassword } from "./firebase";

export const DASHBOARD_URL = typeof window !== 'undefined' ? window.location.origin : 'https://localeats.co.za';

export const isSupabaseMocked = () => false;

interface QueryFilter {
  field: string;
  op: "==" | "!=" | "<" | "<=" | ">" | ">=" | "in";
  value: unknown;
}

class FirestoreQueryBuilder {
  private collectionName: string;
  private filters: QueryFilter[] = [];
  private orderField?: string;
  private orderDirection?: "asc" | "desc";
  private limitCount?: number;
  private updateData?: Record<string, unknown>;
  private insertData?: Record<string, unknown> | Record<string, unknown>[];
  private isDelete = false;
  private isSingle = false;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  select(_columns?: string, _options?: Record<string, unknown>) {
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, op: "==", value });
    return this;
  }

  neq(field: string, value: unknown) {
    this.filters.push({ field, op: "!=", value });
    return this;
  }

  gt(field: string, value: unknown) {
    this.filters.push({ field, op: ">", value });
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push({ field, op: ">=", value });
    return this;
  }

  lt(field: string, value: unknown) {
    this.filters.push({ field, op: "<", value });
    return this;
  }

  lte(field: string, value: unknown) {
    this.filters.push({ field, op: "<=", value });
    return this;
  }

  is(field: string, value: unknown) {
    if (value === null) {
      this.filters.push({ field, op: "==", value: null });
    } else {
      this.filters.push({ field, op: "==", value });
    }
    return this;
  }

  not(field: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) {
      this.filters.push({ field, op: "!=", value: null });
    } else if (operator === "eq") {
      this.filters.push({ field, op: "!=", value });
    } else if (operator === "in" && Array.isArray(value)) {
      this.filters.push({ field, op: "!=", value: value[0] });
    } else {
      this.filters.push({ field, op: "!=", value });
    }
    return this;
  }

  filter(field: string, operator: string, value: unknown) {
    const opMap: Record<string, "==" | "!=" | "<" | "<=" | ">" | ">=" | "in"> = {
      eq: "==",
      neq: "!=",
      gt: ">",
      gte: ">=",
      lt: "<",
      lte: "<=",
      in: "in",
    };
    const mappedOp = opMap[operator] || "==";
    this.filters.push({ field, op: mappedOp, value });
    return this;
  }

  range(from: number, to: number) {
    this.limitCount = Math.max(1, to - from + 1);
    return this;
  }

  single() {
    this.limitCount = 1;
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.limitCount = 1;
    this.isSingle = true;
    return this;
  }

  csv() {
    return this;
  }

  ilike(field: string, value: string) {
    // Standard mock case-insensitive/prefix filter
    const cleanVal = typeof value === "string" ? value.replace(/%/g, "").toLowerCase().trim() : String(value);
    this.filters.push({ field, op: "==", value: cleanVal });
    return this;
  }

  like(field: string, value: string) {
    const cleanVal = typeof value === "string" ? value.replace(/%/g, "").trim() : String(value);
    this.filters.push({ field, op: "==", value: cleanVal });
    return this;
  }

  or(filtersString: string) {
    // In Supabase .or("owner_id.eq.xxx,email.ilike.yyy")
    // Parse the conditions and push them gracefully
    try {
      const parts = filtersString.split(",");
      for (const part of parts) {
        const [field, op, val] = part.split(".");
        if (field && val) {
          const cleanVal = val.replace(/%/g, "").trim();
          this.filters.push({ field, op: op === "neq" ? "!=" : "==", value: cleanVal });
        }
      }
    } catch {
      // ignore
    }
    return this;
  }

  in(field: string, values: unknown[]) {
    if (values && values.length > 0) {
      // Limit to 10 for Firestore 'in' limitation
      this.filters.push({ field, op: "in", value: values.slice(0, 10) });
    }
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderDirection = options?.ascending === false ? "desc" : "asc";
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  update(data: Record<string, unknown>) {
    this.updateData = data;
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]) {
    this.insertData = data;
    return this;
  }

  upsert(data: Record<string, unknown> | Record<string, unknown>[]) {
    this.insertData = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  private async execute(): Promise<{ data: unknown; error: unknown; count?: number }> {
    if(this.collectionName === "orders" && (this.insertData !== undefined || this.updateData !== undefined || this.isDelete)) {
      return {data:null,error:legacyOrderWriteError()};
    }
    if (this.insertData !== undefined || this.updateData !== undefined || this.isDelete) {
      return {data:null,error:new Error("This change requires the verified LocalEats API. No changes were saved.")};
    }
    try {
      const collRef = collection(db, this.collectionName);

      // SELECT / QUERY
      // Check if it's a single document get by id
      const idFilter = this.filters.find(f => f.field === "id" && f.op === "==");
      if (idFilter && this.filters.length === 1 && !this.orderField) {
        const docRef = doc(db, this.collectionName, String(idFilter.value));
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const item = { ...docSnap.data(), id: docSnap.data().id ?? docSnap.id };
          return { data: [item], count: 1, error: null };
        }
        return { data: [], count: 0, error: null };
      }

      let q = query(collRef);
      for (const f of this.filters) {
        // Handle numeric vs string matching gracefully
        if (f.op === "==" && typeof f.value === "number") {
          q = query(q, where(f.field, "in", [f.value, String(f.value)]));
        } else {
          q = query(q, where(f.field, f.op, f.value));
        }
      }

      if (this.orderField) {
        q = query(q, orderBy(this.orderField, this.orderDirection || "asc"));
      }

      if (this.limitCount) {
        q = query(q, limit(this.limitCount));
      }

      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ ...d.data(), id: d.data().id ?? d.id }));
      if (this.isSingle) {
        return { data: data[0] || null, count: data.length > 0 ? 1 : 0, error: null };
      }
      return { data, count: snap.size, error: null };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Firestore Bridge] Query on "${this.collectionName}" returned notice:`, errorMsg);
      return { data: [], count: 0, error: err };
    }
  }

  // Support Promise thenable
  then(onFulfilled?: (value: { data: unknown; error: unknown; count?: number }) => unknown, onRejected?: (reason: unknown) => unknown) {
    return this.execute().then(onFulfilled, onRejected);
  }

  catch(onRejected?: (reason: unknown) => unknown) {
    return this.execute().catch(onRejected);
  }
}

/**
 * Realtime Firestore Channel Subscription Adapter
 */
class FirestoreChannelAdapter {
  private channelName: string;
  private unsubscribers: Unsubscribe[] = [];

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  on(_event: string, schemaOptions: Record<string, unknown>, callback: (payload: unknown) => void) {
    try {
      const targetTable = (schemaOptions?.table as string) || "orders";
      const collRef = collection(db, targetTable);
      let queryRef: import("firebase/firestore").Query | import("firebase/firestore").CollectionReference = collRef;

      // Translate supabase filter string (e.g., "shop_id=eq.18") to Firestore where clause
      if (schemaOptions?.filter && typeof schemaOptions.filter === "string") {
        const filterStr = schemaOptions.filter;
        if (filterStr.includes("=eq.")) {
          const [field, val] = filterStr.split("=eq.");
          if (field && val) {
            // Need to match both string and numeric types if it could be a shop ID
            const numVal = Number(val);
            if (!isNaN(numVal)) {
              queryRef = query(collRef, where(field, "in", [val, numVal, String(numVal)]));
            } else {
              queryRef = query(collRef, where(field, "==", val));
            }
          }
        }
      }

      const unsub = onSnapshot(queryRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          callback({
            eventType: change.type === "added" ? "INSERT" : change.type === "modified" ? "UPDATE" : "DELETE",
            new: change.doc.data(),
            old: change.doc.data(),
          });
        });
      }, (err) => {
        console.debug(`[Firestore Realtime] Channel ${this.channelName} notice:`, err);
      });
      this.unsubscribers.push(unsub);
    } catch (e) {
      console.debug("[Firestore Realtime] Error setting up listener:", e);
    }
    return this;
  }

  subscribe(statusCallback?: (status: string) => void) {
    if (statusCallback) {
      setTimeout(() => statusCallback("SUBSCRIBED"), 50);
    }
    return this;
  }

  unsubscribe() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}

export const supabase = {
  from(collectionName: string) {
    return new FirestoreQueryBuilder(collectionName);
  },

  channel(channelName: string) {
    return new FirestoreChannelAdapter(channelName);
  },

  getChannels() {
    return [];
  },

  removeChannel(ch: { unsubscribe?: () => void }) {
    if (ch && typeof ch.unsubscribe === "function") {
      ch.unsubscribe();
    }
  },

  rpc() {
    return Promise.resolve({ data: null, error: new Error("RPC is unavailable in the legacy bridge. No changes were saved.") });
  },

  auth: {
    async getSession() {
      const cached = localStorage.getItem("localeats_user_session");
      if (cached) {
        try {
          const user = projectCachedMerchantSession(JSON.parse(cached));
          if (user) return { data: { session: { user, access_token: "firebase-token" } }, error: null };
        } catch {
          // ignore
        }
      }
      const currentUser = auth.currentUser;
      if (currentUser) {
        const user = {
          id: currentUser.uid,
          email: currentUser.email,
          user_metadata: { full_name: currentUser.displayName || "Merchant" }
        };
        return { data: { session: { user, access_token: "firebase-token" } }, error: null };
      }
      return { data: { session: null }, error: null };
    },

    async getUser() {
      const currentUser = auth.currentUser;
      if (currentUser) {
        return { data: { user: { id: currentUser.uid, email: currentUser.email } }, error: null };
      }
      const cached = localStorage.getItem("localeats_user_session");
      if (cached) {
        try {
          return { data: { user: projectCachedMerchantSession(JSON.parse(cached)) }, error: null };
        } catch {
          // ignore
        }
      }
      return { data: { user: null }, error: null };
    },

    onAuthStateChange(callback: (event: string, session: { user: User } | null) => void) {
      const unsub = auth.onAuthStateChanged((fbUser) => {
        if (fbUser) {
          const session = {
            user: {
              id: fbUser.uid,
              email: fbUser.email,
              user_metadata: { full_name: fbUser.displayName || "Merchant" }
            },
            access_token: "firebase-token"
          };
          callback("SIGNED_IN", session);
        } else {
          callback("SIGNED_OUT", null);
        }
      });
      return { data: { subscription: { unsubscribe: unsub } } };
    },

    async signInWithPassword({ email, password }: { email: string; password: string }) {
      try {
        const user = await firebaseSignIn(email, password);
        return { data: { user }, error: null };
      } catch (err: unknown) {
        return { data: null, error: err };
      }
    },

    async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { full_name?: string; phone?: string } } }) {
      try {
        const user = await firebaseSignUp(email, password, {
          full_name: options?.data?.full_name,
          phone: options?.data?.phone,
        });
        return { data: { user }, error: null };
      } catch (err: unknown) {
        return { data: null, error: err };
      }
    },

    async signOut() {
      await firebaseSignOutUser();
      return { error: null };
    },

    async resetPasswordForEmail(email: string) {
      try {
        await firebaseResetPassword(email);
        return { data: {}, error: null };
      } catch (err: unknown) {
        return { data: null, error: err };
      }
    },

    // No authoritative profile-write endpoint exists in this legacy bridge.
    // Never report a successful save while no server persistence occurred.
    async updateUser(attributes?: Record<string, unknown>): Promise<{ data: { user: User | null }; error: Error }> {
      void attributes;
      return {
        data: { user: null },
        error: new Error("Profile updates are unavailable until the verified merchant API is connected. No changes were saved."),
      };
    },

    async verifyOtp() {
      return { data: { session: null }, error: null };
    },

    async resend() {
      return { data: {}, error: null };
    },

    async signInWithOAuth() {
      return { data: {}, error: null };
    },

    async refreshSession() {
      return { data: { session: null }, error: null };
    }
  },

  storage: {
    from() {
      return {
        getPublicUrl(_path: string) {
          void _path; // Retain the compatibility signature without fabricating a URL.
          return { data: { publicUrl: null } };
        },
        async upload(_path: string) {
          void _path; // Retain the compatibility signature without uploading.
          return { data: null, error: new Error("Storage upload requires the verified media service. No file was uploaded.") };
        }
      };
    }
  }
};

export const getSupabase = () => supabase;

export const getFreshChannel = (channelName: string) => {
  return new FirestoreChannelAdapter(channelName);
};
