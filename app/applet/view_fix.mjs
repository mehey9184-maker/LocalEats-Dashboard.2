import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('export default function AppWrapper()'));
console.log(lines.slice(idx - 3, idx + 3).map((l, i) => `${idx - 3 + i}: ${l}`).join('\n'));
