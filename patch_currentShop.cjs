const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace fallback in currentShop
content = content.replace(
  "() => shops.find((s) => isShopOwnedByUser(s, user)) || shops[0] || null,",
  "() => shops.find((s) => isShopOwnedByUser(s, user)) || null,"
);

// Add Create Shop button in storefront
const oldNoShop = `<div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center">
                      <Store className="text-on-surface-variant" size={32} />
                    </div>
                    <p className="text-on-surface-variant font-medium">
                      Please create a shop first to edit your storefront.
                    </p>
                  </div>`;

const newNoShop = `<div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center">
                      <Store className="text-on-surface-variant" size={32} />
                    </div>
                    <p className="text-on-surface-variant font-medium text-center max-w-md">
                      You don't have a shop yet. Create one to start accepting orders and managing riders!
                    </p>
                    <button
                      onClick={async () => {
                        if (!user) return;
                        const { data, error } = await supabase.from('shops').insert({
                          owner_id: user.id,
                          name: "My New Shop",
                          email: user.email || "",
                          is_active: false
                        }).select().single();
                        
                        if (error) {
                          toast.error("Failed to create shop: " + error.message);
                        } else {
                          toast.success("Shop created successfully!");
                          await fetchShops();
                        }
                      }}
                      className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
                    >
                      Create My Shop
                    </button>
                  </div>`;

content = content.replace(oldNoShop, newNoShop);

fs.writeFileSync(file, content);
console.log('patched currentShop');
