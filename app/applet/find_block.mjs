import fs from 'fs'; 
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n'); 
let start = 3862;
let blocks = 1;
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i].includes('{')) blocks += (lines[i].match(/\{/g) || []).length;
  if (lines[i].includes('}')) blocks -= (lines[i].match(/\}/g) || []).length;
  if (blocks <= 0) { console.log('ends at line', i); break; }
}
