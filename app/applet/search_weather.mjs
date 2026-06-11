import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const idx = lines.findIndex((l, i) => i > 16658 && l.includes('const [currentWeather'));
console.log(`Found on line ${idx + 1}`);
console.log(lines.slice(idx, idx + 5).map((l, i) => `${idx + i + 1}: ${l}`).join('\n'));
