const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldFunc = `const isShopOwnedByUser = (shop: Shop, user: User | null): boolean => {
  if (!shop) return false;
  if (user && shop.owner_id === user.id) return true;
  
  if (user?.email && shop.email && shop.email.toLowerCase().trim() === user.email.toLowerCase().trim()) return true;
  
  
  try {
    const savedShopId = localStorage.getItem("localeats_my_shop_id");
    if (savedShopId && String(shop.id) === String(savedShopId)) return true;
    const lastShopId = localStorage.getItem("localeats_last_selected_shop_id");
    if (lastShopId && String(shop.id) === String(lastShopId)) return true;
  } catch (e) {
    // ignore
  }
  
  return false;
};`;

const newFunc = `const isShopOwnedByUser = (shop: Shop, user: User | null): boolean => {
  if (!shop || !user) return false;
  return shop.owner_id === user.id;
};`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync(file, content);
console.log('patched isShopOwnedByUser strictly');
