import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');
content = content.replace(
  '      </AnimatePresence>\n    </div>\n  );\n\n\nconst Coupons = ({',
  '      </AnimatePresence>\n    </div>\n  );\n};\n\nconst Coupons = ({'
);
fs.writeFileSync('src/App.tsx', content);
console.log("Fixed bracket!");
