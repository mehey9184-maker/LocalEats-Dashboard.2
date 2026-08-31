import fs from 'fs';
const appSrc = fs.readFileSync('src/App.tsx', 'utf8');
const orderSrc = fs.readFileSync('src/services/OrderService.ts', 'utf8');
const firebaseSrc = fs.readFileSync('src/lib/firebase.ts', 'utf8');
const orderWorkflowSrc = fs.readFileSync('src/hooks/useOrderWorkflow.ts', 'utf8');

const regex = /(getIdToken|Bearer|Authorization|getApiAuthHeaders)/gi;

function search(name, file) {
    console.log(`--- ${name} ---`);
    let match;
    while ((match = regex.exec(file)) !== null) {
        console.log(`Found ${match[0]} at index ${match.index}`);
    }
}
search('App.tsx', appSrc);
search('OrderService.ts', orderSrc);
search('firebase.ts', firebaseSrc);
search('useOrderWorkflow.ts', orderWorkflowSrc);
