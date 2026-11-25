import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const src=readFileSync('src/lib/supabase.ts','utf8');
const ast=ts.createSourceFile('supabase.ts',src,ts.ScriptTarget.Latest,true);
function extract(name){
 const decl=ast.statements.filter(ts.isVariableStatement).flatMap(x=>x.declarationList.declarations).find(x=>x.name.getText(ast)==='supabase');
 assert.ok(decl?.initializer&&ts.isObjectLiteralExpression(decl.initializer));
 const member=decl.initializer.properties.find(x=>x.name?.getText(ast)===name);
 assert.ok(member);
 const js=ts.transpileModule('const fixture={'+member.getText(ast)+'};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function(js+';return fixture')()[name];
}
test('unsupported legacy RPC never claims persistence',async()=>{
 const rpc=extract('rpc');const r=await rpc('synthetic',{});
 assert.equal(r.data,null);assert.match(r.error.message,/No changes were saved/);
});
test('unsupported legacy storage cannot fabricate an uploaded path or public URL',async()=>{
 const storage=extract('storage').from('fixture');
 const r=await storage.upload('synthetic.jpg');
 assert.equal(r.data,null);assert.match(r.error.message,/No file was uploaded/);
 assert.equal(storage.getPublicUrl('synthetic.jpg').data.publicUrl,null);
});
test('browser heartbeat cannot mutate shop timestamps or claim storefront readiness',()=>{
 const app=readFileSync('src/App.tsx','utf8');
 assert.doesNotMatch(app,/syncHeartbeat|Dashboard Inactive for 4\+ Days|\.update\(\{\s*updated_at:\s*timeNow\s*\}\)/);
 assert.match(app,/MerchantApi\.getOrders\(signal\)/);
 assert.match(app,/MerchantApi\.getMerchantShop\(\)/);
 assert.match(app,/merchantShopGate\.status/);
 assert.match(src,/legacyOrderWriteError\(\)/);
});
