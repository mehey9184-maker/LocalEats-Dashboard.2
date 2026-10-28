import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";
const root=new URL("../",import.meta.url);
const baseline=execFileSync("git",["show","5f143800b89c47bb6587541f73e51e6d15f0d675:firestore.rules"],{cwd:root,encoding:"utf8"}).replaceAll("\r\n","\n");
const current=fs.readFileSync(new URL("../firestore.rules",import.meta.url),"utf8").replaceAll("\r\n","\n");
function orderBlock(source){
 const start=source.indexOf("    match /orders/{orderId} {");assert.ok(start>=0);
 const end=source.indexOf("\n    }",start)+6;assert.ok(end>start);
 return {before:source.slice(0,start),block:source.slice(start,end),after:source.slice(end)};
}
test("root orders writes are explicitly denied with unchanged read policy",()=>{
 const a=orderBlock(baseline),b=orderBlock(current);
 assert.equal(b.after,a.after); // All following Rider, chat, payments etc unchanged.
 // Comments immediately before the block may change; all policy text before it must match.
 const policies=source=>source.split("\n").filter(l=>!l.trim().startsWith("//")).join("\n");
 assert.equal(policies(b.before),policies(a.before));
 assert.equal((current.match(/match \/orders\//g)||[]).length,1);
 assert.ok(!/allow[^;]*write[^;]*true/.test(b.block));
 assert.ok(/allow create, update, delete: if false;/.test(b.block)||
  ["create","update","delete"].every(op=>new RegExp("allow "+op+": if false;").test(b.block)));
 const read=block=>block.slice(block.indexOf("allow read"),block.indexOf(";",block.indexOf("allow read"))+1);
 assert.equal(read(b.block),read(a.block).replace("read, write","read"));
});
