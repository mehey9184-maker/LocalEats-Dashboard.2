import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');
content = content.replace(
  'doc.save(`LocalEats_App_QRCode_${currentShop.name.replace(/\\\\s+/g, "_")}.pdf`);',
  'doc.save(`LocalEats_App_QRCode_${currentShop.name.replace(/\\s+/g, "_")}.pdf`);'
);
content = content.replace(
  'doc.save(`LocalEats_Flyer_${currentShop.name.replace(/\\\\s+/g, "_")}.pdf`);',
  'doc.save(`LocalEats_Flyer_${currentShop.name.replace(/\\s+/g, "_")}.pdf`);'
);
fs.writeFileSync('src/App.tsx', content);
