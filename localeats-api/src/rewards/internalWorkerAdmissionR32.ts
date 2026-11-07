/**
 * R3.2 INERT internal worker envelope admission.
 *
 * NO Express route imports this module; no Supabase connection, Firebase
 * integration, ledger writer, payout or real worker exists.
 *
 * A *future trusted server* may inject a private 32+-byte HMAC key and a
 * durable, atomic nonce-replay gate. Never accept the key, nonce gate or
 * clock from HTTP input. Replay DB persistence is NOT implemented here.
 *
 * Firebase Admin validates customers/merchants. An internal worker has its
 * own restricted service identity; it must never reuse a user's ID token.
 */
import {createHmac,timingSafeEqual} from "node:crypto";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADER=/^InternalHMAC (1[0-9]{12})\.([A-Za-z0-9_-]{16,64})\.([0-9a-f]{64})$/;
const AUDIENCE="localeats-rewards-r32-internal-worker";
const fail=():never=>{throw Error("R32_INTERNAL_WORKER_UNAUTHORIZED");};

export interface DurableWorkerNonceStore {
  // MUST be a single atomic INSERT-if-not-exists in a private DB with TTL.
  // FALSE means replay. Failures MUST throw, not return success.
  consumeOnce(nonce:string, validUntilMs:number):Promise<boolean>;
}
export interface InternalWorkerAdmissionConfig {
  signingKey:Uint8Array;
  nonces:DurableWorkerNonceStore;
  nowMs?:()=>number; // test clock only; server must supply a trusted clock
}
export interface InternalWorkerEnvelope {
  authorization:string|undefined;
  orderId:string;
  collectedCommandId:string;
  leaseToken:string;
}
export type VerifiedInternalWorkerIntent=Readonly<{
  mode:"worker-admitted-only";
  orderId:string;
  collectedCommandId:string;
  leaseToken:string;
  canCredit:false;
  canPayout:false;
  canAcknowledge:false;
}>;
export function createInertR32WorkerAdmission(config:InternalWorkerAdmissionConfig) {
  if(!config || !(config.signingKey instanceof Uint8Array) ||
     config.signingKey.length<32 || config.signingKey.length>128 ||
     !config.nonces || typeof config.nonces.consumeOnce!=="function" ||
     (config.nowMs!==undefined && typeof config.nowMs!=="function"))
    throw Error("R32_WORKER_ADMISSION_NOT_CONFIGURED");

  // Copy bytes at trusted startup; runtime callers cannot change the key.
  const key=new Uint8Array(config.signingKey);
  const clock=config.nowMs??Date.now;
  const nonces=config.nonces;
  return Object.freeze({
    async inspect(envelope:InternalWorkerEnvelope):Promise<VerifiedInternalWorkerIntent>{
      if(!envelope || typeof envelope!=="object" ||
         !UUID.test(envelope.orderId) ||
         !UUID.test(envelope.collectedCommandId) ||
         !UUID.test(envelope.leaseToken))return fail();
      const match=typeof envelope.authorization==="string"?
        HEADER.exec(envelope.authorization):null;
      if(!match)return fail();
      const [,msStr,nonce,signature]=match;
      const issuedAt=Number(msStr);
      const now=clock();
      // 30s maximum age and 5s future tolerance, both enforced by server.
      if(!Number.isSafeInteger(now)||!Number.isSafeInteger(issuedAt) ||
         issuedAt<now-30000 || issuedAt>now+5000)return fail();
      const payload=[AUDIENCE,msStr,nonce,envelope.orderId.toLowerCase(),
        envelope.collectedCommandId.toLowerCase(),envelope.leaseToken.toLowerCase()].join("\n");
      const expected=createHmac("sha256",key).update(payload).digest();
      const supplied=Buffer.from(signature,"hex");
      if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected))return fail();
      // Signed nonce is used at most once. A real store must persist this
      // atomically across API instances, retries, restarts and parallel calls.
      let newNonce:boolean;
      try{newNonce=await nonces.consumeOnce(nonce,issuedAt+30000);}catch{return fail();}
      if(newNonce!==true)return fail();
      return Object.freeze({
        mode:"worker-admitted-only",orderId:envelope.orderId.toLowerCase(),
        collectedCommandId:envelope.collectedCommandId.toLowerCase(),
        leaseToken:envelope.leaseToken.toLowerCase(),
        canCredit:false,canPayout:false,canAcknowledge:false,
      }) as VerifiedInternalWorkerIntent;
    }
  });
}
