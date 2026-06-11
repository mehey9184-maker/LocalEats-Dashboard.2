const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\\n');
console.log('Line 16751:', JSON.stringify(lines[16751]));
console.log('Line 16752:', JSON.stringify(lines[16752]));
