const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardOverview.tsx', 'utf-8');

// 1. Remove ConnectionsSlider from the render
code = code.replace(/<ConnectionsSlider\s+onNavigate=\{onNavigate\}\s*\/>/, '');

// 2. Fix the StatCard text sizes
code = code.replace(
  /className="text-on-surface-variant\/60 text-\[9px\] md:text-\[11px\] font-black uppercase tracking-\[0\.2em\] mb-1"/g,
  'className="text-on-surface-variant/80 text-xs md:text-sm font-bold uppercase tracking-wider mb-1"'
);
code = code.replace(
  /className="text-xl md:text-3xl font-headline font-black text-on-surface tracking-tighter"/g,
  'className="text-3xl md:text-4xl font-headline font-black text-on-surface tracking-tighter"'
);

// 3. Add Walk-In Button
const walkInButton = `
            <button
              onClick={() => onNavigate("orders")}
              className="bg-primary hover:bg-primary-hover text-on-primary font-black uppercase tracking-widest text-sm px-6 py-3 rounded-2xl shadow-md hover:shadow-lg transition-all"
            >
              + NEW WALK-IN ORDER
            </button>
            <button`;
            
code = code.replace(
  /            <button\s+onClick=\{\(\) => setLayoutMode/g,
  walkInButton + '\n              onClick={() => setLayoutMode'
);

fs.writeFileSync('src/components/DashboardOverview.tsx', code);
console.log("Patched successfully");
