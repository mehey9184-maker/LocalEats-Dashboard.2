import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/setLoadingShops\(.*\);/g, '');
content = content.replace(/setLoadingMenu\(.*\);/g, '');

const startDel = content.indexOf('const calculateDistance');
if(startDel > -1) {
  const endDel = content.indexOf('};', startDel) + 2;
  content = content.slice(0, startDel) + content.slice(endDel);
  console.log("Removed calculateDistance");
}

fs.writeFileSync('src/App.tsx', content);
