import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
console.log(lines.slice(8880, 8970).map((l, i) => `${8880 + i}: ${l}`).join('\n'));
