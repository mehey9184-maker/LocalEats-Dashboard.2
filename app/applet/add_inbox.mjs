import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace('} from "lucide-react";', 'Inbox } from "lucide-react";');
fs.writeFileSync('src/App.tsx', content);
