import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);

async function testAuth() {
  try {
    const email = "aviwenotununu4@gmail.com";
    const password = "teejey12";
    await signInWithEmailAndPassword(auth, email, password);
    console.log("Logged in successfully!");
    process.exit(0);
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
}
testAuth();
