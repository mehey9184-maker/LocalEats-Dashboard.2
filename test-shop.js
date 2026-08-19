import { initializeApp } from "firebase/app";
import { getFirestore, getDocs, collection, query, where } from "firebase/firestore";
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function testShop() {
  try {
    const email = "aviwenotununu4@gmail.com";
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (!snap.empty) {
        console.log("User doc:", snap.docs[0].data());
        const shopId = snap.docs[0].data().shop_id;
        const q2 = query(collection(db, "shops"), where("id", "==", Number(shopId)));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
             console.log("Shop doc:", snap2.docs[0].data());
        } else {
             console.log("Shop doc not found for ID:", shopId);
        }
    } else {
        console.log("No user doc found!");
    }
    process.exit(0);
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
}
testShop();
