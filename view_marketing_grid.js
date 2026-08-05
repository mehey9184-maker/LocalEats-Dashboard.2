import fs from 'fs';
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('id="marketing_primary_tools"'));
let endIdx = -1;
for(let i = startIdx; i < lines.length; i++) {
  if (lines[i].includes('FLYER MODAL')) {
    endIdx = i; 
    break;
  }
}
console.log(lines.slice(startIdx, endIdx).join('\n'));
