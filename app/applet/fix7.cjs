const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\\n');
lines = lines.map(l => {
  if (l.includes('export default function AppWrapper')) {
     return l.replace(/\\\\n/g, ''); 
  }
  return l;
});
fs.writeFileSync('src/App.tsx', lines.join('\\n'));
