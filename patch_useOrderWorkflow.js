import fs from 'fs';
let content = fs.readFileSync('src/hooks/useOrderWorkflow.ts', 'utf8');

// Add imports
content = content.replace(
  'import { sendPushNotification } from "../lib/firebase";',
  'import { sendPushNotification, updateFirestoreOrder, updateFirestoreMenuItem } from "../lib/firebase";'
);

// updateOrderStatus
content = content.replace(
  /const cleanedUpdateData = await safeStripOrderColumns[\s\S]*?let \{ data, error \} = await supabase[\s\S]*?error = retryResult\.error;\n    }/,
  `const { error } = await updateFirestoreOrder(id, transitionData);
    let data = error ? null : [{}];`
);

// stock decrement
content = content.replace(
  /const \{ error: stockError \} = await supabase\s*\.from\("menu_items"\)\s*\.update\({ stock_quantity: newStock }\)\s*\.eq\("id", menuItem\.id\);/,
  `const { error: stockError } = await updateFirestoreMenuItem(menuItem.id, { stock_quantity: newStock });`
);

// requestRider
content = content.replace(
  /const cleanedRequestData = await safeStripOrderColumns[\s\S]*?let \{ data, error \} = await supabase[\s\S]*?error = retryResult\.error;\n    }/,
  `const { error } = await updateFirestoreOrder(id, updateData);
    let data = error ? null : [{}];`
);

// dispatchOrderToRider
content = content.replace(
  /const cleanedData = await safeStripOrderColumns\(supabase, updateData\);\s*const \{ error \} = await supabase\s*\.from\("orders"\)\s*\.update\(cleanedData\)\s*\.eq\("id", id\);/,
  `const { error } = await updateFirestoreOrder(id, updateData);`
);

// convertOrderToPickup
content = content.replace(
  /const cleanedData = await safeStripOrderColumns\(supabase, updateData\);\s*await supabase\.from\("orders"\)\.update\(cleanedData\)\.eq\("id", id\);/,
  `await updateFirestoreOrder(id, updateData);`
);

// convertOrderToPickup channel broadcast
content = content.replace(
  /const channel = supabase\.channel[\s\S]*?\}\)/,
  `// broadcast via Firestore listener on client side automatically`
);

// unassignRider
content = content.replace(
  /const \{ error \} = await supabase\s*\.from\("orders"\)\s*\.update\([\s\S]*?\.eq\("id", orderId\);/,
  `const { error } = await updateFirestoreOrder(orderId, {
      rider_id: null,
      status: "ready",
      delivery_status: "finding_rider",
      updated_at: new Date().toISOString(),
    });`
);

fs.writeFileSync('src/hooks/useOrderWorkflow.ts', content);
console.log("Patched useOrderWorkflow.ts");
