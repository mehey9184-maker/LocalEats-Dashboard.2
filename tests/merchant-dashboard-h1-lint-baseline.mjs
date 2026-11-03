// CI-only regression check: compare lint errors in changed Merchant UI files
// against the exact original Preview commit, without relaxing lint rules.
// Baseline source is swapped temporarily then restored even on failure.
import {readFileSync,writeFileSync} from "node:fs";
import {execFileSync,spawnSync} from "node:child_process";

const BASE="13c91f26da86404cc1ac5c67d1e1b7f7cb9bdb34";
const files=["src/App.tsx","src/components/DashboardOverview.tsx"];
const originals=new Map(files.map(f=>[f,readFileSync(f,"utf8")]));

function lint(){
 const res=spawnSync(process.execPath,["node_modules/eslint/bin/eslint.js","--format=json",...files],{encoding:"utf8",maxBuffer:20*1024*1024});
 if(!res.stdout?.trim().startsWith("["))throw new Error("ESLint did not return a JSON report: "+String(res.stderr).slice(0,700));
 return JSON.parse(res.stdout);
}
function counts(reports,path){
 const r=reports.find(x=>x.filePath.replaceAll("\\","/").endsWith("/"+path));
 if(!r)throw Error("No lint result for "+path);
 const counts=new Map();
 for(const m of r.messages.filter(x=>x.severity===2)){
  const key=String(m.ruleId)+"|"+String(m.message);
  counts.set(key,(counts.get(key)||0)+1);
 }
 return counts;
}

let current,baseline;
try{
 current=lint();
 for(const path of files){
  const source=execFileSync("git",["show",BASE+":"+path],{encoding:"utf8"});
  writeFileSync(path,source,"utf8");
 }
 baseline=lint();
}finally{
 for(const [path,source] of originals)writeFileSync(path,source,"utf8");
}
let failures=0;
for(const path of files){
 const before=counts(baseline,path),after=counts(current,path);
 for(const [key,count] of after){
  const oldCount=before.get(key)||0;
  if(count>oldCount){
   failures++;
   console.error(path+": "+(count-oldCount)+" NEW lint error(s): "+key);
  }
 }
 const left=[...before.values()].reduce((a,b)=>a+b,0);
 const right=[...after.values()].reduce((a,b)=>a+b,0);
 console.log(path+": existing lint errors "+left+", H1 lint errors "+right+" (compared by rule/message)");
}
if(failures)process.exit(1);
console.log("PASS: no newly introduced ESLint errors in changed Merchant UI components.");
