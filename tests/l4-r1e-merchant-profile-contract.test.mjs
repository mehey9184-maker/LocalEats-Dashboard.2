import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(path,"utf8");
const app=read("src/App.tsx"),account=read("src/components/EditProfile.tsx"),storefront=read("src/components/ShopProfile.tsx"),client=read("src/services/merchantProfileApi.ts");
const api=read("localeats-api/src/routes/merchantProfiles.ts"),contract=read("localeats-api/src/routes/merchantProfileContract.ts");
test("storefront save cannot bypass API to update Firestore, Supabase, rider profiles or the fake follower demo",()=>{
 assert.match(storefront,/await MerchantProfileApi\.getShop\(shop\.id\)/);
 assert.match(storefront,/await MerchantProfileApi\.saveShop\(/);
 assert.doesNotMatch(storefront,/updateFirestoreShop/);
 assert.doesNotMatch(storefront,/\.from\("shops"\)\s*\.update/);
 assert.doesNotMatch(storefront,/\.from\("rider_profiles"\)\s*\.update/);
 assert.doesNotMatch(storefront,/supabase\.auth\.updateUser/);
 assert.doesNotMatch(storefront,/\.from\("shop_followers"\)/);
 assert.match(storefront,/setIsSaveSuccess\(true\)/);
});
test("account save is gated behind verified API readback, and login email is not an editable profile field",()=>{
 const scope=app.slice(app.indexOf("const handleSaveProfile"),app.indexOf("if (isSessionChecking && !user)"));
 assert.match(scope,/await MerchantProfileApi\.saveAccount\(/);
 assert.doesNotMatch(scope,/supabase\.auth\.updateUser/);
 assert.match(account,/await|MerchantProfileApi\.getAccount\(/);
 assert.match(account,/verifiedRevision===null/);
 assert.match(account,/readOnly/);
 assert.match(account,/expectedRevision:verifiedRevision/);
});
test("server alone decides merchant ownership and profile writes cannot set privileges or coordinates",()=>{
 assert.match(api,/options\.store\.ownedShop\(uid\)/);
 assert.match(api,/merchantAccountWritesEnabled/);
 assert.match(api,/merchantShopWritesEnabled/);
 assert.match(api,/options\.store\.readAccount\(context\.uid\)/);
 assert.match(api,/options\.store\.readShop\(context\.uid,context\.shopId\)/);
 assert.match(api,/MERCHANT_SHOP_SAVE_UNCONFIRMED/);
 assert.match(contract,/FORBIDDEN_PROFILE_FIELD/);
 assert.doesNotMatch(contract,/is_active","approval_status/);
 assert.match(client,/auth\.currentUser\?\.uid/);
 assert.match(client,/expected_revision\+1/);
});
