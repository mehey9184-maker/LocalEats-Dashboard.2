import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  `const Marketing = ({
  currentShop,
  campaignsHistory,
  saveCampaigns,
  setShops,
}: {
  currentShop: Shop | undefined;
  campaignsHistory: Campaign[];
  saveCampaigns: (newList: Campaign[]) => void;
  setShops: React.Dispatch<React.SetStateAction<Shop[]>>;
}) => {`,
  `const Marketing = ({
  currentShop,
  setShops,
}: {
  currentShop: Shop | undefined;
  setShops: React.Dispatch<React.SetStateAction<Shop[]>>;
}) => {`
);

content = content.replace(
  'import { MessageSquare, Mail, Share2, Send, Zap, Users, Download, Copy, Printer, QrCode } from "lucide-react";',
  'import { MessageSquare, Send, Zap, Users, Download, Copy, Printer, QrCode } from "lucide-react";'
);

fs.writeFileSync('src/App.tsx', content);
console.log("Fixed props!");
