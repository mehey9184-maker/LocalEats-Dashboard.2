import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
console.log(lines.slice(80, 110).map((l, i) => `${80 + i}: ${l}`).join('\n'));
