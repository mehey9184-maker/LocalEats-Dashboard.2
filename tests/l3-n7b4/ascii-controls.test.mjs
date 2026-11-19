import assert from "node:assert/strict";
import test from "node:test";
import {containsAsciiControl,containsAsciiControlOrWhitespace} from "../../localeats-api/src/security/asciiControls.ts";

test("Reject every ASCII control character and DEL, including embedded tokens",()=>{
 for(let x=0;x<=31;x++) {
  assert.equal(containsAsciiControl("safe"+String.fromCharCode(x)+"uid"),true,"ASCII "+x);
  assert.equal(containsAsciiControlOrWhitespace(String.fromCharCode(x)),true,"ASCII "+x);
 }
 assert.equal(containsAsciiControl("safe"+String.fromCharCode(127)+"uid"),true);
 assert.equal(containsAsciiControlOrWhitespace(String.fromCharCode(127)),true);
 assert.equal(containsAsciiControl("my-kota-ivory-park"),false);
 assert.equal(containsAsciiControl("VALID-UID_012345"),false);
});
test("Whitespace-aware identity guard retains Unicode JS whitespace protection",()=>{
 for(const v of [" ","\t","\n","\r","\u00a0","\ufeff","\u2007","\u2028","\u2029","\u3000"]){
  assert.equal(containsAsciiControlOrWhitespace("uid"+v+"other"),true,JSON.stringify(v));
 }
 for(const v of ["UID123","customer@example.test","shop-my-kota-ivory-park","a_b-c"]){
  assert.equal(containsAsciiControlOrWhitespace(v),false,v);
 }
});
test("Non-whitespace identifiers retain their existing validation behavior",()=>{
 assert.equal(containsAsciiControl("A\u00a0B"),false);
 assert.equal(containsAsciiControlOrWhitespace("A\u00a0B"),true);
});
