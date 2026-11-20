import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertMerchantClientMutationAllowed,
  isMerchantClientMutationBlocked,
  MERCHANT_STAGING_WRITE_DISABLED,
} from "../../src/lib/merchantStagingNoWrite.ts";

test("staging Firebase project blocks client mutations even when both old flags are absent", () => {
  const env = { VITE_FIREBASE_PROJECT_ID: "localeats-staging" };
  assert.equal(isMerchantClientMutationBlocked(env), true);
  assert.throws(
    () => assertMerchantClientMutationAllowed(env),
    error => error instanceof Error && error.message === MERCHANT_STAGING_WRITE_DISABLED,
  );
});

test("staging Firebase project blocks client mutations when old flags are incorrectly false", () => {
  assert.equal(isMerchantClientMutationBlocked({
    VITE_FIREBASE_PROJECT_ID: "localeats-staging",
    VITE_MERCHANT_STAGING_ONLY: "false",
    VITE_MERCHANT_PREVIEW_READ_ONLY: "false",
  }), true);
});

test("either old staging marker still blocks writes independently", () => {
  assert.equal(isMerchantClientMutationBlocked({ VITE_MERCHANT_STAGING_ONLY: "true" }), true);
  assert.equal(isMerchantClientMutationBlocked({ VITE_MERCHANT_PREVIEW_READ_ONLY: "true" }), true);
});

test("production Firebase identity without staging flags is not changed", () => {
  assert.equal(isMerchantClientMutationBlocked({VITE_FIREBASE_PROJECT_ID:"localeats-5e26e"}), false);
  assert.doesNotThrow(() => assertMerchantClientMutationAllowed({VITE_FIREBASE_PROJECT_ID:"localeats-5e26e"}));
  assert.equal(isMerchantClientMutationBlocked({}), false);
  assert.equal(isMerchantClientMutationBlocked(null), false);
});

test("mutating Firebase Auth/Storage entrypoints check guard before SDK side effects", () => {
  const src = readFileSync(new URL("../../src/lib/firebase.ts", import.meta.url), "utf8");
  const operations = [
    ["firebaseSignInWithGoogle", "signInWithPopup(auth"],
    ["firebaseSignUp", "createUserWithEmailAndPassword(auth"],
    ["firebaseResetPassword", "sendPasswordResetEmail(auth"],
    ["updateFirebaseUserProfile", "updateProfile(currentUser"],
    ["uploadImageToFirebaseStorage", "uploadBytes(fileRef"],
  ];
  for (const [functionName, operation] of operations) {
    const start = src.indexOf(`export async function ${functionName}(`);
    assert.notEqual(start, -1, `Missing ${functionName}`);
    const slice = src.slice(start, start + 1800);
    const guard = slice.indexOf("ensureMerchantClientMutationAllowed();");
    const sdk = slice.indexOf(operation);
    assert.ok(guard >= 0, `Missing staging write guard: ${functionName}`);
    assert.ok(sdk >= 0, `Cannot find expected SDK operation: ${functionName}`);
    assert.ok(guard < sdk, `SDK side effect precedes guard: ${functionName}`);
  }
});

test("existing-email login remains available for a valid Firebase staging identity", () => {
  const src = readFileSync(new URL("../../src/lib/firebase.ts", import.meta.url), "utf8");
  const start = src.indexOf("export async function firebaseSignIn(");
  const end = src.indexOf("export async function firebaseSignInWithGoogle(");
  assert.ok(start >= 0 && end > start);
  const login = src.slice(start, end);
  assert.match(login, /signInWithEmailAndPassword\(auth,/);
  assert.doesNotMatch(login, /ensureMerchantClientMutationAllowed/);
});
