import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');
// null out lines 88 and 89 (index)
lines.splice(88, 2);
fs.writeFileSync('src/App.tsx', lines.join('\n'));
