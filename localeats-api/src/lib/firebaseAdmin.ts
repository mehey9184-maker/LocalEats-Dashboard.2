import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import dotenv from "dotenv";

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";
let privateKey = rawKey.replace(/\\n/g, "\n");
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1).replace(/\\n/g, "\n");
}

if (projectId && clientEmail && privateKey) {
  if (!getApps().length) {
    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } catch (e) {
      console.error("Failed to initialize Firebase app:", e);
    }
  }
} else {
  console.warn("Missing Firebase Admin configuration. Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set.");
}

export const authAdmin = getApps().length ? getAuth() : {
  verifyIdToken: async () => {
    throw new Error("Firebase Admin not initialized due to missing credentials");
  }
} as any;
