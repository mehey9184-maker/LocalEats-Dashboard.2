import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const read = p => readFileSync(new URL('../'+p,import.meta.url));
const str = p => read(p).toString('utf8');
const check = (path,size) => {const p=read(path);assert.deepEqual([...p.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(p.readUInt32BE(16),size);assert.equal(p.readUInt32BE(20),size);assert.equal(p[25],6);let chunks=[];for(let i=8;i<p.length;){const n=p.readUInt32BE(i);const k=p.toString('ascii',i+4,i+8);if(k==='IDAT')chunks.push(p.subarray(i+8,i+8+n));i+=n+12;}assert.equal(inflateSync(Buffer.concat(chunks)).length,size*(size*4+1));};
test('brand PNGs decode and match declared dimensions',()=>{
  execFileSync(process.execPath,['scripts/generate-pwa-icons.mjs']);
  check('public/logo.png',512);check('public/pwa-icon-192.png',192);check('public/pwa-icon-512.png',512);check('public/apple-touch-icon.png',180);
  
});
test('asset identity and manifest references',()=>{
  const svg=str('public/localeats-brand-v1.svg');
  assert.equal([...svg.matchAll(/<path d=/g)].length,5);
  assert.match(svg,/#C2410C/);
  assert.ok(str('index.html').includes('apple-touch-icon.png'));
  assert.equal(str('public/icon.svg'),svg);assert.ok(str('src/components/marketing/counterSign.ts').includes('errorCorrectionLevel: "H"'));
  assert.ok(str('vite.config.ts').includes('pwa-icon-192.png'));
  assert.ok(str('vite.config.ts').includes('pwa-icon-512.png'));
});
