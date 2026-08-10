const fs = require('fs');
const file = 'src/components/RiderManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/rider_phone: inHousePhone\.trim\(\),/g, '');
content = content.replace(/rider_phone: "Paired via QR",/g, '');

fs.writeFileSync(file, content);
console.log('patched');
