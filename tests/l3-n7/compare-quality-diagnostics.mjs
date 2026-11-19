// L3-N7: read-only diagnostic delta report. Run in disposable GitHub Actions only.
// Both repositories must use the same lockfile/dependency environment.
import {readFileSync,appendFileSync} from 'node:fs';
import {relative,resolve} from 'node:path';

const args=process.argv.slice(2);
if(args.length!==6){console.error('Usage: node compare.mjs base-tsc next-tsc base-eslint next-eslint base-directory next-directory');process.exit(2);}
const [baseTsFile,nextTsFile,baseLintFile,nextLintFile,baseDir,nextDir]=args;
const read=(p)=>readFileSync(p,'utf8');
const normalizedTsc=(p,folder)=>{
  const canonical=(message)=>message.replaceAll(resolve(folder),'<PROJECT>');
  const result=[];
  for(const line of read(p).split(/\r?\n/)){
    const match=/^(.+?)\((\d+),(\d+)\): error TS(\d+): (.+)$/.exec(line);
    if(match)result.push(match[1].replaceAll('\\','/')+' TS'+match[4]+': '+canonical(match[5]));
  }
  return result;
};
const normalizedLint=(path,folder)=>{
  let output;
  try{output=JSON.parse(read(path));}catch(error){throw Error('Missing machine-readable ESLint report: '+path+': '+String(error));}
  const rows=[];
  for(const file of output){
    const filename=relative(resolve(folder),resolve(file.filePath)).replaceAll('\\','/');
    for(const issue of file.messages||[])if(issue.severity===2)
      rows.push(filename+' ['+(issue.ruleId||'parser')+'] '+issue.message);
  }
  return rows;
};
const diff=(a,b)=>{
  const baseline=new Map();
  for(const line of a)baseline.set(line,(baseline.get(line)||0)+1);
  const added=[];
  for(const line of b){
    const old=baseline.get(line)||0;
    if(old>0)baseline.set(line,old-1);
    else added.push(line);
  }
  return added;
};
const baseTs=normalizedTsc(baseTsFile,baseDir),newTs=normalizedTsc(nextTsFile,nextDir);
const baseLint=normalizedLint(baseLintFile,baseDir),newLint=normalizedLint(nextLintFile,nextDir);
const addedTs=diff(baseTs,newTs),addedLint=diff(baseLint,newLint);
const stats={baseline_ts_errors:baseTs.length,current_ts_errors:newTs.length,new_ts_errors:addedTs.length,
  baseline_lint_errors:baseLint.length,current_lint_errors:newLint.length,new_lint_errors:addedLint.length};
console.log('L3_N7_QUALITY_DELTA '+JSON.stringify(stats));
console.log('L3_N7_BASELINE_TS_BY_CODE '+JSON.stringify(baseTs.reduce((acc,s)=>{
 const code=/TS\d+/.exec(s)?.[0]||'other';acc[code]=(acc[code]||0)+1;return acc;
},{})));
for(const issue of addedTs.slice(0,30))console.error('NEW_TYPESCRIPT_ERROR '+issue);
for(const issue of addedLint.slice(0,30))console.error('NEW_ESLINT_ERROR '+issue);
const summary=process.env.GITHUB_STEP_SUMMARY;
if(summary)appendFileSync(summary,'### L3-N7 full Merchant release-quality delta (offline)\n\n'+
'| Check | Existing L3 base | Proposed acceptance feature | Newly introduced |\n|---|---:|---:|---:|\n'+
'| TypeScript diagnostics | '+baseTs.length+' | '+newTs.length+' | '+addedTs.length+' |\n'+
'| ESLint errors | '+baseLint.length+' | '+newLint.length+' | '+addedLint.length+' |\n\n'+
'Full lint and TypeScript gates are **not green** while either current column remains nonzero.\n');
if(addedTs.length||addedLint.length)process.exit(1);
