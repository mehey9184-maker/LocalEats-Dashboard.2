import fs from 'fs'; console.log(fs.readFileSync('src/App.tsx','utf-8').split('\\n').slice(0, 10).join('\\n'));
