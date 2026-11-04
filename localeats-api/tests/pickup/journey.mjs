// Offline integration: real Express routes + actual PostgreSQL transactions + both shipped client adapters.
// Identity verification is a fixture boundary; no Firebase/Supabase production connection.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {once} from "node:events";
import express from "express";
import {createPickupApi as customerClient} from "../../../../customer-original-ui/src/pickup/client.ts";
import {createPickupApi as merchantClient} from "../../../src/pickup/client.ts";
import {authAdmin} from "../../dist/lib/firebaseAdmin.js";
import {supabaseAdmin} from "../../dist/lib/supabaseAdmin.js";
import {customerOrderRoutes,merchantOrderRoutes} from "../../dist/routes/orders.js";
import {pickupNotificationRoutes} from "../../dist/routes/pickupNotifications.js";
import {makeCatalogRouter,SupabaseCatalogRepository} from "../../dist/routes/catalog.js";
import riderRoutes from "../../dist/routes/riderOrders.js";
import {configureApiCacheSafety} from "../../dist/middleware/apiCacheSafety.js";
const [connection,bin,mode]=process.argv.slice(2);
if(!connection?.includes("hostaddr=127.0.0.1") || !bin)throw Error("Only explicit loopback fixture connections accepted.");
process.env.PICKUP_WRITES_ENABLED="true";
process.env.PICKUP_TEST_CUSTOMER_UID="customer";
const quote=value=>value===null ? "null" : "'"+String(value).replaceAll("'","''")+"'";
const ident=value=>{if(!/^[a-z_]+$/.test(value))throw Error("Unsafe identifier");return '"'+value+'"';};
const sql=statement=>execFileSync(bin,["-X","--no-password","-d",connection,"-v","ON_ERROR_STOP=1","-At","-c",statement],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
const jsonSql=statement=>JSON.parse(sql(statement) || "null");
const allowed=["orders","shops_with_availability","shops","menu_items","pickup_order_events","pickup_push_subscriptions","rider_profiles"];
let failDatabase=false;
supabaseAdmin.from=table=>{
 if(!allowed.includes(table))throw Error("Unexpected fixture table "+table);
 const where=[];let limit=250;let ordering=[];let single=false;
 const load=()=>{
  if(failDatabase)return {data:null,error:{message:"Simulated offline database"}};
  const rows=jsonSql("select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select * from public."+ident(table)+
   (where.length ? " where "+where.join(" and ") : "")+(ordering.length ? " order by "+ordering.join(",") : "")+" limit "+limit+")q");
  return {data:single ? rows[0] ?? null : rows,error:null};
 };
 const query={select:()=>query,eq:(k,v)=>{where.push(ident(k)+"="+quote(v));return query;},
  is:(k,v)=>{where.push(ident(k)+(v===null ? " is null" : "="+quote(v)));return query;},
  in:(k,v)=>{where.push(ident(k)+" in ("+v.map(quote).join(",")+")");return query;},
  order:(k,options)=>{ordering.push(ident(k)+(options?.ascending===false ? " desc" : " asc"));return query;},
  limit:n=>{limit=Number(n);return query;},maybeSingle:async()=>{single=true;return load();},
  then:(resolve,reject)=>Promise.resolve().then(load).then(resolve,reject)};
 return query;
};
// Keep one SELECT per psql result so command tags cannot be mistaken for JSON.
supabaseAdmin.rpc=async(name,args)=>{
 if(failDatabase)return {data:null,error:{message:"Simulated offline database"}};
 const signatures={pickup_create_order:["p_uid","p_intent_hash","p_record"],
  pickup_order_command:["p_uid","p_order_id","p_action","p_command_id","p_expected_revision","p_reason","p_payment_method","p_handover_confirmed"]};
 if(!signatures[name])throw Error("Unexpected fixture RPC "+name);
 const parameters=signatures[name].map(key=>args[key]===null ? "null" : typeof args[key]==="object" ? quote(JSON.stringify(args[key]))+"::jsonb" :
  typeof args[key]==="boolean" || typeof args[key]==="number" ? String(args[key]) : quote(args[key]));
 try{
  const output=sql("set role service_role;select public."+ident(name)+"("+parameters.join(",")+");");
  return {data:JSON.parse(output.split("\n").filter(line=>line.startsWith("{")).at(-1)),error:null};
 }catch(error){return {data:null,error:{message:String(error.stderr).match(/ERROR:\s+([^\r\n]+)/)?.[1] ?? "Database error"}};}
};
authAdmin.verifyIdToken=async token=>{
 if(token.includes(".")) {
  try {token=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString()).sub;}catch{throw Error("Invalid fixture identity");}
 }
 if(!["customer","merchant","other-customer","other-merchant","rider"].includes(token))throw Error("Expired fixture identity");
 return {uid:token};
};
sql("insert into public.shops(id,owner_id,name,location,is_active,approval_status,lat,lng) values"+
 "('shop-my-kota-ivory-park','merchant','Journey fixture kitchen','Tembisa',true,'approved',-26.0,28.0),"+
 "('far','merchant','Far fixture kitchen','Tembisa',true,'approved',-27.0,28.0),"+
 "('closed','merchant','Closed fixture kitchen','Tembisa',false,'approved',-26.0,28.0),"+
 "('elsewhere','merchant','Outside fixture kitchen','Elsewhere',true,'approved',-26.0,28.0);"+
 "insert into public.menu_items values('journey-food','shop-my-kota-ivory-park','Fixture meal',30,true);"+
 "update public.menu_items set is_available=false where id='item';");
const app=express();
app.use((req,res,next)=>{const origin=req.headers.origin;if(origin && /^http:\/\/(?:127\.0\.0\.1|localhost):[0-9]+$/.test(origin))res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Access-Control-Allow-Headers","Content-Type,Authorization");res.setHeader("Access-Control-Allow-Methods","GET,POST,PUT,DELETE,OPTIONS");if(req.method==="OPTIONS"){res.sendStatus(204);return;}next();});
app.get("/__pickup_fixture/location",(_req,res)=>res.json({lat:-26,lng:28}));
configureApiCacheSafety(app);app.use(express.json());
app.use("/api/v1",pickupNotificationRoutes);app.use("/api/v1/orders",customerOrderRoutes);
app.use("/api/v1/merchant/orders",merchantOrderRoutes);
app.use("/api/v1/catalog",makeCatalogRouter(new SupabaseCatalogRepository(supabaseAdmin)));
app.use("/api/v1/rider/orders",riderRoutes);
const server=app.listen(mode==="serve" ? 4000 : 0,"127.0.0.1");await once(server,"listening");
if(mode==="serve") {
 const tokenFor=uid=>{
  const header=Buffer.from(JSON.stringify({alg:"none",typ:"JWT"})).toString("base64url");
  const payload=Buffer.from(JSON.stringify({sub:uid,user_id:uid,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,
   auth_time:Math.floor(Date.now()/1000),aud:"local-pickup-fixture",iss:"http://127.0.0.1:9099",firebase:{sign_in_provider:"password"}})).toString("base64url");
  return header+"."+payload+".fixture";
 };
 const auth=express();auth.use(express.json());auth.use(express.urlencoded({extended:false}));
 auth.use((req,res)=>{
  const origin=req.headers.origin;
  if(origin && /^http:\/\/(?:127\.0\.0\.1|localhost):[0-9]+$/.test(origin))res.setHeader("Access-Control-Allow-Origin",origin);
  res.setHeader("Access-Control-Allow-Headers",req.headers["access-control-request-headers"] || "Content-Type");
  if(req.method==="OPTIONS"){res.sendStatus(204);return;}
  if(req.path.endsWith("accounts:signInWithPassword")){
   const uid=req.body.email==="merchant@example.test" ? "merchant" : req.body.email==="customer@example.test" ? "customer" : null;
   if(!uid || req.body.password!=="fixture-pass-only"){res.status(400).json({error:{message:"INVALID_LOGIN_CREDENTIALS"}});return;}
   res.json({localId:uid,email:req.body.email,idToken:tokenFor(uid),refreshToken:"fixture-"+uid,expiresIn:"3600",registered:true});return;
  }
  if(req.path.endsWith("accounts:lookup")){
   let uid;try{uid=JSON.parse(Buffer.from(req.body.idToken.split(".")[1],"base64url").toString()).sub;}catch{res.sendStatus(400);return;}
   res.json({users:[{localId:uid,email:uid+"@example.test",emailVerified:true,providerUserInfo:[{providerId:"password",email:uid+"@example.test"}],createdAt:"1",lastLoginAt:"1"}]});return;
  }
  res.status(400).json({error:{message:"UNSUPPORTED_FIXTURE_AUTH_OPERATION"}});
 });
 const authServer=auth.listen(9099,"127.0.0.1");await once(authServer,"listening");
 console.log("LOCAL_PICKUP_FIXTURE_SERVERS_READY: API 4000, mock Firebase identity 9099; customer/merchant@example.test, fixture-pass-only");
 await new Promise(resolve=>{process.on("SIGINT",resolve);app.post("/__pickup_fixture/stop",(_req,res)=>{res.json({stopped:true});resolve();});});
 server.close();authServer.close();
 process.exit(0);
}
const base="http://127.0.0.1:"+server.address().port;
const customer=customerClient(base,async()=>"customer"),merchant=merchantClient(base,async()=>"merchant");
const other=customerClient(base,async()=>"other-customer"),otherMerchant=merchantClient(base,async()=>"other-merchant");
const command=(revision,extra={})=>({command_id:crypto.randomUUID(),expected_revision:revision,...extra});
const intent=()=>({contract_version:"pickup-v1",idempotency_key:crypto.randomUUID(),shop_id:"shop-my-kota-ivory-park",
 items:[{menu_item_id:"journey-food",quantity:2}],delivery_type:"collection",delivery_schedule_mode:"standard",
 payment_method:"cash",customer_details:{name:"Fixture customer",phone:"+27712345678"},launch_location:{lat:-26,lng:28}});
const readyBody=command(1);
try {
 const shops=await customer.shops({lat:-26,lng:28});
 assert(shops.shops.some(s=>s.id==="shop-my-kota-ivory-park"));
 assert(!shops.shops.some(s=>["far","closed","elsewhere"].includes(s.id)));
 assert.equal((await customer.menu("shop-my-kota-ivory-park")).menu_items[0].price,30);
 const body=intent(),preview=await customer.quote(body);
 assert.equal(preview.quote.total_minor,6000);assert.equal(preview.quote.service_fee_minor,0);assert.equal(preview.quote.delivery_fee_minor,0);
 const accepted={...body,consent:{currency:"ZAR",total_minor:preview.quote.total_minor,pricing_fingerprint:preview.quote.pricing_fingerprint}};
 const lost=customerClient(base,async()=>"customer",async(...args)=>{await fetch(...args);throw Error("Simulated lost response after commit");});
 await assert.rejects(()=>lost.create(accepted),/Connection lost/);
 const created=await customer.create(accepted),id=created.order.id;
 assert.equal(created.replayed,true);
 assert.equal(jsonSql("select count(*) from public.orders where idempotency_key="+quote(body.idempotency_key)),1);
 await assert.rejects(()=>other.create(accepted),error=>error.code==="PICKUP_TEST_NOT_ALLOWED" && error.status===403);
 const incoming=(await merchant.orders(true)).orders.find(o=>o.id===id);
 assert.equal(incoming.phone,"+27712345678");assert.equal(incoming.items[0].quantity,2);assert.equal(Number(incoming.total_price),60);
 await assert.rejects(()=>otherMerchant.command(id,"accept",command(0)),error=>error.code==="FORBIDDEN" && error.status===403);
 await merchant.command(id,"accept",command(0));
 assert.equal((await customer.order(id)).order.status,"preparing");
 await merchant.command(id,"ready",readyBody);
 await merchant.command(id,"ready",readyBody);
 const inbox=await customer.notifications();
 assert.equal(inbox.notifications.filter(n=>n.order_id===id).length,1);
 assert(!(await other.notifications()).notifications.some(n=>n.order_id===id));
 await assert.rejects(()=>merchant.command(id,"collect",command(2,{handover_confirmed:true})));
 await merchant.command(id,"payment-confirmation",command(2,{payment_method:"card_machine"}));
 assert.equal((await customer.order(id)).order.status,"ready_for_pickup");
 assert.equal((await customer.order(id)).order.payment_status,"paid");
 await merchant.command(id,"collect",command(3,{handover_confirmed:true}));
 const afterRefresh=customerClient(base,async()=>"customer");
 assert.equal((await afterRefresh.orders()).orders.find(o=>o.id===id).status,"collected");
 assert.equal((await afterRefresh.order(id)).events.length,5);
 await assert.rejects(()=>other.order(id),/Order not found/);
 await assert.rejects(()=>merchant.command(id,"accept",command(4)),/INVALID_ORDER_TRANSITION/);
 for(const action of ["cancel","reject"]) {
  const pending=intent(),price=await customer.quote(pending);
  const result=await customer.create({...pending,consent:{currency:"ZAR",total_minor:price.quote.total_minor,pricing_fingerprint:price.quote.pricing_fingerprint}});
  await (action==="cancel" ? customer : merchant).command(result.order.id,action,command(0,{reason:"Fixture reason"}),action!=="cancel");
  assert.equal((await customer.order(result.order.id)).order.status,"cancelled");
 }
 failDatabase=true;
 await assert.rejects(()=>customer.quote(intent()));
 await assert.rejects(()=>merchant.orders(true));
 failDatabase=false;
 const countBefore=jsonSql("select count(*) from public.orders");
 sql("update public.menu_items set is_available=false where id='journey-food';");
 await assert.rejects(()=>customer.quote(intent()),/unavailable/);
 assert.equal(jsonSql("select count(*) from public.orders"),countBefore);
 assert.equal(jsonSql("select count(*) from public.orders where create_intent_hash is not null and (rider_id is not null or delivery_status<>'none' or delivery_type<>'collection')"),0);
 const expired=customerClient(base,async()=>"expired");
 await assert.rejects(()=>expired.orders());
 console.log("PICKUP_TWO_CLIENT_HTTP_POSTGRES_JOURNEY_PASSED");
 console.log("Verified: fixture auth; approved 4km discovery; real menu/quote; lost-response recovery; merchant ownership/contact; Preparing; Ready inbox dedupe/isolation; independent payment and handover; refresh/history; cancellation/rejection; failure guards; no Rider assignment.");
}finally{server.close();await once(server,"close");}
