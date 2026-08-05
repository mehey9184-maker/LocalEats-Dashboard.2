import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  '        {/* FLYER MODAL */}',
  '      <AnimatePresence>\n        {/* FLYER MODAL */}'
);

fs.writeFileSync('src/App.tsx', content);
console.log("Added opening AnimatePresence");
