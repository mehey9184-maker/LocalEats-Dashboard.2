const https = require('https');
https.get('https://ais-dev-zkommsenmjwup25rygpra4-166197505831.europe-west3.run.app/src/App.tsx?v=8', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const lines = data.split('\n');
    for(let i = 3995; i <= 4015; i++) {
       console.log(i + ": " + lines[i-1]);
    }
  });
});
