import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("Merchant profile shows avatar but never uploads photos before secure profile persistence", () => {
  const source=read("src/components/EditProfile.tsx");
  assert.match(source,/merchant-avatar-upload-unavailable/);
  assert.match(source,/Profile photo changes are unavailable until secure profile saving is enabled/);
  assert.match(source,/formData\.avatarUrl/);
  assert.doesNotMatch(source,/uploadImageToFirebaseStorage|imageCompression|uploadBytes\s*\(|onDrop\s*=|type="file"/);
});

test("Merchant profile writes must remain fail closed until a server-authorized endpoint exists", () => {
  const adapter=read("src/lib/supabase.ts");
  const app=read("src/App.tsx");
  assert.match(adapter,/async updateUser\(_attributes\?/);
  assert.match(adapter,/Merchant profile changes are unavailable until secure profile saving is enabled\. No changes were saved\./);
  assert.match(app,/await supabase\.auth\.updateUser\(/);
  assert.match(app,/if \(error\) throw error/);
});

test("Merchant pickup boundary stays typed and never enables the legacy browser write path", () => {
  const api=read("src/services/MerchantApi.ts");
  const firebase=read("src/lib/firebase.ts");
  assert.match(api,/\[key: string\]: unknown/);
  assert.match(api,/hasPendingPickupCommand\(order:\{id\?:unknown\}\)/);
  assert.match(api,/pickupMutationsDisabled\(\)/);
  assert.match(firebase,/legacyOrderWriteError\(\)/);
});
