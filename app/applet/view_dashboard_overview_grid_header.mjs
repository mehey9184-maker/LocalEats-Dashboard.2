import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
console.log(lines.slice(4650 - 1, 4690).map((l, i) => `${4650 + i}: ${l}`).join('\n'));
