const https = require('https');
https.get('https://ais-dev-zkommsenmjwup25rygpra4-166197505831.europe-west3.run.app/src/App.tsx?v=8', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const lines = data.split('\n');
    for(let i = 3990; i <= 4050; i++) {
       console.log(i + ": " + lines[i-1]);
    }
  });
});
