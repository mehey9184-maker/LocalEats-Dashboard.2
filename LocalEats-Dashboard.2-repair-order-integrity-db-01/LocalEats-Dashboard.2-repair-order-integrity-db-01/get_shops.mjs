import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const shopsSnapshot = await getDocs(collection(db, 'shops'));
  const shops = [];
  shopsSnapshot.forEach(doc => {
    shops.push({ id: doc.id, ...doc.data() });
  });
  console.log("SHOPS: ", JSON.stringify(shops, null, 2));

  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = [];
    usersSnapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });
    console.log("USERS: ", JSON.stringify(users, null, 2));
  } catch (e) {
    console.log("Could not read users (expected if rules blocked): ", e.message);
  }
}
run().catch(console.error);
