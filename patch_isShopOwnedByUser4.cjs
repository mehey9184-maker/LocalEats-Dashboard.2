const fs = require('fs');
const file = 'src/components/MenuManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldFunc = `const isShopOwnedByUser = (shop: Shop, user: User | null): boolean => {
  if (!user) return false;
  if (shop.owner_id === user.id) return true;
  return false;
};`;

const newFunc = `const isShopOwnedByUser = (shop: Shop, user: User | null): boolean => {
  if (!shop || !user) return false;
  if (shop.owner_id === user.id) return true;
  if (user.email && shop.email && shop.email.toLowerCase().trim() === user.email.toLowerCase().trim()) return true;
  return false;
};`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync(file, content);
console.log('patched isShopOwnedByUser');
