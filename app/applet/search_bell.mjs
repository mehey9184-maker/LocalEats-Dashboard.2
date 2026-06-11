import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('<Bell'));
console.log(`Found on line ${start}`);
console.log(lines.slice(start - 10, start + 30).map((l, i) => `${start - 10 + i}: ${l}`).join('\n'));
