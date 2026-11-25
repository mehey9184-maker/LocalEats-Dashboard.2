import test from "node:test";
import assert from "node:assert/strict";
import {createReadBackoff,retryAfterMs} from "../src/services/readBackoff.ts";
test("H4D Retry-After seconds, HTTP date, malformed value and minimum delay",()=>{
 const now=Date.UTC(2026,10,25,0,0,0);
 assert.equal(retryAfterMs("90",now),90000);
 assert.equal(retryAfterMs(new Date(now+120000).toUTCString(),now),120000);
 assert.equal(retryAfterMs("bad",now),60000);
 assert.equal(retryAfterMs(null,now),60000);
 assert.equal(retryAfterMs("0",now),1000);
});
test("H4D read cooldown never shortens an existing deadline or affects other scopes",()=>{
 let now=1000;const guard=createReadBackoff(()=>now);
 guard.observe("orders",429,"90");assert.equal(guard.remaining("orders"),90000);
 now+=10000;guard.observe("orders",429,"1");assert.equal(guard.remaining("orders"),80000);
 assert.equal(guard.remaining("shop"),0);guard.observe("shop",503,null);assert.equal(guard.remaining("shop"),0);
 guard.observe("shop",503,"2");assert.equal(guard.remaining("shop"),2000);
 now+=80000;assert.equal(guard.remaining("orders"),0);assert.equal(guard.remaining("shop"),0);
});
