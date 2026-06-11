import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
lines.forEach((l, i) => { if (l.includes('<Bell')) console.log(`Found on line ${i}: ${l.trim()}`); });
