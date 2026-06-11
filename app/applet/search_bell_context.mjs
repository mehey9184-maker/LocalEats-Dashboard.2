import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
console.log(lines.slice(19220, 19250).map((l, i) => `${19220 + i}: ${l}`).join('\n'));
