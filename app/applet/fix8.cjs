const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\\n');
lines[16751] = 'export default function AppWrapper() {';
fs.writeFileSync('src/App.tsx', lines.join('\\n'));
