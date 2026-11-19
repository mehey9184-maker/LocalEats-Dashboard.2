import {acceptanceEnabled} from './acceptance.js';
import {drainAcceptancePush} from './acceptancePush.js';
import {pickupRpc,type RpcClient} from './pickupService.js';
/** Invoke only from a separately approved trusted scheduler. Never attached to a browser request or process timer. */
export async function runAcceptanceCycle(client:RpcClient,drain:(client:RpcClient)=>Promise<void>=drainAcceptancePush){
 if(process.env.PICKUP_ACCEPTANCE_WORKER_ENABLED!=='true'||!acceptanceEnabled()||process.env.PICKUP_WRITES_ENABLED!=='true')return {enabled:false,processed:0};
 const processed=await pickupRpc(client,'pickup_sweep_acceptance',{});
 if(!Number.isSafeInteger(processed)||Number(processed)<0)throw Error('ACCEPTANCE_WORKER_UNCONFIRMED');
 for(let i=0;i<10;i++)await drain(client);
 return {enabled:true,processed:Number(processed)};
}
