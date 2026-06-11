import fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const results = [];
for (let i = 3902 - 1; i < 5340; i++) {
  const line = lines[i];
  if (line.includes('currentWeather') || line.includes('weatherCity') || line.includes('getWeatherInfo')) {
    results.push(`${i+1}: ${line.trim()}`);
  }
}
console.log(results.slice(0, 50).join('\n'));
