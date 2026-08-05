import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('const Marketing = ({'));
let returnIdx = -1;
for(let i = startIdx; i < lines.length; i++) {
  if (lines[i].includes('return (') && lines[i].trim() === 'return (') {
    returnIdx = i;
    break;
  }
}

// Find the end of Marketing by looking for the next `const Coupons = `
let endIdx = -1;
for(let i = returnIdx; i < lines.length; i++) {
  if (lines[i].includes('const Coupons = ({')) {
    endIdx = i - 2; // the `};` before it
    break;
  }
}

console.log(`Replacing from line ${returnIdx} to ${endIdx}`);
