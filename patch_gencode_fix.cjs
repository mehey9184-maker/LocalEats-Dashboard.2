const fs = require('fs');
const file = 'src/components/RiderManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("let insertData = {", "const insertData: any = {");
content = content.replace("const { status, ...rest } = insertData;", "const { ...rest } = insertData; delete rest.status;");

fs.writeFileSync(file, content);
console.log('patched fix');
