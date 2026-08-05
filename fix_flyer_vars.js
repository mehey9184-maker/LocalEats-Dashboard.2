import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');
content = content.replace('  const [flyerSize, setFlyerSize] = useState<"A4" | "Tent" | "Stand">("A4");\n', '');
content = content.replace('  const [flyerMobileTab, setFlyerMobileTab] = useState<"edit" | "preview">("edit");\n', '');
fs.writeFileSync('src/App.tsx', content);
