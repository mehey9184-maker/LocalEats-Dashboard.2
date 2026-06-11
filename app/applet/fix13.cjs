const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace('\\n\\nexport default', '\\n\\nexport default');
fs.writeFileSync('src/App.tsx', content);
