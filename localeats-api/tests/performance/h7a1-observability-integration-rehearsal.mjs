// SYNTHETIC ONLY; no runtime integration, network, or customer data.
function run(){
 const kinds=["api_read","api_write","admission","order","outbox"],outcomes=["ok","denied","failed","unknown"],bounds=[10,50,100,500,1000,5000,Infinity],N=kinds.length*outcomes.length*bounds.length,W=60000;
 function collector(){
  const slots=Array.from({length:3},()=>({epoch:-1,bins:new Uint32Array(N)}));let latest=-1,dropped=0;
  function record(kind,outcome,ms,now){
   if(!Number.isSafeInteger(now)||now<0||!Number.isFinite(ms)||ms<0){dropped=Math.min(4294967295,dropped+1);return false;}
   const k=kinds.indexOf(kind),o=outcomes.indexOf(outcome);if(k<0||o<0){dropped=Math.min(4294967295,dropped+1);return false;}
   const epoch=Math.floor(now/W);if(epoch<latest){dropped=Math.min(4294967295,dropped+1);return false;}
   latest=epoch;const s=slots[epoch%3];if(s.epoch!==epoch){s.bins.fill(0);s.epoch=epoch;}
   const b=bounds.findIndex(x=>ms<=x),i=(k*outcomes.length+o)*bounds.length+b;
   if(s.bins[i]===4294967295){dropped=Math.min(4294967295,dropped+1);return false;}
   s.bins[i]++;return true;
  }
  function read(now){if(!Number.isSafeInteger(now)||now<0)return {state:"unknown"};const epoch=Math.floor(now/W);if(epoch<latest)return {state:"unknown"};const s=slots[(epoch+2)%3];if(s.epoch!==epoch-1)return {state:"unknown"};return {state:"observed",epoch:s.epoch,bins:Array.from(s.bins),dropped};}
  return {record,read,bytes:3*N*4,slots:3};
 }
 function alertMachine(){
  const keys=["admission","api","db","order","outbox","quota"], states=keys.map(()=>({level:"normal",streak:0,last:-1,pending:"normal",open:false,healthy:0}));
  return (key,level,epoch)=>{
   const i=keys.indexOf(key);if(i<0||!["normal","review","priority","critical","unknown"].includes(level)||!Number.isSafeInteger(epoch)||epoch<0)return "ignored";
   const s=states[i];if(epoch<=s.last)return "ignored";const consecutive=epoch===s.last+1;s.last=epoch;
   if(level==="unknown"){s.streak=0;s.healthy=0;s.pending="normal";return "unknown";}
   if(level==="normal"){s.streak=0;s.pending="normal";s.healthy=consecutive?s.healthy+1:1;if(s.open&&s.healthy>=2){s.open=false;s.level="normal";return "resolved";}return "quiet";}
   s.healthy=0;s.streak=consecutive&&s.pending===level?s.streak+1:1;s.pending=level;
   if(level!=="critical"&&s.streak<3)return "pending";
   const rank=["normal","review","priority","critical"];
   if(!s.open||rank.indexOf(level)>rank.indexOf(s.level)){s.open=true;s.level=level;return "alert";}
   return "dedup";
  };
 }
 function forecast(samples,now){
  const day=86400000;if(!Array.isArray(samples)||samples.length!==3||!Number.isSafeInteger(now)||now<0)return {state:"unknown"};
  if(!samples.every(x=>x&&Number.isSafeInteger(x.t)&&x.t>=0&&Number.isSafeInteger(x.used)&&x.used>=0&&Number.isSafeInteger(x.limit)&&x.limit>0&&Number.isSafeInteger(x.reset)&&x.reset>now&&x.t<=now&&x.t<x.reset))return {state:"unknown"};
  const [a,b,c]=samples;if(now-c.t>day||b.t-a.t!==day||c.t-b.t!==day||a.limit!==b.limit||b.limit!==c.limit||a.reset!==b.reset||b.reset!==c.reset||a.used>b.used||b.used>c.used)return {state:"unknown"};
  const rate=(c.used-a.used)/2,days=rate>0?Math.max(0,(c.limit-c.used)/rate):null;
  return {state:c.used/c.limit>=.9||(days!==null&&days<=7&&days*day<=c.reset-now)?"priority":c.used/c.limit>=.7?"review":"normal",days};
 }
 function apiPolicy(requests,errors,p95){if(![requests,errors,p95].every(x=>Number.isSafeInteger(x)&&x>=0)||errors>requests||!requests)return "unknown";if(errors>0&&requests<20)return "investigate_error";if(requests<20)return "insufficient";return errors/requests>=.05?"priority":errors/requests>=.01||p95>=1000?"review":"normal";}
 function observed(fn,signal){const result=fn();try{signal();}catch{}return result;}
 let passed=0;function check(name,ok){if(!ok)throw Error(name);passed++;}
 let c=collector();check("constant bins",c.bytes===1680&&c.slots===3);check("empty unknown",c.read(W).state==="unknown");check("record",c.record("api_read","ok",8,0));check("fresh complete",c.read(W).bins[0]===1);check("stale",c.read(2*W).state==="unknown");check("unknown route rejected",!c.record("private/SYNTHETIC","ok",8,0));check("unknown outcome rejected",!c.record("api_read","SYNTHETIC_SECRET",8,0));check("negative duration",!c.record("api_read","ok",-1,0));check("NaN",!c.record("api_read","ok",NaN,0));check("clock invalid",!c.record("api_read","ok",1,-1));check("rotate",c.record("api_read","ok",5000,3*W));check("backwards event",!c.record("api_read","ok",1,2*W));check("backwards snapshot",c.read(W).state==="unknown");check("old slot overwritten",c.read(4*W).bins[0]===0);check("no secrets",!JSON.stringify(c.read(4*W)).includes("SYNTHETIC"));check("dropped count",c.read(4*W).dropped===6);
 let a=alertMachine();check("first warn",a("api","review",1)==="pending");check("duplicate minute",a("api","review",1)==="ignored");check("second warn",a("api","review",2)==="pending");check("third warn",a("api","review",3)==="alert");check("dedup",a("api","review",4)==="dedup");check("critical immediately",a("api","critical",5)==="alert");check("unknown never clears",a("api","unknown",6)==="unknown");check("first healthy",a("api","normal",7)==="quiet");check("second healthy",a("api","normal",8)==="resolved");check("unknown key",a("user-secret","critical",9)==="ignored");check("gap breaks streak",a("db","review",1)==="pending"&&a("db","review",3)==="pending"&&a("db","review",4)==="pending");check("order critical bypasses debounce",a("order","critical",1)==="alert");
 const d=86400000, sample=(u,t,limit=100,reset=20*d)=>({used:u,t:t*d,limit,reset});
 check("forecast nearing",forecast([sample(40,1),sample(50,2),sample(60,3)],3*d).state==="priority");check("forecast no growth",forecast([sample(70,1),sample(70,2),sample(70,3)],3*d).state==="review");check("stale quota",forecast([sample(40,1),sample(50,2),sample(60,3)],5*d).state==="unknown");check("reset change",forecast([sample(40,1),sample(50,2),sample(60,3,100,21*d)],3*d).state==="unknown");check("changed limit",forecast([sample(40,1),sample(50,2,200),sample(60,3)],3*d).state==="unknown");check("counter decreases",forecast([sample(40,1),sample(50,2),sample(20,3)],3*d).state==="unknown");check("forecast beyond reset",forecast([sample(40,1,100,4*d),sample(50,2,100,4*d),sample(60,3,100,4*d)],3*d).state==="normal");check("quota zero",forecast([sample(0,1,0),sample(0,2,0),sample(0,3,0)],3*d).state==="unknown");
 check("low volume no percentile",apiPolicy(5,0,5000)==="insufficient");check("low volume real error",apiPolicy(5,1,0)==="investigate_error");check("zero requests",apiPolicy(0,0,0)==="unknown");check("threshold",apiPolicy(100,5,1)==="priority");
 let mutations=0,attempts=0,recoveries=0;const result=observed(()=>{mutations++;return {receipt:"synthetic",status:200};},()=>{attempts++;throw Error("sink unavailable");});check("receipt unchanged",result.status===200&&result.receipt==="synthetic");check("mutation not repeated",mutations===1&&attempts===1);let err=new Error("unknown result");try{observed(()=>{recoveries++;throw err;},()=>{attempts++;});throw Error("unexpected success");}catch(e){check("original failure preserved",e===err&&recoveries===1&&attempts===1);}
 const loop=100000;let sink=0,t0=Date.now();for(let i=0;i<loop;i++)sink+=(i%2);let baseline=Date.now()-t0;const b=collector();t0=Date.now();for(let i=0;i<loop;i++){sink+=(i%2);b.record("api_read","ok",i%200,Math.floor(i/1000)*W);}const monitored=Date.now()-t0;check("bounded under load",b.bytes===1680&&b.slots===3&&b.read(100*W).bins.reduce((a,x)=>a+x,0)===1000);check("arbitrary labels cannot allocate",!b.record("random-id-"+sink,"ok",5,100*W)&&b.bytes===1680);
 return {passed,iterations:loop,baselineMs:baseline,monitoredMs:monitored,fixedHistogramBytes:b.bytes,scope:"pure synchronous fixture; timing coarse and not application overhead or whole heap"};
}
console.log(JSON.stringify(run()));
