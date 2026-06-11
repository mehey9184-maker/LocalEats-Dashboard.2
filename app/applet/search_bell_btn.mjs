import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const idx = 19220;
console.log(lines.slice(idx, idx + 40).map((l, i) => `${idx + i}: ${l}`).join('\n'));
