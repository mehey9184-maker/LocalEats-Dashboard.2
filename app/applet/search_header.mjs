import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('<header'));
console.log(`Found on line ${idx}`);
console.log(lines.slice(idx, idx + 80).map((l, i) => `${idx + i}: ${l}`).join('\n'));
