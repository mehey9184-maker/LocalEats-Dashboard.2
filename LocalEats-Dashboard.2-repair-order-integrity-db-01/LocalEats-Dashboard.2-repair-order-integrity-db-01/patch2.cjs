const fs = require('fs');
let code = fs.readFileSync('src/components/OrdersManagement.tsx', 'utf-8');

// 1. delivery status
code = code.replace(
  /const \{ error \} = await supabase\.from\("orders"\)\.update\(\{ delivery_status: status \}\)\.eq\("id", order\.id\);\s*if \(error\) \{\s*console\.warn\("Delivery status database sync warning \(saved locally\):", error\);\s*\}/g,
  `try {
      await OrderService.updateDeliveryStatus(order.id, status);
  } catch (error) {
      console.warn("Delivery status database sync warning (saved locally):", error);
  }`
);

// 2. chat message
code = code.replace(
  /const \{ error \} = await supabase\.from\("chat_messages"\)\.insert\(message\);/g,
  `await OrderService.sendChatMessage(message);
    const error = null;`
);

// Add import if missing
if (!code.includes("OrderService")) {
  code = "import { OrderService } from '../services/OrderService';\n" + code;
}

fs.writeFileSync('src/components/OrdersManagement.tsx', code);
