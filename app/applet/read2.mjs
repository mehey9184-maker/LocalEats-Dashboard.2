import fs from 'fs'; console.log(fs.readFileSync('src/App.tsx', 'utf8').split('\n').slice(3903, 3915).join('\n'));
