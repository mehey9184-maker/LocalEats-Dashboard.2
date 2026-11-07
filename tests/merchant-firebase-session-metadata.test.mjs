import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
import {projectCachedMerchantSession, projectMerchantSessionMetadata} from "../src/lib/merchantSessionMetadata.ts";

const path = new URL("../src/lib/firebase.ts", import.meta.url);
const source = ts.createSourceFile(path.pathname, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);

function firebaseFunction(name, dependencies) {
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration);
  const code = ts.transpileModule(declaration.getText(source).replace(/^export /, ""), {
    compilerOptions: {target: ts.ScriptTarget.ES2022},
  }).outputText;
  return new Function(...Object.keys(dependencies), code + "\nreturn " + name)(...Object.values(dependencies));
}

test("session metadata preserves contact and display preferences while rejecting authority fields", async () => {
  const format = firebaseFunction("formatFirebaseUserSession", {
    projectMerchantSessionMetadata, db: {}, doc: () => ({}),
    getDoc: async () => ({exists: () => true, data: () => ({
      full_name: "Fixture name", phone: "Fixture phone", dark_mode: false, marketing_preferences: false,
      role: "super_admin", is_admin: true, shop_id: "foreign", permanent_owner_id: "foreign",
    })}),
  });
  const session = await format({uid: "fixture", email: "fixture@example.invalid", displayName: null});
  assert.deepEqual(session.user_metadata, {
    full_name: "Fixture name", name: "Fixture name", phone: "Fixture phone", dark_mode: false, marketing_preferences: false,
  });
});

test("merchant signup stores contact details without a client-assigned role", async () => {
  let saved;
  const signUp = firebaseFunction("firebaseSignUp", {
    auth: {}, db: {}, createUserWithEmailAndPassword: async () => ({user: {uid: "fixture"}}),
    updateProfile: async () => {}, doc: () => ({}), setDoc: async (_ref, data) => { saved = data; },
    formatFirebaseUserSession: async () => ({id: "fixture"}), localStorage: {setItem() {}},
  });
  await signUp(" fixture@example.invalid ", "synthetic", {full_name: "Fixture", phone: "Synthetic"});
  assert.equal(saved.uid, "fixture");
  assert.equal(saved.full_name, "Fixture");
  assert.equal(saved.phone, "Synthetic");
  assert.equal(Object.hasOwn(saved, "role"), false);
});

test("legacy cached metadata cannot restore role or shop authority", () => {
  const cached = {
    id: "fixture", role: "admin", app_metadata: {role: "admin"},
    user_metadata: {phone: "Synthetic", dark_mode: false, role: "merchant", shop_id: "other"},
  };
  const projected = projectCachedMerchantSession(cached);
  assert.equal(projected.id, "fixture");
  assert.equal(Object.hasOwn(projected, "role"), false);
  assert.deepEqual(projected.app_metadata, {});
  assert.deepEqual(projected.user_metadata, {phone: "Synthetic", dark_mode: false});
  assert.equal(projectCachedMerchantSession({role: "admin"}), null);
  const facade = readFileSync(new URL("../src/lib/supabase.ts", import.meta.url), "utf8");
  assert.equal((facade.match(/projectCachedMerchantSession\(JSON\.parse\(cached\)\)/g) ?? []).length, 2);
});
