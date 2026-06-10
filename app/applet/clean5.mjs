import fs from 'fs'; 
let c = fs.readFileSync('src/App.tsx', 'utf8'); 
c = c.replace(/Package,/g, '');
c = c.replace(/Gauge,/g, '');
c = c.replace(/Lock,/g, '');
c = c.replace(/import AppMapBackground from "\.\/components\/AppMapBackground";/g, '');
c = c.replace(/const CITY_CENTERS = \{[\s\S]*?\};\n/g, '');
fs.writeFileSync('src/App.tsx', c);
