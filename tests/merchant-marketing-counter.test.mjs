import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import QRCode from 'qrcode';
const require = createRequire(import.meta.url);
async function load(path) {
 const result = await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',write:false,packages:'external'});
 const mod={exports:{}}; new Function('require','module','exports',result.outputFiles[0].text)(require,mod,mod.exports); return mod.exports;
}
const sign = await load('src/components/marketing/counterSign.ts');
const policy = await load('src/components/marketing/campaignDraft.ts');

test('QR links keep the verified origin, encode exact shop IDs and reject foreign or non-menu destinations',()=>{
 const url=sign.shopMenuUrl('shop & /?name');
 assert.equal(new URL(url).origin,'https://www.localeatssa.co.za');
 assert.equal(new URL(url).searchParams.get('shopId'),'shop & /?name');
 assert.equal(sign.validateMenuUrl(url),url);
 for(const bad of ['https://localeats.co.za/?shopId=x','https://evil.test/?shopId=x','https://www.localeatssa.co.za/','https://www.localeatssa.co.za/?shopId=x&dineIn=true','https://www.localeatssa.co.za/?shopId=x#login','https://www.localeatssa.co.za/?shopId=a&shopId=b']) assert.throws(()=>sign.validateMenuUrl(bad));
 for(const id of [null,undefined,'',' '])assert.throws(()=>sign.shopMenuUrl(id));
});
test('print QR reserves four quiet modules, uses high error correction and bounds the centre logo',()=>{
 assert.equal(sign.QR_OPTIONS.margin,4);assert.equal(sign.QR_OPTIONS.errorCorrectionLevel,'H');
 assert.equal(sign.QR_OPTIONS.color.dark,'#0F172A');assert.equal(sign.QR_OPTIONS.color.light,'#FFFFFF');
 for(const size of [528,784,1200]) {const box=sign.centreLogoBox(size);assert.ok(box.outer/size<=.16);assert.ok(box.left>size*.4);assert.ok(box.inset>0);}
});
test('A4/A5 PDFs contain website, honest pickup invitation and actual scan image, never a blank QR',async()=>{
 const url=sign.shopMenuUrl('shop-print-fixture'), qr=await QRCode.toDataURL(url,sign.QR_OPTIONS);
 for(const [format,width] of [['a4',210],['a5',148]]) {
  const doc=sign.counterSignPdf({shopName:'Print fixture',url,qr,headline:'Hungry? Scan the menu.'},format);
  assert.ok(Math.abs(doc.internal.pageSize.getWidth()-width)<1);
  const pdf=doc.output();assert.match(pdf,/www\.localeatssa\.co\.za/);assert.match(pdf,/Hungry\? Scan the menu\./);
  assert.match(pdf,/Pickup only/);assert.match(pdf,/Ordering depends on/);assert.match(pdf,/\/Subtype \/Image/);
 }
 assert.throws(()=>sign.counterSignPdf({shopName:'Fixture',url,qr:'',headline:'Scan'}));
});
test('counter screen renders small, accessible controls and disables exports without verified shop details',async()=>{
 const {CounterSignStudio}=await load('src/components/marketing/CounterSignStudio.tsx');
 const html=renderToStaticMarkup(React.createElement(CounterSignStudio,{}));
 assert.match(html,/www\.localeatssa\.co\.za/);assert.match(html,/Hungry\? Scan the menu\./);
 assert.match(html,/LocalEats logo in the centre/);assert.match(html,/A4 PDF/);assert.match(html,/A5 PDF/);
 assert.equal((html.match(/disabled=""/g)||[]).length,3);assert.doesNotMatch(html,/QR_Code_default|dineIn|table=/);
});
test('message copy uses actual menu prices and cannot activate discounts',()=>{
 const text=policy.menuSpotlight('Fixture shop',sign.shopMenuUrl('fixture'),{id:'item',name:'Kota',price:25});
 assert.match(text,/R25\.00/);assert.match(text,/Pickup only/);assert.match(text,/when ordering is available/);
 assert.doesNotMatch(text,/delivery|discount|voucher|FREE/i);
 assert.doesNotMatch(policy.menuSpotlight('Fixture shop',sign.shopMenuUrl('fixture')),/R25/);
});
test('marketing summaries isolate shops, exclude invented identities and never infer payment',()=>{
 const summary=policy.marketingOrderSummary([
  {shop_id:'a',user_id:'u',total_price:25,payment_status:'unpaid',payment_method:'card'},
  {shop_id:'a',user_id:'u',total_price:50,payment_status:'paid'},
  {shop_id:'a',customer_name:'Someone',total_price:10},
  {shop_id:'b',user_id:'other',total_price:999,payment_status:'paid'}
 ],'a');
 assert.equal(summary.totalUniqueDiners,1);assert.equal(summary.repeatCount,1);assert.equal(summary.totalOrders,3);
 assert.equal(summary.paidValue,50);assert.equal(policy.marketingOrderSummary([], 'a').avgSpend,null);
 assert.equal(policy.marketingOrderSummary([{shop_id:'a',total_price:5}]).totalOrders,0);
});
test('active Marketing routes cannot mount old simulated campaigns, targeted sends or dine-in QR tools',()=>{
 const source=readFileSync('src/components/Marketing.tsx','utf8');
 assert.doesNotMatch(source,/<CustomerReEngagement|<FlashDealsStudio|<TableTentGenerator/);
 assert.match(source,/CounterSignStudio/);assert.match(source,/marketing\/CampaignDrafts/);
 const drafts=readFileSync('src/components/marketing/CampaignDrafts.tsx','utf8');
 assert.doesNotMatch(drafts,/fetch\(|window\.open|active: true|activated for customers|20% off/);
 assert.match(drafts,/Nothing was published or sent/);
});
