import fs from 'fs'; 
const file = 'src/App.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Find FALLBACK_SHOPS and FALLBACK_MENU_ITEMS
const shopsRegex = /const FALLBACK_SHOPS: Shop\[\] = \[[\s\S]*?\];\n/;
const matchShops = txt.match(shopsRegex);
const menuRegex = /const FALLBACK_MENU_ITEMS: MenuItem\[\] = \[[\s\S]*?\];\n/;
const matchMenu = txt.match(menuRegex);

if (matchShops && matchMenu) {
  // Remove them from inside the component
  txt = txt.replace(matchShops[0], '');
  txt = txt.replace(matchMenu[0], '');

  // Insert them after imports
  let importsEnd = txt.lastIndexOf('import ');
  let importEndLine = txt.indexOf('\n', importsEnd);
  
  txt = txt.slice(0, importEndLine + 1) + '\n' + matchShops[0] + '\n' + matchMenu[0] + '\n' + txt.slice(importEndLine + 1);
  fs.writeFileSync(file, txt);
  console.log("Moved FALLBACK arrays outside component!");
} else {
  console.log("Could not find the arrays.");
}
