const fs = require('fs');
let code = fs.readFileSync('src/components/OrdersManagement.tsx', 'utf-8');

code = code.replace(
  /className="px-3 py-1\.5 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white text-\[10px\] font-black uppercase tracking-wider rounded-lg shadow-sm hover:opacity-95 active:scale-95 transition-all cursor-pointer flex-1 text-center"/g,
  'className="w-full mt-4 py-5 bg-blue-600 text-white text-lg md:text-xl font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-blue-500 active:scale-95 transition-all cursor-pointer text-center block"'
);

fs.writeFileSync('src/components/OrdersManagement.tsx', code);
