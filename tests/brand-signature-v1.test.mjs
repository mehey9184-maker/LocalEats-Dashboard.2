import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/localeats-brand-v1.svg', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/components/LocalEatsLogo.tsx', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const paths = text => [...text.matchAll(/<path d="([^"]+)"/g)].map(match => match[1]);
test('app mark exactly matches approved favicon geometry and brand colour', () => {
  assert.equal(paths(svg).length, 5);
  assert.deepEqual(paths(source), paths(svg));
  assert.match(source, /fill="#C2410C"/);
  assert.match(source, /React\.useId\(\)/);
  assert.match(source, /width="49\.23" height="49\.23"/);
  assert.match(source, /viewBox="0 0 512 512"/);
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="\/localeats-brand-v1\.svg"/);
});
