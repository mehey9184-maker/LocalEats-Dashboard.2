import fs from 'fs'; console.log(fs.readFileSync('src/App.tsx', 'utf8').split('\n').slice(4130, 4200).join('\n'));
