import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

let start = -1;
let end = -1;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('const [campaignsHistory')) start = i;
  if (lines[i].includes('const saveCampaigns = ') && start !== -1) {
    // Find the end of saveCampaigns
    for(let j = i; j < lines.length; j++) {
      if (lines[j].includes('};') && lines[j].trim() === '};') {
        end = j;
        break;
      }
    }
    break;
  }
}

if (start !== -1 && end !== -1) {
  lines.splice(start, end - start + 1);
  fs.writeFileSync('src/App.tsx', lines.join('\n'));
  console.log("Removed from line " + start + " to " + end);
}
