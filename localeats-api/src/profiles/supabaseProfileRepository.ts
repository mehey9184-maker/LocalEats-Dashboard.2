import type {SupabaseClient} from '@supabase/supabase-js';
import {PROFILE_STAGE_PROJECT, ProfileConflict, validProfileRevision, type ProfileDocument, type ProfileRepository} from '../routes/customerProfile.js';

export const PROFILE_STAGE_SUPABASE_URL='https://rgpbdajhlrwfmhopzgzk.supabase.co';
const fields=['user_id','fullName','email','phone','city','address','country','photo_url','language','latitude','longitude','favorites'];
const allowed=new Set(fields);
const selection=[...fields,'updated_at'].join(',');
export function profileStagingEnabled(env:Record<string,string|undefined>):boolean {
 return env.CUSTOMER_PROFILE_STAGE_ENABLED==='true' && env.FIREBASE_PROJECT_ID===PROFILE_STAGE_PROJECT && env.SUPABASE_URL===PROFILE_STAGE_SUPABASE_URL && env.VERCEL_ENV!=='production';
}

/** Uses existing profiles columns; updated_at is an exact conditional revision.
 * No upsert, browser role, new table/column, or production migration is needed. */
export class SupabaseRevisionProfileRepository implements ProfileRepository {
 constructor(private readonly db:Pick<SupabaseClient,'from'>,url:string){
  if(url!==PROFILE_STAGE_SUPABASE_URL)throw Error('Profile adapter requires isolated staging');
 }
 private document(row:any,uid:string):ProfileDocument {
  if(!row || row.user_id!==uid || !validProfileRevision(row.updated_at))throw Error('Invalid profile response');
  return{revision:row.updated_at,fields:Object.fromEntries(fields.filter(k=>Object.prototype.hasOwnProperty.call(row,k)).map(k=>[k,row[k]]))};
 }
 async read(uid:string,signal:AbortSignal):Promise<ProfileDocument|null>{
  signal.throwIfAborted();
  const {data,error}=await this.db.from('profiles').select(selection).eq('user_id',uid).abortSignal(signal).maybeSingle();
  signal.throwIfAborted();
  if(error)throw Error('Profile read unavailable');
  return data?this.document(data,uid):null;
 }
 async write(uid:string,patch:Record<string,unknown>,expectedRevision:string|null,signal:AbortSignal):Promise<ProfileDocument>{
  signal.throwIfAborted();
  if(patch.user_id!==uid || Object.keys(patch).some(k=>!allowed.has(k)))throw Error('Invalid profile update');
  if(expectedRevision!==null && !validProfileRevision(expectedRevision))throw Error('Invalid profile revision');
  // Advance beyond the prior microsecond timestamp even for same-millisecond
  // saves. All competing updates still compare the original exact DB timestamp.
  const nextTime=Math.max(Date.now(),expectedRevision===null?0:Date.parse(expectedRevision)+1);
  const record={...patch,updated_at:new Date(nextTime).toISOString()};
  const query=expectedRevision===null
   ? this.db.from('profiles').insert(record)
   : this.db.from('profiles').update(record).eq('user_id',uid).eq('updated_at',expectedRevision);
  const {data,error}=await query.select(selection).abortSignal(signal).maybeSingle();
  signal.throwIfAborted();
  if(error?.code==='23505' || (!error && !data))throw new ProfileConflict();
  if(error)throw Error('Profile save unavailable');
  const saved=this.document(data,uid);
  if(expectedRevision!==null && Date.parse(saved.revision)<=Date.parse(expectedRevision))throw Error('Unconfirmed profile revision');
  return saved;
 }
}
