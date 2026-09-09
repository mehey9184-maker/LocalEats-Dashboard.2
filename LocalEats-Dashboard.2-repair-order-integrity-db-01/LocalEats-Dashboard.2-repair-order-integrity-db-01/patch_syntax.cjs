const fs = require('fs');
let code = fs.readFileSync('src/components/OrdersManagement.tsx', 'utf-8');

code = code.replace(/\{viewMode === "active" && \(\s*\)\}/g, '');

fs.writeFileSync('src/components/OrdersManagement.tsx', code);
