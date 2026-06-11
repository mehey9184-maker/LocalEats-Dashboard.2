import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
console.log('=== 16600 to 16750 ===');
console.log(lines.slice(16599, 16750).map((l, i) => `${16600 + i}: ${l}`).join('\n'));
