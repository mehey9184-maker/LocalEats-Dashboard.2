import test, {beforeEach, after} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  collection,doc,getDoc,getDocs,query,where,setDoc,updateDoc,deleteDoc,
} from "firebase/firestore";

// L3-N8K: exact CUSTOMER path/method compatibility matrix, frozen from
// mehey9184-maker/LocalEats-app/src/lib/firebase.ts (review 2026-11-20).
// This is a demo LOCAL emulator only. Customer app itself is not deployed,
// changed, or connected to these synthetic test identities.
const projectId="demo-l3-n8j-firestore";
const env=await initializeTestEnvironment({
  projectId,
  firestore:{
    host:"127.0.0.1",port:8181,
    rules:readFileSync(
      new URL("../l3-n8k/firestore.shared-staging-review.rules",import.meta.url),"utf8"),
  },
});
const cust=env.authenticatedContext("customer-A").firestore();
const other=env.authenticatedContext("customer-B").firestore();
const merchant=env.authenticatedContext("merchant-A").firestore();
const guest=env.unauthenticatedContext().firestore();

beforeEach(async()=>{
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    await Promise.all([
      setDoc(doc(db,"users","customer-A"),{uid:"customer-A",role:"customer",full_name:"Test Customer"}),
      setDoc(doc(db,"users","customer-B"),{uid:"customer-B",role:"customer",full_name:"Other Customer"}),
      setDoc(doc(db,"profiles","customer-A"),{user_id:"customer-A",full_name:"Test Customer"}),
      setDoc(doc(db,"profiles","customer-B"),{user_id:"customer-B",full_name:"Other Customer"}),
      setDoc(doc(db,"shops","shop-A"),{id:"shop-A",owner_id:"merchant-A",approval_status:"approved",phone:"private-shop-phone"}),
      setDoc(doc(db,"menu_items","menu-A"),{id:"menu-A",shop_id:"shop-A",price:25}),
      setDoc(doc(db,"orders","order-A"),{user_id:"customer-A",shop_id:"shop-A",delivery_status:"finding_rider",total_price:25}),
      setDoc(doc(db,"orders","order-B"),{user_id:"customer-B",shop_id:"shop-A",delivery_status:"finding_rider",total_price:50}),
      setDoc(doc(db,"reviews","review-A"),{shop_id:"shop-A",user_id:"customer-A",rating:5}),
      setDoc(doc(db,"follows","customer-A_shop-A"),{user_id:"customer-A",shop_id:"shop-A"}),
      setDoc(doc(db,"messages","message-A"),{order_id:"order-A",sender_id:"customer-A",text:"Test only"}),
      setDoc(doc(db,"contact_messages","contact-A"),{user_id:"customer-A",text:"Test only"}),
      setDoc(doc(db,"user_push_tokens","customer-A_x"),{user_id:"customer-A",token:"synthetic"}),
    ]);
  });
});
after(async()=>{await env.cleanup();});

test("N8K Customer getProfile/profiles is owner-scoped and read-only",async()=>{
  assert.equal((await assertSucceeds(getDoc(doc(cust,"profiles","customer-A")))).data()?.user_id,"customer-A");
  await assertFails(getDoc(doc(cust,"profiles","customer-B")));
  await assertFails(getDoc(doc(guest,"profiles","customer-A")));
  await assertFails(getDocs(collection(cust,"profiles")));
  await assertFails(setDoc(doc(cust,"profiles","customer-A"),{full_name:"Tampered"},{merge:true}));
  await assertFails(updateDoc(doc(cust,"profiles","customer-A"),{user_id:"customer-B"}));
  await assertFails(deleteDoc(doc(cust,"profiles","customer-A")));
});

test("N8K Customer user profile remains private; role forgery denied",async()=>{
  assert.equal((await assertSucceeds(getDoc(doc(cust,"users","customer-A")))).data()?.role,"customer");
  await assertFails(getDoc(doc(cust,"users","customer-B")));
  await assertFails(updateDoc(doc(cust,"users","customer-A"),{role:"admin"}));
});

test("N8K Customer discovery getDocs(shops) healthCheck fails closed for all clients",async()=>{
  await assertFails(getDocs(collection(guest,"shops")));
  await assertFails(getDocs(collection(cust,"shops")));
  await assertFails(getDoc(doc(cust,"shops","shop-A")));
  // Opening full shop documents for public browsing is unsafe until a
  // separate sanitized public catalog exists (shop doc has private phone).
  assert.equal((await assertSucceeds(getDoc(doc(merchant,"shops","shop-A")))).data()?.owner_id,"merchant-A");
});

test("N8K Customer getShops root menu_items scan is denied, as is anonymous price read",async()=>{
  await assertFails(getDocs(collection(cust,"menu_items")));
  await assertFails(getDocs(collection(guest,"menu_items")));
  await assertFails(getDoc(doc(cust,"menu_items","menu-A")));
  assert.equal((await assertSucceeds(getDoc(doc(merchant,"menu_items","menu-A")))).data()?.price,25);
});

test("N8K Customer getOrdersByUser owner-scoped query works, no other user's orders",async()=>{
  const q=query(collection(cust,"orders"),where("user_id","==","customer-A"));
  const result=await assertSucceeds(getDocs(q));
  assert.deepEqual(result.docs.map(d=>d.id),["order-A"]);
  await assertFails(getDocs(collection(cust,"orders")));
  await assertFails(getDoc(doc(cust,"orders","order-B")));
  await assertFails(getDoc(doc(other,"orders","order-A")));
  await assertFails(getDoc(doc(guest,"orders","order-A")));
});

test("N8K Customer listenToOrderMessages and sendMessage remain blocked",async()=>{
  await assertFails(getDocs(query(collection(cust,"messages"),where("order_id","==","order-A"))));
  await assertFails(getDoc(doc(cust,"messages","message-A")));
  await assertFails(setDoc(doc(cust,"messages","new-msg"),{order_id:"order-A",sender_id:"customer-A",text:"fake"}));
  await assertFails(getDocs(query(collection(cust,"chat_messages"),where("order_id","==","order-A"))));
});

test("N8K Customer getReviewsForShop and addReview remain blocked",async()=>{
  await assertFails(getDocs(query(collection(cust,"reviews"),where("shop_id","==","shop-A"))));
  await assertFails(getDoc(doc(cust,"reviews","review-A")));
  await assertFails(setDoc(doc(cust,"reviews","new-review"),{shop_id:"shop-A",user_id:"customer-A",rating:5}));
});

test("N8K Customer follows, contact and push token writes remain blocked",async()=>{
  await assertFails(getDocs(query(collection(cust,"follows"),where("user_id","==","customer-A"))));
  await assertFails(setDoc(doc(cust,"follows","customer-A_shop-A"),{user_id:"customer-A",shop_id:"shop-A"}));
  await assertFails(deleteDoc(doc(cust,"follows","customer-A_shop-A")));
  await assertFails(setDoc(doc(cust,"contact_messages","new-contact"),{user_id:"customer-A",text:"help"}));
  await assertFails(setDoc(doc(cust,"user_push_tokens","customer-A_x"),{user_id:"customer-A",token:"synthetic"}));
});

test("N8K trusted API order and merchant account writes remain blocked to browsers",async()=>{
  await assertFails(setDoc(doc(cust,"orders","new-order"),{user_id:"customer-A",total_price:1}));
  await assertFails(updateDoc(doc(cust,"orders","order-A"),{total_price:0}));
  await assertFails(updateDoc(doc(merchant,"shops","shop-A"),{approval_status:"approved"}));
});

test("N8K candidate is not a green-light for a shared staging rollout",()=>{
  const rules=readFileSync(new URL("../l3-n8k/firestore.shared-staging-review.rules",import.meta.url),"utf8");
  assert.match(rules,/NOT SAFE TO DEPLOY AS-IS TO SHARED STAGING/);
  assert.match(rules,/allow list, create, update, delete: if false/);
  assert.doesNotMatch(rules,/allow read, write: if true/);
  assert.equal(projectId,"demo-l3-n8j-firestore");
  assert.ok(!projectId.includes("localeats-staging"));
});
