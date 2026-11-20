-- L3-N8O staging-only additive advisory fix.
-- Target: LocalEats-Profile-Staging rgpbdajhlrwfmhopzgzk.
-- No data writes, order activation, auth policies or Production changes.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $pre$
begin
  if to_regclass('public.pickup_push_outbox') is null
    or to_regclass('public.orders') is null
    or not exists(select 1 from pg_trigger where tgrelid='public.pickup_push_outbox'::regclass
                  and tgname='l3_n8o_outbox_hard_off' and tgenabled='O')
  then raise exception 'L3_N8O_STAGE_OUTBOX_HARD_OFF_REQUIRED'; end if;
  if to_regclass('public.l3_n8o_outbox_subscription_idx') is not null
  then raise exception 'L3_N8O_OUTBOX_INDEX_ALREADY_PRESENT'; end if;
end;
$pre$;
create index l3_n8o_outbox_subscription_idx
  on public.pickup_push_outbox(subscription_id);
commit;
