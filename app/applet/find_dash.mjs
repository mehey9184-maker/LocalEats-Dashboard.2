import fs from 'fs'; 
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n'); 
let start = 3480;
let end = 4500;
let out = '';
for(let i = start; i < end; i++) {
  if (lines[i].includes('export interface') || lines[i].includes('export default')) {
    break;
  }
}
// wait just let me get DashboardOverview function body endings.
