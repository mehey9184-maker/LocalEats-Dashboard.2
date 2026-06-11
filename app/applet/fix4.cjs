const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace("};\\n\\n\\nexport default function AppWrapper", "};\\nexport default function AppWrapper");
content = content.replace("};\\n\\\\n\\\\nexport default function AppWrapper", "};\\nexport default function AppWrapper");
fs.writeFileSync('src/App.tsx', content);
