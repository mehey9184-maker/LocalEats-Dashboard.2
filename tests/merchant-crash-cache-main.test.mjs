import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("Merchant runtime errors never destroy service worker, cache or auth session",()=>{
  assert.match(source,/initGlobalErrorLogging\(\)/);
  assert.match(source,/handleGlobalCrash\("unhandled error"/);
  assert.match(source,/handleGlobalCrash\("unhandled promise rejection"/);
  assert.doesNotMatch(source,/navigator\.serviceWorker\.getRegistrations\(/);
  assert.doesNotMatch(source,/\.unregister\(\)/);
  assert.doesNotMatch(source,/window\.location\.reload\(/);
  assert.doesNotMatch(source,/localStorage\.removeItem\(/);
  assert.doesNotMatch(source,/sessionStorage\.clear\(/);
});

test("existing ErrorBoundary remains the recovery UI and startup initializes safely",()=>{
  assert.match(source,/<ErrorBoundary>/);
  assert.match(source,/initTimeSync\(\)\.catch/);
  assert.match(source,/cleanLocalStorageCache\(\)/);
});
