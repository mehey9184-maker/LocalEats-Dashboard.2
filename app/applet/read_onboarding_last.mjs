import fs from 'fs'; console.log(fs.readFileSync('src/App.tsx', 'utf8').split('\n').slice(2550, 2600).join('\n'));
