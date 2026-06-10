import fs from 'fs'; console.log(fs.readFileSync('src/App.tsx', 'utf8').split('\n').slice(16720, 16755).join('\n'));
