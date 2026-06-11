import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(
  '<FileDown size={16} className="md:w-[18px] md:h-[18px]" />\\n              CSV',
  '<FileDown size={16} className="md:w-[18px] md:h-[18px]" />\\n              Accounting (CSV)'
);
fs.writeFileSync('src/App.tsx', content);
