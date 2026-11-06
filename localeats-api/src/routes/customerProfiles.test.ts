import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import express,{type RequestHandler} from "express";
import {makeCustomerProfilesRouter,parseProfileUpdate,profileWritesEnabled,type ProfileStore} from "./customerProfiles.js";
import {previewReadOnlyGate} from "../middleware/previewReadOnlyGate.js";

const profiles=new Map<string,Record<string,unknown>>();
const calls:{type:string;uid:string;fields?:Record<string,unknown>}[]=[];
const fakeStore:ProfileStore={
 async read(uid){calls.push({type:"read",uid});return profiles.get(uid) as ({user_id:string}&Record<string,unknown>)|undefined ?? null;},
 async write(uid,email,data){
   calls.push({type:"write",uid,fields:data});
   const prev=profiles.get(uid)||{user_id:uid,role:"customer"};
   const row={...prev,...data,user_id:uid,email:email??prev.email,updated_at:"2026-11-06T00:00:00Z"};
   profiles.set(uid,row);
   return row as {user_id:string}&Record<string,unknown>;
 }
};
const fakeIdentity:RequestHandler=(req,res,next)=>{
 const token=req.headers.authorization;
 if(token==="Bearer synthetic-A")((req as any).authUser)={uid:"synthetic-A",email:"a@example.test",isAnonymous:false};
 else if(token==="Bearer synthetic-B")((req as any).authUser)={uid:"synthetic-B",email:"b@example.test",isAnonymous:false};
 else if(token==="Bearer synthetic-anonymous")((req as any).authUser)={uid:"guest",email:null,isAnonymous:true};
 else{res.status(401).json({success:false,code:"UNAUTHORIZED"});return;}
 next();
};
async function withServer(writes:boolean,callback:(base:string)=>Promise<void>,withPreview=false){
 const app=express();
 if(withPreview)app.use(previewReadOnlyGate);
 app.use(express.json());
 app.use("/api/v1/profiles",makeCustomerProfilesRouter({store:fakeStore,authenticate:fakeIdentity,writesEnabled:()=>writes}));
 const server=app.listen(0,"127.0.0.1");
 try{
   await once(server,"listening");
   const addr=server.address();
   if(!addr||typeof addr==="string")throw Error("No port");
   await callback("http://127.0.0.1:"+addr.port+"/api/v1/profiles/me");
 }finally{server.close();}
}
async function request(url:string,identity:string,method="GET",body?:unknown){
 const response:Awaited<ReturnType<typeof fetch>>=await fetch(url,{method,
   headers:{authorization:"Bearer "+identity,"content-type":"application/json"},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {response,body:await response.json() as Record<string,any>};
}
test("profile writes are disabled by default even for authenticated customer",async()=>{
 assert.equal(profileWritesEnabled(),false);
 profiles.clear();calls.length=0;
 await withServer(false,async url=>{
   const {response,body}=await request(url,"synthetic-A","POST",{fullName:"Customer A"});
   assert.equal(response.status,503);assert.equal(body.code,"PROFILE_WRITES_DISABLED");
   assert.equal(response.headers.get("cache-control"),"no-store");
   assert.equal(calls.filter(x=>x.type==="write").length,0);
 });
});
test("registered customer A save and read-back cannot reach customer B",async()=>{
 profiles.clear();calls.length=0;
 await withServer(true,async url=>{
   const a=await request(url,"synthetic-A","POST",{fullName:"Customer A",phone:"0712345678",city:"Johannesburg"});
   assert.equal(a.response.status,200);assert.equal(a.body.profile.user_id,"synthetic-A");
   assert.equal(a.body.profile.role,"customer");
   const b=await request(url,"synthetic-B","POST",{fullName:"Customer B",phone:"+27712345679"});
   assert.equal(b.response.status,200);
   const readA=await request(url,"synthetic-A");
   const readB=await request(url,"synthetic-B");
   assert.equal(readA.body.profile.fullName,"Customer A");
   assert.equal(readB.body.profile.fullName,"Customer B");
   assert.equal(readB.body.profile.user_id,"synthetic-B");
   assert.ok(!JSON.stringify(readB.body).includes("Customer A"));
   assert.ok(!calls.some(x=>x.uid==="synthetic-B"&&x.fields?.user_id==="synthetic-A"));
 });
});
test("role/email/user_id escalation and anonymous profiles are rejected before store writes",async()=>{
 profiles.clear();calls.length=0;
 await withServer(true,async url=>{
   for(const entry of [{user_id:"synthetic-B",fullName:"Bad"},{role:"admin",fullName:"Bad"},{email:"admin@example.test",fullName:"Bad"},{updated_at:"tomorrow",fullName:"Bad"}]){
     const {response,body}=await request(url,"synthetic-A","POST",entry);
     assert.equal(response.status,403);assert.equal(body.code,"FORBIDDEN_PROFILE_FIELD");
   }
   for(const method of ["GET","POST"]){
     const r=await request(url,"synthetic-anonymous",method,method==="POST"?{fullName:"Guest"}:undefined);
     assert.equal(r.response.status,401);
   }
   assert.equal(calls.filter(x=>x.type==="write").length,0);
 });
});
test("body constraints fail closed; address and GPS remain optional for pickup",()=>{
 assert.deepEqual(parseProfileUpdate({fullName:" Pick Up ",phone:"0712345678"}),{fullName:"Pick Up",phone:"0712345678"});
 for(const value of [{latitude:4},{longitude:30},{latitude:0,longitude:null},{latitude:100,longitude:30},
  {fullName:"a"},{phone:"not a number"},{favorites:["a","a"]},{photo_url:"http://evil.example/hi.png"}]){
   assert.throws(()=>parseProfileUpdate(value));
 }
});
test("Preview block still rejects profile writes, independently of profile flag",async()=>{
 const prior=process.env.VERCEL_ENV;process.env.VERCEL_ENV="preview";
 try{
  await withServer(true,async url=>{
   const {response,body}=await request(url,"synthetic-A","POST",{fullName:"Customer A"});
   assert.equal(response.status,503);assert.equal(body.code,"PREVIEW_READ_ONLY");
  },true);
 }finally{
  if(prior===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=prior;
 }
});
