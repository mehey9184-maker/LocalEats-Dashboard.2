// The old Firestore/Supabase-style compatibility bridge returns unknown.
// Narrow errors before reading a code or a message; never coerce them to a
// trusted authorization decision.
export function getAdapterErrorCode(value:unknown):string|null{
 if(!value || typeof value!=="object" || !("code" in value))return null;
 return typeof value.code==="string"?value.code:null;
}
export function getAdapterErrorMessage(value:unknown):string{
 if(value instanceof Error)return value.message;
 if(!value || typeof value!=="object" || !("message" in value))return "Unconfirmed service error";
 return typeof value.message==="string"?value.message:"Unconfirmed service error";
}
