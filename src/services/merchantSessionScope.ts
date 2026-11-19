import type {User} from "../types";

// A locally cached merchant session is display-only; its UID must match the
// currently authenticated Firebase principal. Never infer shop ownership here.
export function matchesActiveFirebaseUid(value:unknown,activeUid:string|null|undefined):value is User {
 if(!activeUid || !value || typeof value!=="object" || Array.isArray(value))return false;
 const id=(value as Record<string,unknown>).id;
 return typeof id==="string" && id.length>0 && id===activeUid;
}
