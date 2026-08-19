import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove it from storefront tab
content = content.replace(
  '<ShopDiagnosticPanel currentShop={currentShop} />',
  ''
);

// 2. Add category to Settings nav
content = content.replace(
  '{ id: "preferences", label: "Preferences", icon: Settings },',
  `{ id: "preferences", label: "Preferences", icon: Settings },
                       { id: "diagnostics", label: "Database Diagnostics", icon: Activity },`
);

// 3. Add Settings Content Panel
const insertTarget = `{settingsCategory === "storefront" && (`;
const diagnosticsPanel = `{settingsCategory === "diagnostics" && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h3 className="font-headline font-bold text-lg mb-2">Firestore Diagnostics</h3>
                        <ShopDiagnosticPanel currentShop={currentShop} />
                      </div>
                    )}
                    
                    `;

content = content.replace(insertTarget, diagnosticsPanel + insertTarget);

fs.writeFileSync('src/App.tsx', content);
console.log("Patched settings");
