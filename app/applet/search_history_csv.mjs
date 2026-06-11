import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('exportToCSV = ()'));
console.log(`Found on line ${idx + 1}`);
console.log(lines.slice(idx - 5, idx + 40).map((l, i) => `${idx - 5 + i + 1}: ${l}`).join('\n'));
