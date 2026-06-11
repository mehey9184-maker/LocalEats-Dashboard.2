import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
console.log(lines.slice(16800 - 1, 16840).map((l, i) => `${16800 + i}: ${l}`).join('\n'));
