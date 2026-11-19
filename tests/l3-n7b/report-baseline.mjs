import {readFileSync} from 'node:fs';
const ts=readFileSync(process.argv[2],'utf8').split(/\r?\n/);
let count=0;
for(const line of ts){
 if(/: error TS\d+:/.test(line)){console.log('TS_BASELINE '+line.slice(0,600));count++;}
}
const lint=JSON.parse(readFileSync(process.argv[3],'utf8'));
const files=[];
const byRule=new Map(),byFile=new Map();
for(const file of lint){
 const issues=file.messages.filter(m=>m.severity===2);
 if(!issues.length)continue;
 const filename=file.filePath.replace(process.cwd()+'/', '');
 const entry={filename, count:issues.length, issues:issues.map(m=>({line:m.line,rule:m.ruleId,message:m.message.split('\n')[0].slice(0,130)}))};
 files.push(entry);
 byFile.set(filename,issues.length);
 for(const issue of issues)byRule.set(issue.ruleId||'parse',(byRule.get(issue.ruleId||'parse')||0)+1);
}
console.log('BASELINE_TOTALS '+JSON.stringify({tsErrors:count,lintErrors:[...byFile.values()].reduce((a,b)=>a+b,0)}));
console.log('BASELINE_RULE_COUNTS '+JSON.stringify([...byRule].sort((a,b)=>b[1]-a[1])));
console.log('BASELINE_FILE_COUNTS '+JSON.stringify([...byFile].sort((a,b)=>b[1]-a[1])));
for(const f of files){
 console.log('LINT_FILE '+f.filename+' count='+f.count);
 for(const row of f.issues.slice(0,24))console.log('LINT_DETAIL '+f.filename+':'+row.line+' '+row.rule+' '+row.message);
}
