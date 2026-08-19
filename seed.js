import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId);

async function seed() {
  try {
    const email = "aviwenotununu4@gmail.com";
    const password = "teejey12";
    const phone = "079 058 5421";
    
    console.log("Signing in...");
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const userId = userCred.user.uid;
    console.log("Logged in:", userId);
    
    const shopId = Date.now();
    const shopRef = doc(db, "shops", String(shopId));
    console.log("Creating shop...", shopId);
    await setDoc(shopRef, {
      id: shopId,
      owner_id: userId,
      name: "My Kota Shop",
      email: email,
      phone: phone,
      is_active: true,
      open_time: "09:00",
      close_time: "21:00",
      lat: -26.2041, 
      lng: 28.0473,
      rating: 5.0,
      image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=1000",
      description: "Best Kota in town!"
    });
    
    const userRef = doc(db, "users", userId);
    console.log("Creating user profile...");
    await setDoc(userRef, {
      id: userId,
      email: email,
      full_name: "Kota Shop Owner",
      role: "merchant",
      shop_id: shopId,
      phone: phone
    });
    
    console.log("Done successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}
seed();
