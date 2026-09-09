const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  /const \{ error \} = await supabase\s*\.from\("orders"\)\s*\.delete\(\)\s*\.in\("shop_id", ownedShopIds\);/g,
  `let error = null;
        try {
          await OrderService.deleteAllOrdersForShops(ownedShopIds);
        } catch (err) {
          error = err;
        }`
);

if (!code.includes("OrderService")) {
  code = "import { OrderService } from './services/OrderService';\n" + code;
}

fs.writeFileSync('src/App.tsx', code);
