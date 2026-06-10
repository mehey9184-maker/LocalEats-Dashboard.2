import fs from 'fs'; 
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n'); 
let i = 3800; 
while(i > 0 && !/^const \w+ = \(\{/.test(lines[i]) && !/^function \w+\(/.test(lines[i])) i--; 
console.log('Found component at line', i, lines[i]);
