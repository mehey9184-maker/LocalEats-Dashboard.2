import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const route = readFileSync(new URL('../localeats-api/src/routes/merchant.ts',import.meta.url),'utf8');
const coordinates = readFileSync(new URL('../localeats-api/src/routes/merchantShopCoordinates.ts',import.meta.url),'utf8');
const onboarding = readFileSync(new URL('../src/components/CreateShopOnboarding.tsx',import.meta.url),'utf8');

test('merchant onboarding retains Firebase auth, approval and owner isolation', () => {
  assert.match(route,/router\.post\("\/shop", authenticateFirebase/);
  assert.match(route,/\.eq\("owner_id", uid\)/);
  assert.match(route,/approval_status: "pending"/);
  assert.match(route,/is_active: false/);
  assert.match(route,/newShop\.owner_id !== uid/);
  assert.match(route,/newShop\.approval_status !== "pending"/);
  assert.match(route,/newShop\.is_active !== false/);
  assert.match(route,/MERCHANT_SIGNUP_PERSISTENCE_UNCONFIRMED/);
});

test('server-only explicit schema mode prevents uncontrolled fallback/retry', () => {
  assert.match(route,/MERCHANT_SHOP_COORDINATE_COLUMNS_MODE/);
  assert.match(route,/resolveMerchantCoordinateMode/);
  assert.match(route,/\.\.\.createMerchantCoordinates\(body\.latitude, body\.longitude, coordinateMode\)/);
  assert.match(route,/MERCHANT_SCHEMA_CONFIGURATION_UNVERIFIED/);
  assert.match(coordinates,/return "legacy-dual"/);
  assert.match(coordinates,/return \{ latitude, longitude, lat: latitude, lng: longitude \}/);
  assert.match(coordinates,/return \{ latitude, longitude \}/);
  assert.doesNotMatch(route, /insertError\.code === "42703"/); // no unsafe reattempt after unknown insert outcome
  assert.doesNotMatch(route, /VITE_MERCHANT_SHOP_COORDINATE_COLUMNS_MODE/);
});

test('original three-step merchant UI still validates business, location, image, hours',()=>{
  assert.match(onboarding,/getBusinessErrors/);
  assert.match(onboarding,/getLocationErrors/);
  assert.match(onboarding,/uploadImageToCloudinary\(logoFile\)/);
  assert.match(onboarding,/MerchantApi\.createShop\(payload\)/);
  assert.match(onboarding,/normalizeSouthAfricanPhone/);
});
