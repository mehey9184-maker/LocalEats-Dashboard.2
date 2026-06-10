import fs from 'fs'; 
const file = 'src/App.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/\[user, FALLBACK_MENU_ITEMS\]/g, '[user]');
txt = txt.replace(/\[FALLBACK_SHOPS\]/g, '[]');

fs.writeFileSync(file, txt);
console.log("Cleaned up deps!");
