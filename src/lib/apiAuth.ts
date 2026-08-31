import { auth } from "./firebase";

export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  if (!auth.currentUser) {
    throw new Error("Authentication required: No active Firebase user found.");
  }
  
  const token = await auth.currentUser.getIdToken(true);
  
  return {
    Authorization: `Bearer fb-${token}`,
    "Content-Type": "application/json"
  };
}
