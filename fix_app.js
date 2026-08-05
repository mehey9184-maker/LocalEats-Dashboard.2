import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Remove campaignsHistory and saveCampaigns
content = content.replace(/  const \[campaignsHistory, setCampaignsHistory\] = useState<Campaign\[\]>\(\[\]\);\n\n  \/\/ Load campaigns history\n  useEffect\(\(\) => \{\n    const stored = localStorage\.getItem\("localeats_merch_campaigns"\);\n    if \(stored\) \{\n      setCampaignsHistory\(JSON\.parse\(stored\)\);\n    \} else \{\n      const defaultCampaigns: Campaign\[\] = \[\n        \{\n          id: "cmp-001",\n          name: "Weekend Special",\n          type: "SMS",\n          status: "Sent",\n          sentAt: new Date\(Date\.now\(\) - 86400000 \* 2\)\.toISOString\(\),\n          stats: \{ reach: 1250, clicks: 180, conversions: 45, revenue: 3200 \}\n        \},\n        \{\n          id: "cmp-002",\n          name: "New Menu Launch",\n          type: "Email",\n          status: "Sent",\n          sentAt: new Date\(Date\.now\(\) - 86400000 \* 14\)\.toISOString\(\),\n          stats: \{ reach: 4500, clicks: 890, conversions: 120, revenue: 15400 \}\n        \}\n      \];\n      localStorage\.setItem\("localeats_merch_campaigns", JSON\.stringify\(defaultCampaigns\)\);\n      setCampaignsHistory\(defaultCampaigns\);\n    \}\n  \}, \[\]\);\n\n  const saveCampaigns = \(newList: Campaign\[\]\) => \{\n    setCampaignsHistory\(newList\);\n    localStorage\.setItem\("localeats_merch_campaigns", JSON\.stringify\(newList\)\);\n  \};\n/g, '');

content = content.replace('import { MessageSquare, Send, Zap, Users, Download, Copy, Printer, QrCode } from "lucide-react";', 'import { MessageSquare, Send, Zap, Users, Download, Copy, Printer, QrCode } from "lucide-react";');

fs.writeFileSync('src/App.tsx', content);
console.log("Fixed app!");
