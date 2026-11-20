import test, {beforeEach, after} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc,
} from "firebase/firestore";

// These are entirely synthetic local emulator identities. No real Firebase
// tokens, projects, accounts, credentials, web calls, or security-rule publish.
const projectId="demo-l3-n8j-firestore";
const testEnv=await initializeTestEnvironment({
  projectId,
  firestore:{
    host:"127.0.0.1",port:8181,
    rules:readFileSync(new URL("./firestore.staging.rules",import.meta.url),"utf8"),
  },
});
const ownerA=testEnv.authenticatedContext("owner-A").firestore();
const ownerB=testEnv.authenticatedContext("owner-B").firestore();
const customerA=testEnv.authenticatedContext("customer-A").firestore();
const unknown=testEnv.unauthenticatedContext().firestore();

beforeEach(async()=>{
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    await Promise.all([
      setDoc(doc(db,"users","owner-A"),{uid:"owner-A",full_name:"Alpha",role:"merchant",owner_id:"shop-A"}),
      setDoc(doc(db,"users","owner-B"),{uid:"owner-B",full_name:"Beta",role:"merchant",owner_id:"shop-B"}),
      setDoc(doc(db,"shops","shop-A"),{id:"shop-A",owner_id:"owner-A",approval_status:"approved",is_active:true}),
      setDoc(doc(db,"shops","shop-A2"),{id:"shop-A2",owner_id:"owner-A",approval_status:"approved",is_active:true}),
      setDoc(doc(db,"shops","shop-B"),{id:"shop-B",owner_id:"owner-B",approval_status:"approved",is_active:true}),
      setDoc(doc(db,"menu_items","menu-A"),{shop_id:"shop-A",name:"Kota",price:25}),
      setDoc(doc(db,"menu_items","menu-B"),{shop_id:"shop-B",name:"Kota B",price:30}),
      setDoc(doc(db,"orders","order-A"),{user_id:"customer-A",shop_id:"shop-A",delivery_status:"finding_rider",total_price:25}),
      setDoc(doc(db,"orders","order-B"),{user_id:"customer-B",shop_id:"shop-B",delivery_status:"finding_rider",total_price:30}),
      setDoc(doc(db,"rider_profiles","rider-X"),{id:"rider-X",phone:"000000000",current_latitude:1.25}),
      setDoc(doc(db,"payments","payment-A"),{shop_id:"shop-A",amount:25}),
      setDoc(doc(db,"shop_followers","follow-A"),{user_id:"owner-A",shop_id:"shop-A"}),
    ]);
  });
});
after(async()=>{await testEnv.cleanup();});

test("N8J own profile readable but foreign and anonymous profile reads denied",async()=>{
  assert.equal((await assertSucceeds(getDoc(doc(ownerA,"users","owner-A")))).data()?.full_name,"Alpha");
  await assertFails(getDoc(doc(ownerA,"users","owner-B")));
  await assertFails(getDoc(doc(unknown,"users","owner-A")));
  await assertFails(getDocs(collection(ownerA,"users")));
});

test("N8J no browser can create/update/delete any own profile or forge role",async()=>{
  await assertFails(setDoc(doc(ownerA,"users","owner-A"),{role:"admin"},{merge:true}));
  await assertFails(updateDoc(doc(ownerA,"users","owner-A"),{role:"admin"}));
  await assertFails(updateDoc(doc(ownerA,"users","owner-A"),{full_name:"Changed"}));
  await assertFails(deleteDoc(doc(ownerA,"users","owner-A")));
  await assertFails(setDoc(doc(ownerA,"users","new-user"),{uid:"owner-A",role:"admin"}));
});

test("N8J shop reads are owner scoped, including a legitimate two-shop owner",async()=>{
  assert.equal((await assertSucceeds(getDoc(doc(ownerA,"shops","shop-A2")))).data()?.owner_id,"owner-A");
  assert.equal((await assertSucceeds(getDoc(doc(ownerA,"shops","shop-A")))).data()?.owner_id,"owner-A");
  await assertFails(getDoc(doc(ownerA,"shops","shop-B")));
  await assertFails(getDoc(doc(ownerB,"shops","shop-A")));
  await assertFails(getDoc(doc(unknown,"shops","shop-A")));
});

test("N8J shop queries must constrain owner, never list every merchant",async()=>{
  const own=await assertSucceeds(getDocs(query(collection(ownerA,"shops"),where("owner_id","==","owner-A"))));
  assert.deepEqual(own.docs.map(x=>x.id).sort(),["shop-A","shop-A2"]);
  await assertFails(getDocs(collection(ownerA,"shops")));
  await assertFails(getDocs(query(collection(ownerA,"shops"),where("owner_id","==","owner-B"))));
});

test("N8J shop identity, approval and availability cannot be changed in browser",async()=>{
  for(const db of [ownerA,ownerB]){
    await assertFails(setDoc(doc(db,"shops","new-shop"),{owner_id:"owner-A",approval_status:"approved"}));
    await assertFails(updateDoc(doc(db,"shops","shop-A"),{approval_status:"approved"}));
    await assertFails(updateDoc(doc(db,"shops","shop-A"),{owner_id:"owner-B"}));
    await assertFails(updateDoc(doc(db,"shops","shop-A"),{is_active:false}));
    await assertFails(deleteDoc(doc(db,"shops","shop-A")));
  }
});

test("N8J menu items can only be read for a verified owned shop; writes denied",async()=>{
  assert.equal((await assertSucceeds(getDoc(doc(ownerA,"menu_items","menu-A")))).data()?.price,25);
  await assertFails(getDoc(doc(ownerA,"menu_items","menu-B")));
  await assertFails(setDoc(doc(ownerA,"menu_items","new-menu"),{shop_id:"shop-A",price:0}));
  await assertFails(updateDoc(doc(ownerA,"menu_items","menu-A"),{price:0}));
  await assertFails(deleteDoc(doc(ownerA,"menu_items","menu-A")));
});

test("N8J order read is limited to owner/customer, not finding_rider pool",async()=>{
  assert.equal((await assertSucceeds(getDoc(doc(ownerA,"orders","order-A")))).data()?.total_price,25);
  assert.equal((await assertSucceeds(getDoc(doc(customerA,"orders","order-A")))).data()?.total_price,25);
  await assertFails(getDoc(doc(ownerB,"orders","order-A")));
  await assertFails(getDoc(doc(ownerA,"orders","order-B")));
  await assertFails(getDoc(doc(unknown,"orders","order-A")));
  await assertFails(getDocs(collection(ownerA,"orders")));
});

test("N8J browser orders cannot be created or altered even by shop owner/customer",async()=>{
  await assertFails(setDoc(doc(customerA,"orders","fake-order"),{user_id:"customer-A",shop_id:"shop-A",total_price:1}));
  await assertFails(updateDoc(doc(ownerA,"orders","order-A"),{total_price:0}));
  await assertFails(updateDoc(doc(ownerA,"orders","order-A"),{status:"ready_for_pickup"}));
  await assertFails(deleteDoc(doc(ownerA,"orders","order-A")));
});

test("N8J rider coordinates, payments, followers and unknown paths are private",async()=>{
  for(const db of [ownerA,ownerB,customerA,unknown]){
    await assertFails(getDoc(doc(db,"rider_profiles","rider-X")));
    await assertFails(getDoc(doc(db,"payments","payment-A")));
    await assertFails(getDoc(doc(db,"shop_followers","follow-A")));
    await assertFails(getDoc(doc(db,"unreviewed","secret-A")));
    await assertFails(setDoc(doc(db,"unreviewed","fake"),{role:"admin"}));
  }
});

test("N8J emulator test executes exclusively in a demo project",()=>{
  assert.ok(projectId.startsWith("demo-"));
  assert.notEqual(projectId,"localeats-staging");
  assert.notEqual(projectId,"localeats-5e26e");
});
