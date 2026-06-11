const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\\n');
console.log('Total lines:', lines.length);
for (let i = lines.length - 20; i < lines.length; i++) {
  console.log(i + ':', JSON.stringify(lines[i]));
}
