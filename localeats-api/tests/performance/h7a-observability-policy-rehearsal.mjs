// SYNTHETIC ONLY: no imports, network, credentials, provider, or runtime integration.
// Run with node h7a-observability-policy-rehearsal.mjs
function rehearsal(){
 const fields={admission:{auth:["auth"],total:["total"]},api:{requests:["requests"],errors:["errors"],p95:["p95"]},db:{poolUsed:["poolUsed"],poolLimit:["poolLimit"],waitP95:["waitP95"]},recovery:{pendingOverdue:["pendingOverdue"],leaseOverdue:["leaseOverdue"],unknownReceipt:["unknownReceipt"],integrityViolation:["integrityViolation"]},notification:{eligibleOverdue:["eligibleOverdue"],providerAccepted:["providerAccepted"],deviceObserved:["deviceObserved"]},quota:{used:["used"],limit:["limit"]}};
 const schemas=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,Object.keys(v)]));
 function classify(kind,raw){
  if(!Object.hasOwn(schemas,kind)||!raw||typeof raw!=="object"||Array.isArray(raw))return {state:"unknown",reason:"invalid_shape"};
  const keys=schemas[kind];
  if(!keys.every(k=>Object.hasOwn(raw,k)&&Number.isSafeInteger(raw[k])&&raw[k]>=0))return {state:"unknown",reason:"missing_or_invalid"};
  const m=Object.fromEntries(keys.map(k=>[k,raw[k]]));
  if(kind==="admission")return {state:m.auth>=600||m.total>=1200?"critical":m.auth>=480||m.total>=960?"priority":m.auth>=420||m.total>=840?"review":"normal"};
  if(kind==="api"){if(m.errors>m.requests||!m.requests)return {state:"unknown"};return {state:m.errors/m.requests>=.05?"priority":m.requests<20?"insufficient":m.errors/m.requests>=.01||m.p95>=1000?"review":"normal"}}
  if(kind==="db"){if(!m.poolLimit||m.poolUsed>m.poolLimit)return {state:"unknown"};return {state:m.poolUsed===m.poolLimit||m.waitP95>=500?"priority":m.poolUsed/m.poolLimit>=.7||m.waitP95>=100?"review":"normal"}}
  if(kind==="recovery")return {state:m.integrityViolation?"critical":m.pendingOverdue||m.leaseOverdue||m.unknownReceipt?"priority":"normal"};
  if(kind==="notification")return {state:m.eligibleOverdue?"priority":"normal",delivery:"unverified_by_provider_acceptance"};
  if(kind==="quota"){if(!m.limit)return {state:"unknown"};return {state:m.used/m.limit>=.9?"priority":m.used/m.limit>=.7?"review":"normal"}}
 }
 const cases=[
 ["auth below review","admission",{auth:419,total:839},"normal"],["auth review","admission",{auth:420,total:0},"review"],["total review","admission",{auth:0,total:840},"review"],["auth priority","admission",{auth:480,total:0},"priority"],["total priority","admission",{auth:0,total:960},"priority"],["auth cap","admission",{auth:600,total:0},"critical"],["total cap","admission",{auth:0,total:1200},"critical"],["missing not green","admission",{auth:1},"unknown"],["negative invalid","admission",{auth:-1,total:0},"unknown"],["api empty","api",{requests:0,errors:0,p95:0},"unknown"],["api low sample","api",{requests:5,errors:0,p95:0},"insufficient"],["api error","api",{requests:100,errors:5,p95:100},"priority"],["api slow","api",{requests:100,errors:0,p95:1000},"review"],["api impossible","api",{requests:5,errors:6,p95:0},"unknown"],["pool wait","db",{poolUsed:2,poolLimit:10,waitP95:100},"review"],["pool exhausted","db",{poolUsed:10,poolLimit:10,waitP95:0},"priority"],["pool missing","db",{poolUsed:0,poolLimit:0,waitP95:0},"unknown"],["order integrity","recovery",{pendingOverdue:0,leaseOverdue:0,unknownReceipt:0,integrityViolation:1},"critical"],["unknown receipt","recovery",{pendingOverdue:0,leaseOverdue:0,unknownReceipt:1,integrityViolation:0},"priority"],["expired lease","recovery",{pendingOverdue:0,leaseOverdue:1,unknownReceipt:0,integrityViolation:0},"priority"],["overdue notification","notification",{eligibleOverdue:1,providerAccepted:0,deviceObserved:0},"priority"],["provider accept not delivery","notification",{eligibleOverdue:0,providerAccepted:1,deviceObserved:0},"normal"],["quota review","quota",{used:70,limit:100},"review"],["quota priority","quota",{used:90,limit:100},"priority"],["quota unknown","quota",{used:0,limit:0},"unknown"],["unknown dimension","arbitrary_user_id",{},"unknown"]];
 let passed=0;
 for(const [name,kind,input,expected] of cases){const actual=classify(kind,input);if(actual.state!==expected)throw Error(name+" expected "+expected+" got "+actual.state);if(name==="provider accept not delivery"&&actual.delivery!=="unverified_by_provider_acceptance")throw Error(name);passed++;}
 const out=classify("admission",{auth:420,total:0,email:"synthetic@example.invalid",token:"SYNTHETIC_SECRET",orderId:"SYNTHETIC_ID",url:"/private/123",nested:{secret:"SYNTHETIC_SECRET"}});if(JSON.stringify(out)!=='{"state":"review"}')throw Error("output allowlist failed");passed++;
 const invalid=classify("api",{requests:100,errors:NaN,p95:10});if(invalid.state!=="unknown")throw Error("NaN not rejected");passed++;
 return {passed,total:cases.length+2,scope:"synthetic pure policy only; no runtime, network, logging sink or hosted data"};
}
console.log(JSON.stringify(rehearsal()));
