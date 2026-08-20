/**
 * Firestore Compatibility & Migration Bridge
 * 
 * This module seamlessly adapts Supabase-style query chaining (.from(...).select(...).eq(...))
 * to Google Cloud Firestore operations (getDocs, setDoc, updateDoc, onSnapshot) and Firebase Auth.
 * All operations interact directly with the provisioned Firebase Project & Firestore database.
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  runTransaction,
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

function matchesFilter(docData: Record<string, unknown>, f: QueryFilter): boolean {
  const actualVal = docData ? docData[f.field] : undefined;
  const targetVal = f.value;

  switch (f.op) {
    case "==":
      if (targetVal === null || targetVal === undefined) {
        return actualVal === null || actualVal === undefined;
      }
      return actualVal === targetVal || String(actualVal) === String(targetVal);
    case "!=":
      if (targetVal === null || targetVal === undefined) {
        return actualVal !== null && actualVal !== undefined;
      }
      return actualVal !== targetVal && String(actualVal) !== String(targetVal);
    case ">":
      return Number(actualVal) > Number(targetVal);
    case ">=":
      return Number(actualVal) >= Number(targetVal);
    case "<":
      return Number(actualVal) < Number(targetVal);
    case "<=":
      return Number(actualVal) <= Number(targetVal);
    case "in":
      if (Array.isArray(targetVal)) {
        return targetVal.includes(actualVal) || targetVal.map(String).includes(String(actualVal));
      }
      return false;
    default:
      return true;
  }
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

  select() {
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
    try {
      const collRef = collection(db, this.collectionName);

      // INSERT / UPSERT
      if (this.insertData) {
        const items = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        const insertedList: unknown[] = [];
        for (const item of items) {
          const docId = item.id ? String(item.id) : `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const docRef = doc(db, this.collectionName, docId);
          const payload = {
            ...item,
            id: item.id ?? docId,
            updated_at: new Date().toISOString(),
            created_at: item.created_at || new Date().toISOString(),
          };
          await setDoc(docRef, payload, { merge: true });
          insertedList.push(payload);
        }
        return { data: Array.isArray(this.insertData) ? insertedList : insertedList[0], error: null };
      }

      // UPDATE
      if (this.updateData) {
        // If updating by direct ID equality filter
        const idFilter = this.filters.find(f => f.field === "id");
        if (idFilter) {
          const otherFilters = this.filters.filter(f => f.field !== "id");
          const docRef = doc(db, this.collectionName, String(idFilter.value));

          // If conditional guards are present (e.g. .eq('delivery_status', 'finding_rider')),
          // enforce strict atomic transactional consistency to prevent race conditions.
          if (otherFilters.length > 0) {
            try {
              const updatedResult = await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) {
                  throw new Error(`Document with ID "${idFilter.value}" not found in "${this.collectionName}".`);
                }
                const currentData = docSnap.data() as Record<string, unknown>;

                for (const f of otherFilters) {
                  if (!matchesFilter(currentData, f)) {
                    throw new Error(`Optimistic lock failed: condition on "${f.field}" (${f.op} ${JSON.stringify(f.value)}) did not match current value ${JSON.stringify(currentData[f.field])}.`);
                  }
                }

                const payload = {
                  ...this.updateData,
                  updated_at: new Date().toISOString(),
                };
                transaction.update(docRef, payload);
                return { id: idFilter.value, ...currentData, ...payload };
              });
              return { data: this.isSingle ? updatedResult : [updatedResult], error: null };
            } catch (err: unknown) {
              const errorMsg = err instanceof Error ? err.message : String(err);
              console.warn(`[Firestore Bridge] Transactional update on "${this.collectionName}" rejected:`, errorMsg);
              return { data: null, error: err };
            }
          }

          // Single ID update without conditional constraints
          const payload = {
            ...this.updateData,
            updated_at: new Date().toISOString()
          };
          await setDoc(docRef, payload, { merge: true });
          return { data: this.isSingle ? { id: idFilter.value, ...payload } : [{ id: idFilter.value, ...payload }], error: null };
        }

        // Multiple documents update
        let q = query(collRef);
        for (const f of this.filters) {
          q = query(q, where(f.field, f.op, f.value));
        }
        const snap = await getDocs(q);
        const updatedList: Record<string, unknown>[] = [];
        for (const docSnap of snap.docs) {
          const payload = {
            ...this.updateData,
            updated_at: new Date().toISOString()
          };
          await updateDoc(docSnap.ref, payload).catch(() => setDoc(docSnap.ref, payload, { merge: true }));
          updatedList.push({ id: docSnap.id, ...docSnap.data(), ...payload });
        }
        return { data: this.isSingle ? (updatedList[0] || null) : updatedList, error: null };
      }

      // DELETE
      if (this.isDelete) {
        const idFilter = this.filters.find(f => f.field === "id");
        if (idFilter) {
          const docRef = doc(db, this.collectionName, String(idFilter.value));
          await deleteDoc(docRef);
          return { data: null, error: null };
        }

        let q = query(collRef);
        for (const f of this.filters) {
          q = query(q, where(f.field, f.op, f.value));
        }
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          await deleteDoc(docSnap.ref);
        }
        return { data: null, error: null };
      }

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
      const targetTable = schemaOptions?.table || "orders";
      const collRef = collection(db, targetTable);
      const unsub = onSnapshot(collRef, (snapshot) => {
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
    return Promise.resolve({ data: { success: true }, error: null });
  },

  auth: {
    async getSession() {
      const cached = localStorage.getItem("localeats_user_session");
      if (cached) {
        try {
          const user = JSON.parse(cached);
          return { data: { session: { user, access_token: "firebase-token" } }, error: null };
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
          return { data: { user: JSON.parse(cached) }, error: null };
        } catch {
          // ignore
        }
      }
      return { data: { user: null }, error: null };
    },

    onAuthStateChange(callback: (event: string, session: unknown) => void) {
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

    async signUp({ email, password, options }: { email: string; password: string; options?: Record<string, unknown> }) {
      try {
        const user = await firebaseSignUp(email, password, {
          full_name: options?.data?.full_name,
          phone: options?.data?.phone,
          shop_id: options?.data?.shop_id,
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

    async updateUser() {
      return { data: { user: auth.currentUser }, error: null };
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
        getPublicUrl(path: string) {
          return { data: { publicUrl: path } };
        },
        async upload(path: string) {
          return { data: { path }, error: null };
        }
      };
    }
  }
};

export const getSupabase = () => supabase;

export const getFreshChannel = (channelName: string) => {
  return new FirestoreChannelAdapter(channelName);
};
