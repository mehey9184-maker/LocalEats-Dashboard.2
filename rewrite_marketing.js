import fs from 'fs';
const content = fs.readFileSync('src/App.tsx', 'utf-8');

const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes('const Marketing = ({'));
let returnIdx = -1;
for(let i = startIdx; i < lines.length; i++) {
  if (lines[i].includes('return (')) {
    returnIdx = i;
    break;
  }
}
console.log("Return idx:", returnIdx);
