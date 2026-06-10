import fs from 'fs';
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.startsWith('const CustomerView = ({'));
const end = lines.findIndex(l => l.startsWith('const LockedRiderMode = ({'));

if (start !== -1 && end !== -1) {
    const newLines = [...lines.slice(0, start), ...lines.slice(end)];
    fs.writeFileSync('src/App.tsx', newLines.join('\n'));
    console.log('Removed CustomerView and CustomerCheckout, lines ' + start + ' to ' + end);
} else {
    console.log('Could not find start or end', start, end);
}
