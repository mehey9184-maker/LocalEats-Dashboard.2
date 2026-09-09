const fs = require('fs');
let code = fs.readFileSync('src/components/OrdersManagement.tsx', 'utf-8');

// Update Mark Ready in Kanban Column 2 (Preparing)
code = code.replace(
  /className="px-3 py-1\.5 bg-emerald-600 text-white text-\[10px\] font-black uppercase tracking-wider rounded-lg shadow-sm hover:bg-emerald-500 active:scale-95 transition-all cursor-pointer flex-1 text-center"/g,
  'className="w-full mt-4 py-5 bg-teal-500 text-white text-lg md:text-xl font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-teal-400 active:scale-95 transition-all cursor-pointer text-center block"'
);

// Update Mark Completed in Kanban Column 3 (Ready)
// Let's find exactly what's there.
code = code.replace(
  /className="px-3 py-1\.5 bg-primary text-on-primary text-\[10px\] font-black uppercase tracking-wider rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer flex-1 text-center"/g,
  'className="w-full mt-4 py-5 bg-blue-600 text-white text-lg md:text-xl font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-blue-500 active:scale-95 transition-all cursor-pointer text-center block"'
);

fs.writeFileSync('src/components/OrdersManagement.tsx', code);
