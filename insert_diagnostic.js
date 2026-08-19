import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<ShopProfile
                    shop={currentShop}`;

const replacement = `<ShopDiagnosticPanel currentShop={currentShop} />
                  <ShopProfile
                    shop={currentShop}`;

content = content.replace(target, replacement);

fs.writeFileSync('src/App.tsx', content);
console.log("Diagnostic inserted");
