import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {legacyOrderWriteError} from "../src/lib/legacyOrderWrite.ts";
const parse=file=>{const source=fs.readFileSync(new URL(file,import.meta.url),"utf8");return ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);};
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
test("direct Merchant Firestore order helpers return errors with no saved order",async()=>{
 const ast=parse("../src/lib/firebase.ts");let found=0;
 for(const node of ast.statements)if(ts.isFunctionDeclaration(node) && ["createFirestoreOrder","updateFirestoreOrder"].includes(node.name?.text)){
  const fn=vm.runInNewContext(compile("("+node.getText(ast).replace(/^export /,"")+")"),{legacyOrderWriteError});
  const result=await fn({id:"existing"},{status:"collected"});assert.equal(result.error.code,"PICKUP_CONTRACT_REQUIRED");
  assert.ok(result.data==null);found++;
 }assert.equal(found,2);
});
test("actual generic Firestore bridge rejects every orders mutation before SDK access, retaining reads",async()=>{
 const ast=parse("../src/lib/supabase.ts");const node=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==="FirestoreQueryBuilder");
 let sdkCalls=0;
 const Bridge=vm.runInNewContext(compile(node.getText(ast)+"; FirestoreQueryBuilder;"),{legacyOrderWriteError,db:{},
  collection:()=>{sdkCalls++;return {};},query:()=>({}),getDocs:async()=>({docs:[],size:0})});
 for(const operation of [q=>q.insert({id:"x"}),q=>q.upsert({id:"x"}),q=>q.update({status:"collected"}).eq("id","x"),q=>q.delete().eq("id","x")]){
  const result=await operation(new Bridge("orders"));assert.equal(result.error.code,"PICKUP_CONTRACT_REQUIRED");assert.equal(result.data,null);
 }assert.equal(sdkCalls,0);
 const read=await new Bridge("orders").select();assert.equal(read.error,null);assert.equal(sdkCalls,1);
});
