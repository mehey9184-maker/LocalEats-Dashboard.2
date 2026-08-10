const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldButton = `<button
                      onClick={async () => {
                        if (!user) return;
                        const { error } = await supabase.from('shops').insert({
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
                    </button>`;
                    
const newButton = `<button
                      onClick={async () => {
                        if (!user) return;
                        const { error, data } = await supabase.from('shops').insert({
                          owner_id: user.id,
                          name: "My New Shop",
                          email: user.email || "",
                          is_active: false
                        }).select().single();
                        
                        if (error) {
                          toast.error("Failed to create shop: " + error.message);
                        } else {
                          toast.success("Shop created successfully!");
                          if (data) {
                             setShops(prev => [data as Shop, ...prev]);
                             localStorage.setItem("localeats_my_shop_id", String(data.id));
                             localStorage.setItem("localeats_last_selected_shop_id", String(data.id));
                          }
                          await fetchShops();
                        }
                      }}
                      className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
                    >
                      Create My Shop
                    </button>`;

content = content.replace(oldButton, newButton);
fs.writeFileSync(file, content);
console.log('patched create shop button');
