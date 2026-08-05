import fs from 'fs';
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('FLYER STUDIO SECTION'));
let endIdx = -1;
for(let i = startIdx; i < lines.length; i++) {
  if (lines[i].includes('const Coupons = ({')) {
    endIdx = i; 
    break;
  }
}
console.log(lines.slice(endIdx - 10, endIdx).join('\n'));
