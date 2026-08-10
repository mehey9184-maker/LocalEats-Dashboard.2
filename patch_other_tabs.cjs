const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldPayments = `{activeTab === "payments" && currentShop && (
                <PaymentHistory 
                  shopId={currentShop.id} 
                  currentShop={currentShop}
                  setShops={setShops}
                  orders={orders}
                  setOrders={setOrders}
                />
              )}`;

const newPayments = `{activeTab === "payments" && (
                currentShop ? (
                  <PaymentHistory 
                    shopId={currentShop.id} 
                    currentShop={currentShop}
                    setShops={setShops}
                    orders={orders}
                    setOrders={setOrders}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <p className="text-on-surface-variant font-medium">Create a shop first to view payments.</p>
                    <button onClick={() => setActiveTab("storefront")} className="px-4 py-2 bg-primary text-white rounded-xl font-bold">Go to Storefront</button>
                  </div>
                )
              )}`;

content = content.replace(oldPayments, newPayments);

fs.writeFileSync(file, content);
console.log('patched other tabs');
