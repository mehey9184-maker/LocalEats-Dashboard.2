import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  `              <Marketing
                currentShop={currentShop}
                campaignsHistory={campaignsHistory}
                saveCampaigns={saveCampaigns}
                setShops={setShops}
              />`,
  `              <Marketing
                currentShop={currentShop}
                setShops={setShops}
              />`
);

fs.writeFileSync('src/App.tsx', content);
console.log("Fixed render!");
