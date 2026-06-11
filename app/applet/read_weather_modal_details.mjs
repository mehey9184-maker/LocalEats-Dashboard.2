import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
console.log('=== 18270 to 18430 ===');
console.log(lines.slice(18269, 18430).map((l, i) => `${18270 + i}: ${l}`).join('\n'));
