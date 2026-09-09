const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardOverview.tsx', 'utf-8');

const walkInButton = `
            <button
              onClick={() => onNavigate("orders")}
              className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-sm px-6 py-3 rounded-2xl shadow-md hover:shadow-lg transition-all border-none"
            >
              + NEW WALK-IN ORDER
            </button>
            <div className="flex bg-surface-container-low`;

code = code.replace(
  /<div className="flex bg-surface-container-low/g,
  walkInButton
);

fs.writeFileSync('src/components/DashboardOverview.tsx', code);
console.log("Patched successfully");
