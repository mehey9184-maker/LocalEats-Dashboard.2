import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  'className="grid grid-cols-1 md:grid-cols-2 gap-6" id="marketing_primary_tools"',
  'className="grid grid-cols-1 md:grid-cols-3 gap-6" id="marketing_primary_tools"'
);

fs.writeFileSync('src/App.tsx', content);
console.log("Fixed grid cols!");
