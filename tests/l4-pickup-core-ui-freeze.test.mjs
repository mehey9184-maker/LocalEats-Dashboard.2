import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Baseline fingerprint: existing approved Merchant main 10556f752aa93622d5b20237ea3860ed2bd68f76.
// Protects source className sequences, not a substitute for pixel-level device acceptance.
const freeze={
 'src/App.tsx': [553,'4d319062'],
 'src/components/ShopProfile.tsx': [114,'34bb018d'],
 // Exception: exact previously approved pickup-first #238 tour blob 7a1b702b9b230d90e51728e53ee763b253acdf5e.
 'src/components/OnboardingTour.tsx': [23,'1a5c1594'],
 'src/components/MenuManagement.tsx': [107,'6774eb7e'],
 'src/components/Marketing.tsx': [246,'f861fbf'],
 'src/components/OrdersFocusedWorkspace.tsx': [61,'7dde5f4c'],
 'src/components/OrdersStyleBoard.tsx': [37,'e4dca70c'],
};
function fingerprint(source){
 const classes=(source.match(/className=(?:\{[^}]*\}|["'][^"']*["'])/g)||[]).map(x=>x.replace(/\s+/g,' '));
 const text=classes.join('\n');
 let hash=2166136261;
 for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}
 return [classes.length,(hash>>>0).toString(16)];
}
for(const [path,expected] of Object.entries(freeze)){
 test('Original merchant layout classes preserved: '+path,()=>{
  const actual=fingerprint(readFileSync(path,'utf8'));
  assert.deepEqual(actual,expected);
 });
}
test('Original merchant tour remains; isolated fictional workshop never imported',()=>{
 const app=readFileSync('src/App.tsx','utf8');
 const tour=readFileSync('src/components/OnboardingTour.tsx','utf8');
 assert.match(tour,/Welcome to LocalEats Merchant/);
 assert.match(tour,/Ready to Practise, Not Yet Live/);
 assert.match(tour,/Rider dispatch and delivery are not enabled/);
 assert.match(tour,/role="dialog"/);
 assert.match(tour,/max-h-\[calc\(100dvh-1\.5rem\)\]/);
 assert.doesNotMatch(tour,/intelligent rider pool|Rider Logistics Track|never misses an order/);
 assert.doesNotMatch(app,/preview\/merchant-workshop|l4-r1g-cloudflare-workshop/);
});
