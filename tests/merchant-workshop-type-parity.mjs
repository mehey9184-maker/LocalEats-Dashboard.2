// Compare TypeScript diagnostics of a proposed UI branch with the unchanged
// main branch. A pre-existing error cannot be blamed on a preview-only PR,
// but every new diagnostic must still block its acceptance.
import {readFileSync} from "node:fs";
import {exit} from "node:process";

const [baselineFile,headFile]=process.argv.slice(2);
if(!baselineFile || !headFile){
  console.error("Provide baseline and head TypeScript logs");exit(2);
}

// Absolute import paths differ because the baseline is compiled in a temporary
// worktree. Normalize only source/node_modules paths in diagnostic messages.
function normalizedDiagnosticMessage(message){
  return message.replace(/import\(["']([^"']+)["']\)/g,(full,path)=>{
    const slashPath=path.replaceAll("\\","/");
    for(const segment of ["/src/","/node_modules/"]){
      const at=slashPath.lastIndexOf(segment);
      if(at>=0)return `import("${slashPath.slice(at+1)}")`;
    }
    return full;
  });
}

function errors(file){
  const rows=readFileSync(file,"utf8").split(/\r?\n/);
  const diagnostics=[];
  for(const row of rows){
    const match=row.match(/^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/);
    if(match){
      diagnostics.push(`${match[1].replaceAll("\\","/")}|${match[2]}|${normalizedDiagnosticMessage(match[3])}`);
    }
  }
  return diagnostics;
}

const baseline=errors(baselineFile),current=errors(headFile);
const baselineCounts=new Map();
for(const entry of baseline)baselineCounts.set(entry,(baselineCounts.get(entry)||0)+1);
const newErrors=[];
for(const entry of current){
  const count=baselineCounts.get(entry)||0;
  if(count>0)baselineCounts.set(entry,count-1);
  else newErrors.push(entry);
}

if(newErrors.length){
  console.error(`WORKSHOP_NEW_TYPESCRIPT_ERRORS: ${newErrors.length}`);
  for(const entry of newErrors.slice(0,30))console.error(entry);
  exit(1);
}
console.log(`WORKSHOP_TYPESCRIPT_PARITY_PASS: baseline=${baseline.length}, proposed=${current.length}, newly_introduced=0`);
if(baseline.length) console.log("Existing main TypeScript diagnostics remain unresolved; full clean typecheck is NOT claimed.");
