import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('FLYER MODAL'));
console.log("Flyer modal at:", startIdx);

// It seems there is no AnimatePresence around the FLYER MODAL!
let endIdx = -1;
for(let i = startIdx; i < lines.length; i++) {
  if (lines[i].includes('</AnimatePresence>')) {
    endIdx = i; 
    break;
  }
}
console.log("Animate presence end at:", endIdx);
