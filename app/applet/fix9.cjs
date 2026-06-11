const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\\n');
lines = lines.map(line => line.replace(/\\\\n/g, ''));
fs.writeFileSync('src/App.tsx', lines.join('\\n'));
