import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
console.log(lines.slice(17100 - 1, 17180).map((l, i) => `${17100 + i}: ${l}`).join('\n'));
