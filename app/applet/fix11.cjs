const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
const searchStr = '\\\\n\\\\nexport default function AppWrapper';
console.log(content.indexOf(searchStr));
const searchStr2 = '\\n\\nexport default function AppWrapper';
console.log(content.indexOf(searchStr2));
