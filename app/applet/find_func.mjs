import fs from 'fs'; 
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n'); 
let i = 3800; 
while(i > 0 && !lines[i].includes('const ') && !lines[i].includes('function ')) i--; 
console.log('Found function at line', i, lines[i]);
