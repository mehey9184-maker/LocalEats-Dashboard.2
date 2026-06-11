import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
console.log(lines.slice(16720 - 1, 16800).map((l, i) => `${16720 + i}: ${l}`).join('\n'));
