const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\\n');

let cleanedLines = [];
let i = 0;
while (i < lines.length) {
    if (lines[i].includes('\\\\n\\\\n\\\\n') || lines[i].includes('export default function AppWrapper() {')) {
        let clean = lines[i].replace(/\\\\n/g, '');
        cleanedLines.push(clean);
    } else {
        cleanedLines.push(lines[i]);
    }
    i++;
}

fs.writeFileSync('src/App.tsx', cleanedLines.join('\\n'));
