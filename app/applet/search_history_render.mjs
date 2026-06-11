import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const idx = lines.findIndex((l, i) => i > 8960 && l.includes('viewMode === "history"'));
console.log(`Found on line ${idx + 1}`);
console.log(lines.slice(idx, idx + 100).map((l, i) => `${idx + i + 1}: ${l}`).join('\n'));
