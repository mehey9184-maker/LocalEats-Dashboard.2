// L3-N7B5F: completely isolated backend mock. No fetch, Firebase, SQL or external writes.
type ReadResult={data:never[];error:null|{message:string}};
type Complete=(result:ReadResult)=>void;
type ChannelCallback=(status:string)=>void;
class SyntheticChannel {
 callback:ChannelCallback|undefined;
 active=true;
 subscribe(callback:ChannelCallback){this.callback=callback;return this;}
 unsubscribe(){this.active=false;syntheticState.activeChannels.delete(this);}
}
export const syntheticState={
 queuedCount:0,
 reads:[] as Complete[],
 activeChannels:new Set<SyntheticChannel>(),
 everyChannel:[] as SyntheticChannel[],
 errors:[] as string[],
 queueReads:0,
 backendWrites:0
};
export const syntheticAdapter={
 from(table:string){
  if(table!=="shops")throw Error("The diagnostic may read only synthetic shops");
  return {
   select(field:string){
    if(field!=="id")throw Error("Only synthetic ID reads allowed");
    return {limit(value:number){
     if(value!==1)throw Error("Only bounded reads allowed");
     return new Promise<ReadResult>(done=>syntheticState.reads.push(done));
    }};
   }
  };
 },
 removeChannel(channel:SyntheticChannel){channel.unsubscribe();}
};
export const supabase=syntheticAdapter;
export const getFreshChannel=(channelName:string)=>{
 void channelName;
 const channel=new SyntheticChannel();
 syntheticState.activeChannels.add(channel);
 syntheticState.everyChannel.push(channel);
 return channel;
};
export function resolveOldestRead(error=false){
 const done=syntheticState.reads.shift();
 if(!done)throw Error("No pending synthetic diagnostic read");
 done({data:[],error:error?{message:"Synthetic read failed"}:null});
}
export function emitChannel(status:string,includeClosed=false){
 for(const channel of syntheticState.everyChannel){
  if(channel.active || includeClosed)channel.callback?.(status);
 }
}
export async function getQueuedMutations(){
 syntheticState.queueReads++;
 return Array.from({length:syntheticState.queuedCount},(_,i)=>({id:`readonly-${i}`}));
}
export function logNetworkError(context:string){
 syntheticState.errors.push(context);
 // Never send logs, analytics, events or writes to a remote backend.
}
export function setSyntheticOnline(online:boolean){
 Object.defineProperty(navigator,"onLine",{configurable:true,get:()=>online});
 window.dispatchEvent(new Event(online?"online":"offline"));
}
