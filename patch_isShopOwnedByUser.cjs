const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('if (shop.owner_id === "ea44b2b5-7a8a-466e-8158-60e73d3e4911") return true;', '');
content = content.replace('if (shop.id === 18 || (shop.name && (shop.name.toLowerCase().includes("my-kota") || shop.name.toLowerCase().includes("my kota")))) return true;', '');

fs.writeFileSync(file, content);
console.log('patched isShopOwnedByUser');
