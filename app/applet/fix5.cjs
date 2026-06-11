const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/\\n\\nexport default function AppWrapper/g, 'export default function AppWrapper');
fs.writeFileSync('src/App.tsx', content);
