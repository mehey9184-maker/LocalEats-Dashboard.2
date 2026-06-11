const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.split('\\\\n\\\\nexport default function AppWrapper').join('\\nexport default function AppWrapper');
fs.writeFileSync('src/App.tsx', content);
