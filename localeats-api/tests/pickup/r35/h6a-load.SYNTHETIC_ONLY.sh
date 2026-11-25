#!/usr/bin/env bash
# H6A: only after digest-verified recovered schema, geography draft, H2D1/H5E gates.
set -Eeuo pipefail
name="$1"
[[ "$name" =~ ^localeats_pickup_r35_[0-9]+$ ]]
[[ "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$name")" == none ]]
[[ "$(docker inspect -f '{{index .Config.Labels "localeats.h2d1"}}' "$name")" == synthetic ]]
docker exec "$name" pgbench --version
tmp="$(mktemp -d)";trap 'rm -rf "$tmp"' EXIT
pg(){ docker exec -e PGOPTIONS='-c statement_timeout=15000 -c lock_timeout=10000' "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d pickup_r35_lab -c "$1"; }
expect(){ local got;got="$(pg "$1")";[[ "$got" == "$2" ]] || { echo "H6A expected=$2 got=$got" >&2;exit 1; }; }
docker exec -i "$name" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d pickup_r35_lab <<'SQL'
CREATE SCHEMA h6a_fixture;
CREATE TABLE h6a_fixture.registered(stage int,uid text PRIMARY KEY);
-- Harness only: exact functions, one atomic journey per benchmark transaction.
CREATE FUNCTION h6a_fixture.journey(stage int,shops int,u int) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE
 customer text:='h6a-'||stage||'-u-'||u;
 shopnum int:=1+(u-1)%shops;
 shop text:='h6a-shop-'||shopnum;
 owner text:='h6a-owner-'||shopnum;
 key uuid:=gen_random_uuid();
 a uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 record jsonb; result jsonb; oid uuid;
BEGIN
 record:=jsonb_set(r34_fixture.make_record(key,25,25,0,shop),'{items,0,menu_item_id}',to_jsonb(shop||'-menu-1'));
 result:=public.pickup_create_order(customer,repeat('a',64),record);
 IF result->>'replayed'<>'false' THEN RAISE EXCEPTION 'H6A unexpected create replay'; END IF;
 oid:=(result->'order'->>'id')::uuid;
 IF (public.pickup_create_order(customer,repeat('a',64),record)->>'replayed')<>'true' THEN RAISE EXCEPTION 'H6A missing create replay'; END IF;
 PERFORM public.pickup_order_command(owner,oid,'accept',a,0,null,null,false);
 PERFORM public.pickup_order_command(owner,oid,'ready',r,1,null,null,false);
 PERFORM public.pickup_order_command(owner,oid,'confirm_payment',p,2,null,'cash',false);
 IF (public.pickup_order_command(owner,oid,'confirm_payment',p,2,null,'cash',false)->>'replayed')<>'true' THEN RAISE EXCEPTION 'H6A missing payment replay'; END IF;
 PERFORM public.pickup_order_command(owner,oid,'collect',c,3,null,null,true);
 IF (public.pickup_order_command(owner,oid,'collect',c,3,null,null,true)->>'replayed')<>'true' THEN RAISE EXCEPTION 'H6A missing collection replay'; END IF;
END $$;
REVOKE ALL ON SCHEMA h6a_fixture FROM PUBLIC;
REVOKE ALL ON FUNCTION h6a_fixture.journey(int,int,int) FROM PUBLIC;
GRANT USAGE ON SCHEMA h6a_fixture TO service_role;
GRANT EXECUTE ON FUNCTION h6a_fixture.journey(int,int,int) TO service_role;
SQL
docker exec -i "$name" sh -c 'cat >/tmp/h6a-journey.pgbench' <<'SQL'
\set u random(1,:active)
BEGIN;
SET LOCAL ROLE service_role;
SELECT h6a_fixture.journey(:stage,:shops,:u);
COMMIT;
SQL
stage=0
while read -r shops registered active concurrency volume; do
 stage=$((stage+1))
 pg "insert into public.shops(id,owner_id,name,location,is_active,approval_status,lat,lng,latitude,longitude,opening_time,closing_time,availability_override_until,pickup_payment_methods)
 select 'h6a-shop-'||i,'h6a-owner-'||i,'Synthetic Shop '||i,'Ivory Park Tembisa',true,'approved',-26.01,28.19,-26.01,28.19,'00:00','23:59',statement_timestamp()+interval '1 day',array['cash','card_machine'] from generate_series(1,$shops)i on conflict(id) do nothing;
 insert into public.menu_items(id,shop_id,name,price,is_available) select 'h6a-shop-'||i||'-menu-'||j,'h6a-shop-'||i,'Synthetic Kota',25,true from generate_series(1,$shops)i cross join generate_series(1,20)j on conflict(id) do nothing;
 insert into h6a_fixture.registered select $stage,'h6a-$stage-u-'||i from generate_series(1,$registered)i;
 insert into public.pickup_push_subscriptions(user_id,installation_id,fcm_token) select 'h6a-$stage-u-'||i,gen_random_uuid(),'H6A_SYNTHETIC_NEVER_SEND_'||$stage||'_'||i from generate_series(1,$active)i;
 analyze public.shops; analyze public.menu_items; analyze public.orders;" >/dev/null
 expect "select count(*) from h6a_fixture.registered where stage=$stage" "$registered"
 expect "select count(*) from public.shops where id like 'h6a-shop-%'" "$shops"
 expect "select count(*) from public.menu_items where id like 'h6a-shop-%'" "$((shops*20))"
 expect "select count(*) from public.orders where user_id like 'h6a-$stage-u-%'" 0
 prefix="/tmp/h6a-stage-$stage"
 # Sample actual wait-event counts while bounded pgbench clients run.
 docker exec -e PGOPTIONS='-c statement_timeout=15000 -c lock_timeout=10000' "$name" pgbench -n -U postgres -d pickup_r35_lab -c "$concurrency" -j "$((concurrency<4?concurrency:4))" -t "$((volume/concurrency))" -r -l --log-prefix="$prefix" -D stage="$stage" -D shops="$shops" -D active="$active" -f /tmp/h6a-journey.pgbench >"$tmp/bench" 2>&1 & bench=$!
 : >"$tmp/locks"
 while kill -0 "$bench" 2>/dev/null; do
  pg "select count(*) filter(where wait_event_type='Lock')||','||count(*) filter(where state='active') from pg_stat_activity where application_name='pgbench'" >>"$tmp/locks"
  sleep .05
 done
 wait "$bench" || { cat "$tmp/bench";exit 1; }
 cat "$tmp/bench"
 docker exec "$name" sh -c "cat $prefix.*" >"$tmp/latency"
 expect "select count(*) from public.orders where user_id like 'h6a-$stage-u-%' and status='collected' and payment_status='paid' and revision=4 and total_price=25 and service_fee=0" "$volume"
 expect "select count(*) from public.orders where user_id like 'h6a-$stage-u-%'" "$volume"
 expect "select count(*) from public.pickup_order_events e join public.orders o on o.id=e.order_id where o.user_id like 'h6a-$stage-u-%'" "$((volume*5))"
 for kind in created payment_confirmed collected;do
  expect "select count(*) from public.pickup_order_events e join public.orders o on o.id=e.order_id where o.user_id like 'h6a-$stage-u-%' and e.kind='$kind'" "$volume"
 done
 expect "select count(*) from public.pickup_push_outbox q join public.pickup_order_events e on e.id=q.event_id join public.orders o on o.id=e.order_id where o.user_id like 'h6a-$stage-u-%'" "$volume"
 # Real database EXPLAIN; reconstructed minimal schema, not hosted index rollout.
 pg "analyze public.orders;analyze public.pickup_order_events;analyze public.pickup_push_outbox;" >/dev/null
 pg "explain(analyze,buffers,format json) select * from public.orders where user_id='h6a-$stage-u-1' order by created_at desc limit 50" >"$tmp/history.json"
 pg "explain(analyze,buffers,format json) select * from public.orders where shop_id='h6a-shop-1' order by created_at desc limit 50" >"$tmp/inbox.json"
 pg "explain(analyze,buffers,format json) select * from public.menu_items where shop_id='h6a-shop-1'" >"$tmp/menu.json"
 pg "explain(analyze,buffers,format json) select * from public.shops where approval_status='approved' and archived_at is null" >"$tmp/catalog.json"
 mem="$(docker stats --no-stream --format '{{.MemUsage}}' "$name")"
 python3 - "$tmp" "$stage" "$shops" "$registered" "$active" "$concurrency" "$volume" "$mem" <<'PY'
import json,sys,re,pathlib
p=pathlib.Path(sys.argv[1]);stage,shops,registered,active,concurrency,volume=map(int,sys.argv[2:8]);mem=sys.argv[8]
v=sorted(float(l.split()[2])/1000 for l in (p/'latency').read_text().splitlines() if l.strip())
assert len(v)==volume,(len(v),volume)
def q(x):return round(v[__import__('math').ceil(len(v)*x)-1],3)
log=(p/'bench').read_text()
tps=re.search(r'tps = ([0-9.]+)',log);assert tps
locks=[tuple(map(int,l.split(','))) for l in (p/'locks').read_text().splitlines() if l.strip()]
plans={}
for key in ('history','inbox','menu','catalog'):
 x=json.loads((p/(key+'.json')).read_text())[0];root=x['Plan']
 plans[key]={'node':root['Node Type'],'execution_ms':x['Execution Time'],'planning_ms':x['Planning Time'],'rows':root['Actual Rows'],'shared_hit':root.get('Shared Hit Blocks',0),'shared_read':root.get('Shared Read Blocks',0)}
print('H6A_DB '+json.dumps(dict(stage=stage,shops=shops,registered=registered,active_pool=active,concurrency=concurrency,journeys=volume,tps=float(tps[1]),p50_ms=q(.5),p95_ms=q(.95),p99_ms=q(.99),max_ms=q(1),events=volume*5,outbox=volume,lock_samples=len(locks),max_lock_waiters=max((l[0] for l in locks),default=0),max_active_backends=max((l[1] for l in locks),default=0),memory_snapshot=mem,plans=plans)))
PY
done <<'STAGES'
1 25 5 2 10
5 100 20 5 30
25 500 100 10 80
100 2500 500 20 200
STAGES
echo H6A_DB_ALL_STAGES_PASS
