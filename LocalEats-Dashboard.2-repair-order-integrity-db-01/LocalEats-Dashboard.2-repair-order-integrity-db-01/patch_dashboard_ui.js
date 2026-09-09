const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardOverview.tsx', 'utf-8');

// 1. Remove ConnectionsSlider from the render
code = code.replace(/<ConnectionsSlider[\s\S]*?\/>/, '');

// 2. Increase text size in StatCard
code = code.replace(
  /className="text-on-surface-variant\/60 text-\[9px\] md:text-\[11px\] font-black uppercase tracking-\[0\.2em\] mb-1"/g,
  'className="text-on-surface-variant/80 text-xs md:text-sm font-bold uppercase tracking-wider mb-1"'
);
code = code.replace(
  /className="text-xl md:text-3xl font-headline font-black text-on-surface tracking-tighter"/g,
  'className="text-3xl md:text-4xl font-headline font-black text-on-surface tracking-tighter"'
);

// 3. Add Walk-in order button to the header
const headerMatch = `<div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-headline font-black text-on-surface tracking-tight">`;
            
if (code.includes('const [isStatusToggling, setIsStatusToggling] = useState(false);')) {
  // Let's find where the POS button logic should go. Wait, there's already a POS order logic? Let's check.
}

fs.writeFileSync('src/components/DashboardOverview.tsx', code);
