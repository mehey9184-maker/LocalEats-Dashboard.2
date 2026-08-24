import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  deleteDoc,
  getDocs, 
  query, 
  where,
  or,
  writeBatch,
  onSnapshot,
  Unsubscribe
} from "firebase/firestore";
import { 
  getStorage, 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import firebaseConfigData from "../../firebase-applet-config.json";
import { User, MenuItem, Order, Shop, Review, Coupon, OrderStatus } from "../types";

// Standard Firestore Error Handling Enums & Interfaces
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentAuthUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuthUser?.uid || null,
      email: currentAuthUser?.email || null,
      emailVerified: currentAuthUser?.emailVerified || null,
      isAnonymous: currentAuthUser?.isAnonymous || null,
      tenantId: currentAuthUser?.tenantId || null,
      providerInfo: currentAuthUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('[Firestore Error]', JSON.stringify(errInfo));
  return errInfo;
}

// Web app's Firebase configuration
const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: firebaseConfigData.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0863469023.firebaseapp.com",
  projectId: firebaseConfigData.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0863469023",
  storageBucket: firebaseConfigData.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0863469023.firebasestorage.app",
  messagingSenderId: firebaseConfigData.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "24849245892",
  appId: firebaseConfigData.appId || import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: firebaseConfigData.measurementId || ""
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth, Firestore & Storage
export const auth = getAuth(app);
const databaseId = firebaseConfigData.firestoreDatabaseId || "ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe";
export const db = databaseId && databaseId !== "(default)" ? getFirestore(app, databaseId) : getFirestore(app);
export const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);

console.log("[Firebase] Initialized with Project ID:", firebaseConfig.projectId, "Database:", databaseId);

// Test Connection Helper (per skill guidelines)
export async function validateFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "test", "connection")).catch(() => {});
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("[Firebase] Client is offline or database connection is warming up.");
      return false;
    }
    return true;
  }
}

/**
 * Upload an image (shop logo, avatar, menu item photo) to Firebase Storage
 */
export async function uploadImageToFirebaseStorage(
  file: File | Blob, 
  folder: "avatars" | "shop-assets" | "menu-items", 
  fileName?: string
): Promise<string> {
  const ext = file instanceof File ? (file.name.split(".").pop() || "jpg") : "jpg";
  const name = fileName || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
  const fileRef = storageRef(storage, `${folder}/${name}`);

  console.log(`[Firebase Storage] Uploading to path: ${folder}/${name}...`);
  const snapshot = await uploadBytes(fileRef, file, {
    contentType: file.type || "image/jpeg",
  });
  
  const downloadUrl = await getDownloadURL(snapshot.ref);
  console.log(`[Firebase Storage] Upload success! Download URL:`, downloadUrl);
  return downloadUrl;
}

/**
 * Format Firebase User into standardized LocalEats User session object
 */
export async function formatFirebaseUserSession(fbUser: FirebaseUser): Promise<User> {
  let userMeta: Record<string, unknown> = {};
  
  try {
    const userDocRef = doc(db, "users", fbUser.uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      userMeta = snap.data() || {};
    }
  } catch (e) {
    console.debug("[Firebase Auth] Note fetching user document from Firestore:", e);
  }

  const name = fbUser.displayName || (userMeta.full_name as string) || (userMeta.name as string) || fbUser.email?.split("@")[0] || "LocalEats Merchant";

  return {
    id: fbUser.uid,
    email: fbUser.email,
    aud: "authenticated",
    created_at: fbUser.metadata?.creationTime || new Date().toISOString(),
    app_metadata: {},
    user_metadata: {
      full_name: name,
      name: name,
      phone: fbUser.phoneNumber || (userMeta.phone as string) || "",
      ...userMeta,
    },
  };
}

/**
 * Firebase Auth Helpers
 */
export async function firebaseSignIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const sessionUser = await formatFirebaseUserSession(credential.user);
  localStorage.setItem("localeats_user_session", JSON.stringify(sessionUser));
  return sessionUser;
}

export async function firebaseSignInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);
  const sessionUser = await formatFirebaseUserSession(credential.user);
  localStorage.setItem("localeats_user_session", JSON.stringify(sessionUser));
  return sessionUser;
}

export async function firebaseSignUp(
  email: string, 
  password: string, 
  userData: { full_name?: string; phone?: string; shop_id?: string | number }
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  
  if (userData.full_name) {
    await updateProfile(credential.user, { displayName: userData.full_name }).catch(() => {});
  }

  // Create user document in Firestore
  const userDocRef = doc(db, "users", credential.user.uid);
  const profilePayload = {
    uid: credential.user.uid,
    email: email.trim(),
    full_name: userData.full_name || "",
    phone: userData.phone || "",
    shop_id: userData.shop_id || 18,
    vendor_shop_id: userData.shop_id || 18,
    role: "merchant",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await setDoc(userDocRef, profilePayload, { merge: true }).catch((err) => {
    console.warn("[Firebase Auth] Warning writing user doc:", err);
  });

  const sessionUser = await formatFirebaseUserSession(credential.user);
  localStorage.setItem("localeats_user_session", JSON.stringify(sessionUser));
  return sessionUser;
}

export async function firebaseSignOutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } finally {
    localStorage.removeItem("localeats_user_session");
  }
}

export async function firebaseResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export { onAuthStateChanged };

export async function updateFirebaseUserProfile(updates: { full_name?: string; phone?: string; shop_id?: string | number; [key: string]: unknown }): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  if (updates.full_name) {
    await updateProfile(currentUser, { displayName: updates.full_name }).catch(() => {});
  }

  const userDocRef = doc(db, "users", currentUser.uid);
  await setDoc(userDocRef, {
    ...updates,
    updated_at: new Date().toISOString(),
  }, { merge: true });
}

/**
 * Verify Firestore Collections Existence & Retrieve Counts
 */
export async function verifyFirestoreCollections(): Promise<{
  connected: boolean;
  databaseId: string;
  collections: {
    shops: number;
    orders: number;
    menu_items: number;
    users: number;
    rider_profiles: number;
    rider_connections: number;
  };
  details: string[];
}> {
  const results = {
    connected: false,
    databaseId: databaseId || "default",
    collections: {
      shops: 0,
      orders: 0,
      menu_items: 0,
      users: 0,
      rider_profiles: 0,
      rider_connections: 0,
    },
    details: [] as string[]
  };

  try {
    // 1. Check Shops
    try {
      const shopsSnap = await getDocs(collection(db, "shops"));
      results.collections.shops = shopsSnap.size;
      results.details.push(`Shops: ${shopsSnap.size} records found`);
    } catch (e) {
      results.details.push(`Shops collection check note: ${String(e)}`);
    }

    // 2. Check Orders
    try {
      const ordersSnap = await getDocs(collection(db, "orders"));
      results.collections.orders = ordersSnap.size;
      results.details.push(`Orders: ${ordersSnap.size} records found`);
    } catch (e) {
      results.details.push(`Orders collection check note: ${String(e)}`);
    }

    // 3. Check Menu Items
    try {
      const menuSnap = await getDocs(collection(db, "menu_items"));
      results.collections.menu_items = menuSnap.size;
      results.details.push(`Menu Items: ${menuSnap.size} records found`);
    } catch (e) {
      results.details.push(`Menu Items check note: ${String(e)}`);
    }

    // 4. Check Users
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      results.collections.users = usersSnap.size;
      results.details.push(`Users: ${usersSnap.size} records found`);
    } catch {
      // ignore
    }

    // 5. Check Rider Profiles
    try {
      const ridersSnap = await getDocs(collection(db, "rider_profiles"));
      results.collections.rider_profiles = ridersSnap.size;
    } catch {
      // ignore
    }

    // 6. Check Rider Connections
    try {
      const connsSnap = await getDocs(collection(db, "rider_connections"));
      results.collections.rider_connections = connsSnap.size;
    } catch {
      // ignore
    }

    results.connected = true;
  } catch (error) {
    console.warn("[Firestore] Collection verification error:", error);
    results.connected = false;
  }

  return results;
}

/**
 * Migration Utility: Migrate existing orders, menu items, and shops to Firestore
 * Maps fields strictly to support Firestore's structured schema.
 */
export async function migrateDataToFirestore(params: {
  orders: Order[];
  menuItems: MenuItem[];
  shops?: Shop[];
  shopId?: string | number;
}): Promise<{ ordersMigrated: number; menuItemsMigrated: number; shopsMigrated: number }> {
  const { orders, menuItems, shops = [], shopId } = params;
  let ordersCount = 0;
  let menuCount = 0;
  let shopsCount = 0;

  console.log(`[Firestore Migration] Executing data transfer for shopId=${shopId || "all"}...`);

  // 1. Migrate Shops (with normalized fields)
  if (shops.length > 0) {
    const shopBatch = writeBatch(db);
    for (const shop of shops) {
      const sId = String(shop.id);
      const sRef = doc(db, "shops", sId);
      const shopData = {
        id: Number(shop.id) || shop.id,
        name: shop.name || "LocalEats Partner",
        owner_id: shop.owner_id || auth.currentUser?.uid || "",
        email: shop.email || "",
        phone: shop.phone || "",
        address: shop.address || "",
        city: shop.city || "Cape Town",
        is_active: shop.is_active ?? true,
        lat: Number(shop.lat) || -33.9249,
        lng: Number(shop.lng) || 18.4241,
        delivery_fee: Number(shop.delivery_fee) || 25,
        rating: Number(shop.rating) || 4.8,
        logo_url: shop.logo_url || "",
        banner_url: shop.banner_url || "",
        description: shop.description || "",
        operating_hours: shop.operating_hours || "08:00 - 22:00",
        created_at: shop.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      shopBatch.set(sRef, shopData, { merge: true });
      shopsCount++;
    }
    await shopBatch.commit().catch(e => console.warn("[Firestore Migration] Shops batch error:", e));
  }

  // 2. Migrate Menu Items (with normalized fields)
  if (menuItems.length > 0) {
    const menuBatch = writeBatch(db);
    for (const item of menuItems) {
      const mId = String(item.id);
      const mRef = doc(db, "menu_items", mId);
      const menuData = {
        id: item.id,
        shop_id: Number(item.shop_id) || Number(shopId) || 18,
        name: item.name || "Menu Item",
        price: Number(item.price) || 0,
        description: item.description || "",
        category: item.category || "Main Course",
        image_url: item.image_url || "",
        is_available: item.is_available ?? true,
        stock_quantity: item.stock_quantity ?? 10,
        is_unlimited: item.is_unlimited ?? false,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      menuBatch.set(mRef, menuData, { merge: true });
      menuCount++;
    }
    await menuBatch.commit().catch(e => console.warn("[Firestore Migration] Menu items batch error:", e));
  }

  // 3. Migrate Orders (with normalized fields)
  if (orders.length > 0) {
    const orderBatch = writeBatch(db);
    for (const order of orders) {
      const oId = String(order.id);
      const oRef = doc(db, "orders", oId);
      const orderData = {
        id: order.id,
        shop_id: Number(order.shop_id) || Number(shopId) || 18,
        user_id: order.user_id || "",
        rider_id: order.rider_id || null,
        product_name: order.product_name || "Order Item",
        total_price: Number(order.total_price) || 0,
        subtotal: Number(order.subtotal) || Number(order.total_price) || 0,
        delivery_fee: Number(order.delivery_fee) || 25,
        status: order.status || "pending",
        delivery_status: order.delivery_status || "finding_rider",
        payment_method: order.payment_method || "cash_on_delivery",
        pairing_cipher: order.pairing_cipher || "",
        customer_name: order.customer_name || "Customer",
        phone: order.phone || "",
        email: order.email || "",
        address: order.address || "",
        city: order.city || "Cape Town",
        lat: Number(order.lat) || -33.9249,
        lng: Number(order.lng) || 18.4241,
        notes: order.notes || "",
        created_at: order.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      orderBatch.set(oRef, orderData, { merge: true });
      ordersCount++;
    }
    await orderBatch.commit().catch(e => console.warn("[Firestore Migration] Orders batch error:", e));
  }

  console.log(`[Firestore Migration] Migration Complete! Shops: ${shopsCount}, Menu: ${menuCount}, Orders: ${ordersCount}`);
  return { ordersMigrated: ordersCount, menuItemsMigrated: menuCount, shopsMigrated: shopsCount };
}

// =========================================================================
// DIRECT FIRESTORE CRUD & REALTIME APIS
// =========================================================================

/**
 * Fetch all shops or shops owned by user
 */

export function subscribeToShopsFirestore(
  onUpdate: (shops: Shop[]) => void,
  ownerId?: string
): Unsubscribe {
  const coll = collection(db, "shops");
  const q = ownerId ? query(coll, where("owner_id", "==", ownerId)) : query(coll);

  return onSnapshot(q, (snap) => {
    const shops = snap.docs.map(d => ({ ...d.data(), id: d.data().id ?? d.id } as Shop));
    onUpdate(shops);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, "shops");
  });
}

export async function getFirestoreShops(ownerId?: string): Promise<Shop[]> {
  try {
    const coll = collection(db, "shops");
    const q = ownerId ? query(coll, where("owner_id", "==", ownerId)) : query(coll);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.data().id ?? d.id } as Shop));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "shops");
    return [];
  }
}

/**
 * Fetch a single shop by ID
 */
export async function getFirestoreShopById(shopId: string | number): Promise<Shop | null> {
  try {
    const sRef = doc(db, "shops", String(shopId));
    const snap = await getDoc(sRef);
    if (snap.exists()) {
      return { ...snap.data(), id: snap.data().id ?? snap.id } as Shop;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `shops/${shopId}`);
    return null;
  }
}

/**
 * Update shop details in Firestore
 */
export async function updateFirestoreShop(shopId: string | number, updates: Partial<Shop>): Promise<{ error: Error | null }> {
  try {
    const sRef = doc(db, "shops", String(shopId));
    await setDoc(sRef, {
      ...updates,
      updated_at: new Date().toISOString(),
    }, { merge: true });
    return { error: null };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}`);
    return { error: err as Error };
  }
}

/**
 * Fetch Menu Items for a Shop
 */
export async function getFirestoreMenuItems(shopId: string | number): Promise<MenuItem[]> {
  try {
    const coll = collection(db, "menu_items");
    const numShopId = Number(shopId);
    const q = isNaN(numShopId) 
      ? query(coll, where("shop_id", "==", shopId)) 
      : query(coll, where("shop_id", "in", [shopId, numShopId, String(shopId)]));
    
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ ...d.data(), id: d.data().id ?? d.id } as MenuItem));
    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "menu_items");
    return [];
  }
}

/**
 * Update a Menu Item in Firestore
 */
export async function updateFirestoreMenuItem(itemId: string | number, updates: Partial<MenuItem>): Promise<{ error: Error | null }> {
  try {
    const mRef = doc(db, "menu_items", String(itemId));
    await setDoc(mRef, {
      ...updates,
      updated_at: new Date().toISOString(),
    }, { merge: true });
    return { error: null };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `menu_items/${itemId}`);
    return { error: err as Error };
  }
}

/**
 * Create a Menu Item in Firestore
 */
export async function createFirestoreMenuItem(item: Partial<MenuItem>): Promise<{ data: MenuItem | null; error: Error | null }> {
  try {
    const itemId = item.id ? String(item.id) : String(Date.now());
    const mRef = doc(db, "menu_items", itemId);
    const payload = {
      ...item,
      id: itemId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await setDoc(mRef, payload, { merge: true });
    return { data: payload as unknown as MenuItem, error: null };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "menu_items");
    return { data: null, error: err as Error };
  }
}

/**
 * Delete a Menu Item from Firestore
 */
export async function deleteFirestoreMenuItem(itemId: string | number): Promise<{ error: Error | null }> {
  try {
    const mRef = doc(db, "menu_items", String(itemId));
    await deleteDoc(mRef);
    return { error: null };
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `menu_items/${itemId}`);
    return { error: err as Error };
  }
}

/**
 * Normalize raw Firestore order document to standard Order interface
 */
export function normalizeFirestoreOrder(docData: Record<string, unknown>, docId: string): Order {
  // Safe date parser for Firestore Timestamps, ISO strings, or numbers
  let formattedCreatedAt = new Date().toISOString();
  if (docData.created_at) {
    if (typeof docData.created_at === "object" && docData.created_at !== null) {
      const ts = docData.created_at as { toDate?: () => Date; seconds?: number };
      if (typeof ts.toDate === "function") {
        formattedCreatedAt = ts.toDate().toISOString();
      } else if (typeof ts.seconds === "number") {
        formattedCreatedAt = new Date(ts.seconds * 1000).toISOString();
      }
    } else if (typeof docData.created_at === "string") {
      formattedCreatedAt = docData.created_at;
    } else if (typeof docData.created_at === "number") {
      formattedCreatedAt = new Date(docData.created_at).toISOString();
    }
  }

  // Safe product name / items formatter
  let productName = (docData.product_name as string) || "";
  if (!productName && Array.isArray(docData.items) && docData.items.length > 0) {
    productName = docData.items
      .map((item: Record<string, unknown>) => {
        const qty = item.quantity || item.qty || 1;
        const name = item.name || item.product_name || item.title || "Dish";
        return `${qty}x ${name}`;
      })
      .join(", ");
  }
  if (!productName) {
    productName = "Custom Order";
  }

  const rawShopId = docData.shop_id ?? docData.shopId ?? docData.vendor_id ?? docData.vendorId;
  const numShopId = Number(rawShopId);
  const finalShopId = isNaN(numShopId) ? (rawShopId as number) : numShopId;

  const totalPrice = Number(
    docData.total_price ?? docData.price ?? docData.amount ?? docData.total ?? 0
  );

  return {
    id: String(docData.id || docId),
    shop_id: finalShopId,
    user_id: String(docData.user_id || docData.customer_id || ""),
    product_name: productName,
    product_variant: (docData.product_variant as string) || undefined,
    total_price: totalPrice,
    price: Number(docData.price ?? totalPrice),
    lat: typeof docData.lat === "number" ? docData.lat : typeof docData.latitude === "number" ? docData.latitude : undefined,
    lng: typeof docData.lng === "number" ? docData.lng : typeof docData.longitude === "number" ? docData.longitude : undefined,
    status: ((docData.status as string) || "pending") as OrderStatus,
    payment_method: (docData.payment_method as string) || (docData.paymentType as string) || "cash_on_delivery",
    country: (docData.country as string) || "ZA",
    created_at: formattedCreatedAt,
    customer_name: (docData.customer_name as string) || (docData.name as string) || (docData.user_name as string) || "Customer",
    phone: (docData.phone as string) || (docData.customer_phone as string) || (docData.user_phone as string) || "",
    email: (docData.email as string) || (docData.customer_email as string) || "",
    address: (docData.address as string) || (docData.delivery_address as string) || (docData.location as string) || "Local Township Delivery",
    city: (docData.city as string) || "Tembisa",
    notes: (docData.notes as string) || (docData.special_instructions as string) || undefined,
    acceptance_message: (docData.acceptance_message as string) || undefined,
    delivery_status: (docData.delivery_status as Order["delivery_status"]) || undefined,
    estimated_delivery_time: (docData.estimated_delivery_time as string) || undefined,
    rider_id: (docData.rider_id as string) || undefined,
    rider_name: (docData.rider_name as string) || undefined,
    rider_phone: (docData.rider_phone as string) || undefined,
    items: Array.isArray(docData.items) ? (docData.items as Order["items"]) : undefined,
    updated_at: typeof docData.updated_at === "string" ? docData.updated_at : undefined,
  };
}

/**
 * Fetch Orders for a Shop or list of Shops from Firestore
 */
export async function getFirestoreOrders(shopId?: string | number | (string | number)[]): Promise<Order[]> {
  try {
    if (shopId === undefined) return [];
    
    const coll = collection(db, "orders");
    const ids: (string | number)[] = Array.isArray(shopId) ? shopId : [shopId];
    if (ids.length === 0) return [];

    const queryValues: (string | number)[] = [];
    ids.forEach((id) => {
      queryValues.push(id);
      const num = Number(id);
      if (!isNaN(num)) {
        if (!queryValues.includes(num)) queryValues.push(num);
        const str = String(num);
        if (!queryValues.includes(str)) queryValues.push(str);
      }
    });

    const chunks = [];
    for (let i = 0; i < queryValues.length; i += 30) {
      chunks.push(queryValues.slice(i, i + 30));
    }

    const allOrders: Order[] = [];
    for (const chunk of chunks) {
      const q = query(coll, where("shop_id", "in", chunk));
      const snap = await getDocs(q);
      allOrders.push(...snap.docs.map((d) => normalizeFirestoreOrder(d.data() as Record<string, unknown>, d.id)));
    }
    return allOrders;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "orders");
    return [];
  }
}

/**
 * Update an Order in Firestore
 */
export async function updateFirestoreOrder(orderId: string | number, updates: Partial<Order>): Promise<{ error: Error | null }> {
  try {
    const oRef = doc(db, "orders", String(orderId));
    await setDoc(oRef, {
      ...updates,
      updated_at: new Date().toISOString(),
    }, { merge: true });
    return { error: null };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    return { error: err as Error };
  }
}

/**
 * Create an Order in Firestore
 */
export async function createFirestoreOrder(order: Partial<Order>): Promise<{ data: Order | null; error: Error | null }> {
  try {
    const orderId = order.id ? String(order.id) : `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const oRef = doc(db, "orders", orderId);
    const payload = {
      ...order,
      id: orderId,
      created_at: order.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await setDoc(oRef, payload, { merge: true });
    return { data: payload as Order, error: null };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "orders");
    return { data: null, error: err as Error };
  }
}

/**
 * Subscribe to Orders with Realtime Updates
 */
export function subscribeToOrdersFirestore(
  shopId: string | number | (string | number)[] | undefined, 
  onUpdate: (orders: Order[]) => void
): Unsubscribe {
  if (shopId === undefined) return () => {};

  const coll = collection(db, "orders");
  const ids: (string | number)[] = Array.isArray(shopId) ? shopId : [shopId];
  if (ids.length === 0) return () => {};

  const queryValues: (string | number)[] = [];
  ids.forEach((id) => {
    queryValues.push(id);
    const num = Number(id);
    if (!isNaN(num)) {
      if (!queryValues.includes(num)) queryValues.push(num);
      const str = String(num);
      if (!queryValues.includes(str)) queryValues.push(str);
    }
  });

  if (queryValues.length === 0) return () => {};
  
  // Firestore `in` query supports up to 30 elements
  const slicedValues = queryValues.slice(0, 30);
  const q = query(coll, where("shop_id", "in", slicedValues));
  
  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map((d) => normalizeFirestoreOrder(d.data() as Record<string, unknown>, d.id));
    onUpdate(orders);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, "orders");
  });
}

/**
 * Subscribe to Menu Items with Realtime Updates
 */
export function subscribeToMenuItemsFirestore(
  shopId: string | number, 
  onUpdate: (items: MenuItem[]) => void
): Unsubscribe {
  const coll = collection(db, "menu_items");
  const numShopId = Number(shopId);
  const q = isNaN(numShopId) 
    ? query(coll, where("shop_id", "==", shopId)) 
    : query(coll, where("shop_id", "in", [shopId, numShopId, String(shopId)]));

  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ ...d.data(), id: d.data().id ?? d.id } as MenuItem));
    onUpdate(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, "menu_items");
  });
}

/**
 * Fetch Reviews from Firestore
 */
export async function getFirestoreReviews(shopId: string | number): Promise<Review[]> {
  try {
    const coll = collection(db, "reviews");
    const numShopId = Number(shopId);
    const q = isNaN(numShopId)
      ? query(coll, where("shop_id", "==", shopId))
      : query(coll, where("shop_id", "in", [shopId, numShopId, String(shopId)]));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.data().id ?? d.id } as Review));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "reviews");
    return [];
  }
}

/**
 * Fetch Coupons from Firestore
 */
export async function getFirestoreCoupons(shopId?: string | number): Promise<Coupon[]> {
  try {
    const coll = collection(db, "coupons");
    const q = shopId ? query(coll, where("shop_id", "==", Number(shopId))) : coll;
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.data().id ?? d.id } as Coupon));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "coupons");
    return [];
  }
}

/**
 * Web Push Notifications
 */
export async function requestNotificationPermissionAndGetToken(vapidKey?: string): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported) return null;

    if (!("Notification" in window)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const messaging = getMessaging(app);
    
    let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      serviceWorkerRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => undefined);
    }

    const activeVapidKey = vapidKey || import.meta.env.VITE_FIREBASE_VAPID_KEY;

    const currentToken = await getToken(messaging, {
      vapidKey: activeVapidKey,
      serviceWorkerRegistration
    });

    return currentToken || null;
  } catch (error) {
    console.warn("[FCM] Warning acquiring push notification token:", error);
    return null;
  }
}

export async function onForegroundMessage(callback: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void) {
  try {
    const supported = await isSupported();
    if (!supported) return;
    const messaging = getMessaging(app);
    return onMessage(messaging, callback);
  } catch (err) {
    console.warn("[FCM] Foreground listener error:", err);
  }
}

/**
 * Send a push notification alert for orders / rider status
 */
export async function sendPushNotification({
  userId,
  token,
  title,
  body,
  data,
}: {
  userId?: string;
  token?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  userJwt?: string;
  serverKey?: string;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    console.log(`[FCM] Dispatching push notification: "${title}" -> ${token || userId || "broadcast"}`);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        data,
      });
    }
    return { ok: true };
  } catch (error) {
    console.warn("[FCM] Push notification dispatch warning (operating in fallback mode):", error);
    return { ok: false, error: String(error) };
  }
}
