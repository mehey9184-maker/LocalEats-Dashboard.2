import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `{currentShop ? (
                  <ShopDiagnosticPanel currentShop={currentShop} />
                  <ShopProfile
                    shop={currentShop}`;

const replacement = `{currentShop ? (
                  <>
                    <ShopDiagnosticPanel currentShop={currentShop} />
                    <ShopProfile
                      shop={currentShop}`;

content = content.replace(target, replacement);

const target2 = `                    isSuccess={isSaveSuccess}
                  />
                ) : (`;

const replacement2 = `                    isSuccess={isSaveSuccess}
                    />
                  </>
                ) : (`;

content = content.replace(target2, replacement2);

fs.writeFileSync('src/App.tsx', content);
console.log("Fragment fixed");
