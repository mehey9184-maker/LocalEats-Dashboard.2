const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n'); // Split by real newlines!
let newLines = lines.map(line => {
    // If a line has literal \n in it and it's near AppWrapper or something
    if (line.includes('\\n')) {
        line = line.replace(/\\n/g, ''); // Remove literal \ n
    }
    return line;
});
fs.writeFileSync('src/App.tsx', newLines.join('\n'));
