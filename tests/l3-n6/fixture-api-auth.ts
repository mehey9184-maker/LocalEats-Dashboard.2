// L3-N6 LOCAL BROWSER FIXTURE ONLY. Fake bearer is consumed only by the
// Node loopback HTTP test server. No production Firebase credentials exist.
import {auth} from "./fixture-auth";
export async function getApiAuthHeaders(){
  return {"Content-Type":"application/json",Authorization:"Bearer fb-"+(auth.currentUser?.uid??"")};
}
