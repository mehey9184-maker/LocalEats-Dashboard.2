import fs from 'fs'; console.log(fs.readFileSync('src/App.tsx', 'utf8').split('\n').slice(3750, 3820).join('\n'));
