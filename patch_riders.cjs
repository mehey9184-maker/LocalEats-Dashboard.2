const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldRiders = `{activeTab === "riders" && currentShop && (
                <RiderManagement
                  currentShop={currentShop}
                  orders={orders}
                  onRequestRider={requestRider}
                  sendRiderNudge={sendRiderNudge}
                />
              )}`;
              
const newRiders = `{activeTab === "riders" && (
                currentShop ? (
                  <RiderManagement
                    currentShop={currentShop}
                    orders={orders}
                    onRequestRider={requestRider}
                    sendRiderNudge={sendRiderNudge}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <p className="text-on-surface-variant font-medium">Create a shop first to manage riders.</p>
                    <button onClick={() => setActiveTab("storefront")} className="px-4 py-2 bg-primary text-white rounded-xl">Go to Storefront</button>
                  </div>
                )
              )}`;

content = content.replace(oldRiders, newRiders);
fs.writeFileSync(file, content);
console.log('patched riders tab');
