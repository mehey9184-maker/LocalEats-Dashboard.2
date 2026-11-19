// L3-N6B OFFLINE ONLY. Supabase never initializes or contacts a hosted project.
// This query chain resolves only synthetic empty rows and has no network transport.
type EmptyResult = {data:never[];error:null};
interface OfflineChain {
  select():OfflineChain;
  eq():OfflineChain;
  in():OfflineChain;
  order():OfflineChain;
  limit():OfflineChain;
  single():Promise<{data:null;error:null}>;
  maybeSingle():Promise<{data:null;error:null}>;
  then:Promise<EmptyResult>["then"];
}
const emptyResult:Promise<EmptyResult>=Promise.resolve({data:[],error:null});
const chain:OfflineChain={
  select(){return chain;},eq(){return chain;},in(){return chain;},order(){return chain;},
  limit(){return chain;},single:async()=>({data:null,error:null}),
  maybeSingle:async()=>({data:null,error:null}),
  then:emptyResult.then.bind(emptyResult)
};
export const supabase={
  from:(table:string)=>{void table;return chain;},
  removeChannel:async()=>{},
  channel:()=>({on(){return this;},subscribe(){return this;}})
};
