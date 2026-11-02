// Merchant push devices are scoped to the current authenticated Firebase UID.
// Only a confirmed authenticated API subscription means "Enabled".
export const merchantPushInstallationKey=(uid:string)=>`localeats-merchant-push-installation:${uid}`;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function existingMerchantPushInstallation(uid:string):string|null {
 if(!uid)return null;
 try{
  const value=localStorage.getItem(merchantPushInstallationKey(uid));
  return value && UUID.test(value)?value:null;
 }catch{return null;}
}
export function merchantPushInstallation(uid:string):string {
 if(!uid)throw new Error("Merchant authentication is required.");
 const existing=existingMerchantPushInstallation(uid);
 if(existing)return existing;
 const id=crypto.randomUUID();
 localStorage.setItem(merchantPushInstallationKey(uid),id);
 return id;
}
