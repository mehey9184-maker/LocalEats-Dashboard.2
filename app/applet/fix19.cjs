const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\\n');
let newLines = lines.map(line => {
    while(line.includes('\\\\n')) {
        line = line.replace('\\\\n', '');
    }
    return line;
});
fs.writeFileSync('src/App.tsx', newLines.join('\\n'));
