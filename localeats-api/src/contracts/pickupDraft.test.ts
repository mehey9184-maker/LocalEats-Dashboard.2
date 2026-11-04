import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {draftHash, draftAssertConsent, draftReplayCreation, draftTransition,
  type DraftPickupState, type DraftPickupCommand} from "./pickupDraft.js";

const command = (action: DraftPickupCommand["action"], revision: number): DraftPickupCommand => ({
  orderId:"order", actorUid:action === "cancel" ? "customer" : "merchant",
  ...(action === "confirm_payment" ? {paymentMethod:"cash" as const} : {}),
  ...(action === "collect" ? {handoverConfirmed:true} : {}),
  action, actor: action === "cancel" ? "customer" : "merchant", authorized:true,
  expectedRevision:revision, commandId:`550e8400-e29b-41d4-a716-${String(revision).padStart(12,"0")}`,
});

test("draft price consent catches changed breakdown even at the same total", () => {
  const quote={currency:"ZAR" as const,totalMinor:2750,pricingFingerprint:draftHash({lines:[25],fee:2.5})};
  draftAssertConsent(quote,quote);
  assert.throws(() => draftAssertConsent(quote,{...quote,totalMinor:2800}), /PRICE_CHANGED/);
  assert.throws(() => draftAssertConsent(quote,{...quote,pricingFingerprint:draftHash({lines:[24],fee:3.5})}), /PRICE_CHANGED/);
  assert.throws(() => draftAssertConsent({...quote,totalMinor:27.5},quote), /INVALID_PRICE_CONSENT/);
});

test("draft immutable intent includes contact and consent; property ordering does not matter", () => {
  const intent={items:[{id:"menu",quantity:1}],phone:"+27712345678",consent:2750};
  const hash=draftHash(intent);
  assert.equal(hash,draftHash({consent:2750,phone:intent.phone,items:intent.items}));
  assert.notEqual(hash,draftHash({...intent,phone:"+27722222222"}));
  assert.notEqual(hash,draftHash({...intent,consent:2800}));
  assert.throws(() => draftHash({price:NaN}));
  assert.equal(draftReplayCreation({userId:"customer",createIntentHash:hash,orderId:"order"},"customer",hash),"order");
  assert.throws(() => draftReplayCreation({userId:"other",createIntentHash:hash,orderId:"order"},"customer",hash), /IDEMPOTENCY_CONFLICT/);
  assert.throws(() => draftReplayCreation({userId:"customer",createIntentHash:null,orderId:"order"},"customer",hash), /IDEMPOTENCY_CONFLICT/);
});

test("draft full pickup lifecycle keeps payment and handover separate", () => {
  let state:DraftPickupState={status:"pending",payment:"unpaid",revision:0};
  state=draftTransition(state,command("accept",0)).state;
  const ready=draftTransition(state,command("ready",1)); state=ready.state;
  assert.equal(state.status,"ready_for_pickup"); assert.equal(state.payment,"unpaid");
  assert.throws(() => draftTransition(state,command("collect",2)), /PAYMENT_CONFIRMATION_REQUIRED/);
  state=draftTransition(state,command("confirm_payment",2)).state;
  assert.equal(state.status,"ready_for_pickup"); assert.equal(state.payment,"paid");
  state=draftTransition(state,command("collect",3)).state;
  assert.equal(state.status,"collected"); assert.equal(state.payment,"paid");
  assert.throws(() => draftTransition(state,command("accept",4)), /INVALID_ORDER_TRANSITION/);
  assert.equal(draftTransition(state,command("ready",1),ready.event).event,ready.event);
});

test("draft duplicate Ready, ownership, changed command and cancellation races fail safely", () => {
  const initial:DraftPickupState={status:"pending",payment:"unpaid",revision:0};
  for (const action of ["reject","cancel"] as const) {
    const cancelled=draftTransition(initial,{...command(action,0),reason:"Cannot fulfill"});
    assert.equal(cancelled.state.status,"cancelled");
    assert.throws(() => draftTransition(cancelled.state,command("accept",0)), /ORDER_STATE_CHANGED/);
    assert.throws(() => draftTransition(cancelled.state,command("accept",1)), /INVALID_ORDER_TRANSITION/);
  }
  assert.throws(() => draftTransition(initial,{...command("accept",0),authorized:false}), /FORBIDDEN/);
  assert.throws(() => draftTransition(initial,{...command("accept",0),actor:"customer"}), /FORBIDDEN/);
  const readyCommand=command("ready",1);
  const ready=draftTransition({status:"preparing",payment:"unpaid",revision:1},readyCommand);
  assert.equal(draftTransition(ready.state,readyCommand,ready.event).replayed,true);
  assert.throws(() => draftTransition(ready.state,{...readyCommand,expectedRevision:2},ready.event), /IDEMPOTENCY_CONFLICT/);
  assert.throws(() => draftTransition(ready.state,{...readyCommand,expectedRevision:2,commandId:command("ready",2).commandId}), /INVALID_ORDER_TRANSITION/);
});

// Text/static assertions only. This test never opens a database or executes SQL.
const rawSql=readFileSync(resolve(process.cwd(),"../supabase/drafts/pickup_launch_foundation.sql"),"utf8");
const sql=rawSql.replace(/--[^\n]*/g, "");
test("draft migration is additive and leaves unknown history and Rider schema untouched", () => {
  assert.match(rawSql,/UNAPPROVED REVIEW DRAFT/);
  assert.doesNotMatch(sql,/^\s*(?:drop|truncate|delete)\s/im);
  assert.doesNotMatch(sql,/alter table public\.rider_/i);
  assert.doesNotMatch(sql,/add column (?:delivery_type|payment_status|create_intent_hash|revision)[^;\n]*default/i);
  assert.equal((sql.match(/add column /g)||[]).length,4);
  assert.equal((sql.match(/create table /g)||[]).length,3);
  assert.doesNotMatch(sql,/security definer/i);
  assert.doesNotMatch(sql,/create policy/i);
});
test("draft migration separates immutable events from mutable push jobs and denies browser grants", () => {
  assert.match(sql,/PICKUP_EVENT_APPEND_ONLY/);
  assert.match(sql,/PICKUP_CREATION_FACTS_IMMUTABLE/);
  assert.match(sql,/PICKUP_ATOMIC_EVENT_REQUIRED/);
  assert.match(sql,/deferrable initially deferred/);
  assert.match(sql,/unique \(order_id, command_id\)/);
  assert.match(sql,/unique \(order_id, kind\)/);
  assert.match(sql,/unique\(event_id, subscription_id\)/);
  assert.match(sql,/PICKUP_PUSH_RECIPIENT_INVALID/);
  for (const table of ["pickup_order_events","pickup_push_subscriptions","pickup_push_outbox"]) {
    assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(sql,/grant select, insert on table public\.pickup_order_events to service_role/);
  assert.doesNotMatch(sql,/grant[^;]+to (?:public|anon|authenticated)/i);
  assert.match(sql,/new\.payment_status is distinct from old\.payment_status/);
  assert.match(sql,/old\.payment_status = 'paid'/);
});


test("zero-fee draft replaces only creation fee and preserves the approved foundation",async()=>{
 const {readFileSync}=await import("node:fs");
 const foundation=readFileSync(new URL("../../../supabase/drafts/pickup_launch_foundation.sql",import.meta.url),"utf8").replaceAll("\r\n","\n");
 const draft=readFileSync(new URL("../../../supabase/drafts/pickup_zero_fee.sql",import.meta.url),"utf8").replaceAll("\r\n","\n");
 const original=foundation.slice(foundation.indexOf("create function public.pickup_create_order("),foundation.indexOf("$create$;",foundation.indexOf("create function public.pickup_create_order("))+10);
 const replaced=draft.slice(draft.indexOf("create or replace function public.pickup_create_order("),draft.indexOf("$create$;",draft.indexOf("create or replace function public.pickup_create_order("))+10);
 assert.equal(replaced,original.replace("create function","create or replace function").replace("fee := case when subtotal > 0 then 2.50 else 0 end;","fee := 0;"));
 assert.match(draft,/PICKUP_CREATE_FUNCTION_DRIFT/);
 assert.doesNotMatch(draft,/alter table|drop table|delete from|update public\.orders/i);
});
