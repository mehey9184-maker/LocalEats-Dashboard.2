import fs from 'fs';
let content = fs.readFileSync('src/components/RiderManagement.tsx', 'utf-8');

content = content.replace(
  'Automatically request regional delivery agents on the network the moment you approve a pickup or preparing order.',
  'Automatically dispatch the order to your active paired riders the moment you accept an order.'
);
content = content.replace(
  'Auto-Find On-Demand Search',
  'Auto-Dispatch to Paired Riders'
);

fs.writeFileSync('src/components/RiderManagement.tsx', content);
