import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const marketing = readFileSync(new URL('../src/components/Marketing.tsx', import.meta.url), 'utf8');
const flyer = marketing.slice(
  marketing.indexOf('const generateRewardsTeaserPdf ='),
  marketing.indexOf('// Direct Browser Print')
);

test('merchant promo tools never claim delivery or publicly enabled ordering', () => {
  assert.doesNotMatch(marketing, /Fast Local Delivery|FastDelivery|RIDER DELIVERY|Live & Accepting Orders|TOWNSHIP DELIVERY NOW AVAILABLE/i);
  assert.match(marketing, /Pickup Only/);
  assert.match(marketing, /Pay at Shop/);
  assert.match(marketing, /Pickup ordering availability is shown inside LocalEats/);
  assert.match(marketing, /Share your LocalEats shop link so customers can browse menus/);
});

test('the free-kota flyer is clearly future-facing and does not create a live offer', () => {
  assert.match(flyer, /A FREE KOTA\?/);
  assert.match(flyer, /COMING SOON/);
  assert.match(flyer, /Preview only - rewards are not active/);
  assert.match(flyer, /No purchases currently earn or redeem free food/);
  assert.match(flyer, /Launch date, eligible shops and full terms will be shown in the app/);
  assert.match(marketing, /onClick=\{generateRewardsTeaserPdf\}/);
  assert.doesNotMatch(flyer, /fetch\(|supabase\.|createOrder|claimReward|redeemReward/);
});

test('teaser needs a fresh QR for the selected shop and cannot silently omit it', () => {
  assert.match(marketing, /qrState\?\.sourceUrl === storeUrl \? qrState\.image : ""/);
  assert.match(marketing, /setQrState\(\{ sourceUrl: storeUrl, image: url \}\)/);
  assert.match(flyer, /if \(!qrDataUrl\)/);
  assert.match(flyer, /doc\.addImage\(qrDataUrl, "PNG", 65, 116, 80, 80\)/);
  assert.match(flyer, /doc\.save\("LocalEats_Rewards_Free_Kota_Coming_Soon\.pdf"\)/);
});
