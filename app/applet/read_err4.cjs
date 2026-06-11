const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\\n');
const idx = lines.findIndex(l => l.includes('function AppWrapper'));
console.log(idx);
console.log(lines.slice(idx, idx+10));
