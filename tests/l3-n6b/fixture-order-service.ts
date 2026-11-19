// L3-N6B OFFLINE ONLY: all unrelated legacy mutations must fail closed.
export const OrderService=new Proxy({}, {get(_target,method){
 return async()=>{throw Error("L3-N6B blocked a legacy OrderService operation: "+String(method));};
}});
