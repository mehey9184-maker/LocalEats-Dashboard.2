const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\\n');
for (let i = 16740; i < 16760; i++) {
  if (lines[i]) console.log(i + ':', JSON.stringify(lines[i]));
}
