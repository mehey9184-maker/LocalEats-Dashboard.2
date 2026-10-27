import {getApp,getApps,initializeApp} from "firebase/app";
import {connectAuthEmulator,getAuth} from "firebase/auth";
import config from "../../firebase-applet-config.json";
export const pickupFirebaseConfig={
 apiKey:import.meta.env.VITE_FIREBASE_API_KEY || config.apiKey,
 authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || config.authDomain,
 projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID || config.projectId,
 storageBucket:import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || config.storageBucket,
 messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || config.messagingSenderId,
 appId:import.meta.env.VITE_FIREBASE_APP_ID || config.appId,
};
export const pickupFirebaseApp=getApps().length ? getApp() : initializeApp(pickupFirebaseConfig);
export const pickupAuth=getAuth(pickupFirebaseApp);

// Explicit loopback development fixtures only; stripped from production builds.
export const localPickupFixture=import.meta.env.DEV && ["127.0.0.1","localhost"].includes(window.location.hostname) &&
 new URLSearchParams(window.location.search).get("fixture")==="1";
if(localPickupFixture)connectAuthEmulator(pickupAuth,"http://127.0.0.1:9099",{disableWarnings:true});
