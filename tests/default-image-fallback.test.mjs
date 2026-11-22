import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const photo = read('src/components/MerchantPhoto.tsx');
const menu = read('src/components/MenuManagement.tsx');
const home = read('src/components/DashboardOverview.tsx');
const shop = read('src/components/ShopProfile.tsx');
const profile = read('src/components/EditProfile.tsx');

test('merchant missing and failed image states use neutral branded artwork', () => {
  assert.match(photo, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(photo, /missingPhoto\(src\) \|\| failed/);
  assert.match(photo, /No photo yet/);
  assert.match(photo, /Store/);
  assert.doesNotMatch(photo, /unsplash\.com/);
});

test('merchant Home, Menu, and Shop Profile honor uploaded images first', () => {
  assert.match(menu, /<MerchantPhoto/);
  assert.match(home, /<MerchantPhoto src=\{item\.image_url\}/);
  assert.match(shop, /<MerchantPhoto src=\{formData\.logo_url\}/);
  assert.doesNotMatch(shop, /DEFAULT_SHOP_LOGO/);
});

test('merchant avatar defaults to initials without overwriting profile information', () => {
  assert.match(profile, /failedAvatarUrl !== formData\.avatarUrl/);
  assert.match(profile, /Default profile initials/);
  assert.match(profile, /setFailedAvatarUrl/);
});
