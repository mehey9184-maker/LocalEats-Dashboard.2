import https from 'https';
import fs from 'fs';

https.get('https://ais-dev-zkommsenmjwup25rygpra4-166197505831.europe-west3.run.app/src/App.tsx?v=8', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('app.js', data);
  });
});
