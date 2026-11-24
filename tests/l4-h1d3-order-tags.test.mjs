import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const baseline='6d25d111f7faa7794013b6979a3cc4126b6a530a';
const old=execFileSync('git',['show',baseline+':src/components/OrdersManagement.tsx'],{encoding:'utf8',maxBuffer:2*1024*1024});
const app=readFileSync('src/components/OrdersManagement.tsx','utf8');
const shared=readFileSync('src/components/OrderTags.tsx','utf8');
function load(source){
 const js=transformSync(source,{loader:'tsx',format:'cjs',jsx:'transform',target:'es2022'}).code;
 const mod={exports:{}};
 new Function('require','module','exports',js)(require,mod,mod.exports);
 return mod.exports;
}
const badge=/^([ \t]*)<div className="flex flex-wrap gap-1 mt-1">\n\1  \{getOrderTags\(order\)\.map\(\(tag\) => \{[\s\S]*?^\1<\/div>$/gm;
const quick=/^([ \t]*)<div className="mt-2\.5 flex items-center justify-between gap-1\.5 border-t border-dashed border-outline-variant\/10 pt-2 text-\[9px\]">\n[\s\S]*?^\1<\/div>$/gm;
const oldBadges=[...old.matchAll(badge)], oldQuick=[...old.matchAll(quick)];
const preamble='import React from "react"; import {clsx} from "clsx"; import {twMerge} from "tailwind-merge"; const cn=(...inputs)=>twMerge(clsx(inputs));\n';
const legacyBadges=oldBadges.map(x=>load(preamble+'export function render(tags){const order={id:"fixture"};const getOrderTags=()=>tags;return ('+x[0]+');}').render);
const legacyQuick=oldQuick.map(x=>load(preamble+'export function render(orderId,manualTags,toggleOrderTag){const order={id:orderId};const orderTags={[orderId]:manualTags};return ('+x[0]+');}').render);
const {OrderTagBadges,QuickOrderTags}=load(shared);
const html=renderToStaticMarkup;
const subsets=Array.from({length:8},(_,n)=>['Rush','VIP','Special'].filter((_,i)=>n&(1<<i)));
function buttons(element){
 if(!React.isValidElement(element))return [];
 if(element.type==='button')return [element];
 return React.Children.toArray(element.props.children).flatMap(buttons);
}
test('exactly four original badge and quick-tag call sites use shared components; parent logic untouched',()=>{
 assert.equal(oldBadges.length,4);assert.equal(oldQuick.length,4);
 const normalized=x=>x[0].split('\n').map(l=>l.slice(x[1].length)).join('\n');
 assert.ok(oldBadges.every(x=>normalized(x)===normalized(oldBadges[0])));
 assert.ok(oldQuick.every(x=>normalized(x)===normalized(oldQuick[0])));
 assert.equal((app.match(/<OrderTagBadges tags=\{getOrderTags\(order\)\} \/>/g)||[]).length,4);
 assert.equal((app.match(/<QuickOrderTags orderId=\{order\.id\} manualTags=\{orderTags\[order\.id\] \|\| \[\]\} onToggle=\{toggleOrderTag\} \/>/g)||[]).length,4);
 const expected='import { OrderTagBadges, QuickOrderTags } from "./OrderTags";\n'+old.replace(badge,(_,i)=>i+'<OrderTagBadges tags={getOrderTags(order)} />').replace(quick,(_,i)=>i+'<QuickOrderTags orderId={order.id} manualTags={orderTags[order.id] || []} onToggle={toggleOrderTag} />');
 assert.equal(app,expected,'No other order-management logic, animations or JSX may change');
});
test('all four legacy badge renderers have byte-identical HTML for normal, empty, automatic and unknown tags',()=>{
 for(const tags of [[],['Rush'],['VIP'],['Large Order'],['Special'],['Other'],['VIP','Large Order','Rush','Special','Other'],...subsets]){
  const actual=html(React.createElement(OrderTagBadges,{tags}));
  for(const original of legacyBadges)assert.equal(actual,html(original(tags)));
 }
});
test('all four quick-tag renderers have byte-identical HTML for every manual selection',()=>{
 for(const manualTags of subsets){
  const actual=html(React.createElement(QuickOrderTags,{orderId:'fixture',manualTags,onToggle:()=>{}}));
  for(const original of legacyQuick)assert.equal(actual,html(original('fixture',manualTags,()=>{})));
 }
});
test('quick tags retain native button order and titles, stop propagation before toggling correct order, no eager writes',()=>{
 for(const orderId of ['order-a','order-b'])for(const manualTags of subsets){
  const events=[];
  const onToggle=(...args)=>events.push(['toggle',...args]);
  const rendered=buttons(QuickOrderTags({orderId,manualTags,onToggle}));
  assert.equal(events.length,0);
  assert.deepEqual(rendered.map(b=>b.props.title),['Toggle Rush','Toggle VIP','Toggle Special']);
  for(const [i,tag] of ['Rush','VIP','Special'].entries()){
   events.length=0;
   rendered[i].props.onClick({stopPropagation:()=>events.push(['stop'])});
   assert.deepEqual(events,[['stop'],['toggle',orderId,tag]]);
   for(const original of legacyQuick){
    events.length=0;
    buttons(original(orderId,manualTags,onToggle))[i].props.onClick({stopPropagation:()=>events.push(['stop'])});
    assert.deepEqual(events,[['stop'],['toggle',orderId,tag]]);
   }
  }
 }
});
