// L3-N6B OFFLINE ONLY. Supabase never initializes or contacts a hosted project.
const chain:any={
 select(){return chain;},eq(){return chain;},in(){return chain;},order(){return chain;},
 limit(){return chain;},single:async()=>({data:null,error:null}),
 maybeSingle:async()=>({data:null,error:null}),
 then:(ok:any,fail?:any)=>Promise.resolve({data:[],error:null}).then(ok,fail)
};
export const supabase={
 from:(_table:string)=>chain,
 removeChannel:async()=>{},
 channel:()=>({on(){return this;},subscribe(){return this;}})
};
