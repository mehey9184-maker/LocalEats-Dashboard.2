#!/usr/bin/env bash
# H6B: fixed starting dataset per repeat, disposable PG17 only.
set -Eeuo pipefail
name="$1"
[[ "$name" =~ ^localeats_pickup_r35_[0-9]+$ ]]
[[ "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$name")" == none ]]
[[ "$(docker inspect -f '{{index .Config.Labels "localeats.h2d1"}}' "$name")" == synthetic ]]
tmp="$(mktemp -d)";trap 'rm -rf "$tmp"' EXIT
pg(){ docker exec -e PGOPTIONS='-c statement_timeout=15000 -c lock_timeout=10000' "$name" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d "$1" -c "$2"; }
base=pickup_r35_lab
# Seed exactly the same large starting snapshot before every repeat. H6A already
# seeded 100 shops, 2000 menu items, 320 complete journeys and active subscriptions.
[[ "$(pg "$base" "select count(*) from public.orders where user_id like 'h6a-%'")" == 320 ]]
docker exec -i "$name" sh -c 'cat >/tmp/h6b-mixed.pgbench' <<'SQL'
\set u random(1,500)
\set shopnum 1+(:u-1)%100
BEGIN;
SET LOCAL ROLE service_role;
SELECT id FROM public.orders WHERE user_id='h6a-4-u-'||:u ORDER BY created_at DESC,id DESC LIMIT 50;
SELECT id FROM public.orders WHERE shop_id='h6a-shop-'||:shopnum ORDER BY created_at DESC,id DESC LIMIT 50;
SELECT id,price FROM public.menu_items WHERE shop_id='h6a-shop-'||:shopnum;
SELECT h6a_fixture.journey(4,100,:u);
COMMIT;
SQL
# 600 atomic journeys each, 3 repeats per concurrency; fresh snapshot per repeat.
# Counterbalanced order reduces systematic warm-up bias. Each trial is finite.
for rep in 1 2 3;do
 case "$rep" in 1) sequence='5 10 20';;2) sequence='20 5 10';;3) sequence='10 20 5';;esac
 for c in $sequence;do
  db="h6b_trial_${rep}_${c}"
  docker exec "$name" createdb -U postgres -T "$base" "$db"
  prefix="/tmp/h6b-$rep-$c"
  # Capture actual container-wide CPU and memory; includes pgbench client.
  resource(){ docker exec "$name" sh -c 'if [ -r /sys/fs/cgroup/cpu.stat ] && [ -r /sys/fs/cgroup/memory.current ]; then awk "/^usage_usec /{print \$2}" /sys/fs/cgroup/cpu.stat; cat /sys/fs/cgroup/memory.current; else echo -1;echo -1;fi'; }
  resource >"$tmp/resource.before"
  docker exec -e PGOPTIONS='-c statement_timeout=15000 -c lock_timeout=10000' "$name" pgbench -n -U postgres -d "$db" -c "$c" -j 4 -t "$((600/c))" -r -l --log-prefix="$prefix" -f /tmp/h6b-mixed.pgbench >"$tmp/bench" 2>&1 & bench=$!
  : >"$tmp/samples"; : >"$tmp/resource.samples"
  while kill -0 "$bench" 2>/dev/null;do
   pg "$db" "select count(*) filter(where wait_event_type='Lock')||','||count(*) filter(where state='active')||','||count(*) from pg_stat_activity where datname=current_database() and application_name='pgbench'" >>"$tmp/samples"
   resource >>"$tmp/resource.samples"
   sleep .05
  done
  wait "$bench" || { cat "$tmp/bench";exit 1; }
  resource >"$tmp/resource.after"
  docker exec "$name" sh -c "cat $prefix.*" >"$tmp/latency"
  [[ "$(pg "$db" "select count(*) from public.orders where user_id like 'h6a-4-u-%'")" == 800 ]]
  [[ "$(pg "$db" "select count(*) from public.orders where user_id like 'h6a-4-u-%' and status='collected' and payment_status='paid' and revision=4 and total_price=25")" == 800 ]]
  for kind in created payment_confirmed collected;do
   [[ "$(pg "$db" "select count(*) from public.pickup_order_events e join public.orders o on o.id=e.order_id where o.user_id like 'h6a-4-u-%' and e.kind='$kind'")" == 800 ]]
  done
  [[ "$(pg "$db" "select count(*) from public.pickup_push_outbox q join public.pickup_order_events e on e.id=q.event_id join public.orders o on o.id=e.order_id where o.user_id like 'h6a-4-u-%'")" == 800 ]]
  python3 - "$tmp" "$rep" "$c" <<'PY'
import sys,pathlib,json,re,math
p=pathlib.Path(sys.argv[1]);rep,c=map(int,sys.argv[2:])
v=sorted(float(l.split()[2])/1000 for l in (p/'latency').read_text().splitlines() if l.strip());assert len(v)==600
q=lambda n:round(v[math.ceil(n*len(v))-1],3)
log=(p/'bench').read_text(); tps=float(re.search(r'tps = ([0-9.]+)',log)[1])
assert re.search(r'number of failed transactions: 0 ',log)
a=list(map(int,(p/'resource.before').read_text().split()));b=list(map(int,(p/'resource.after').read_text().split()))
samples=list(map(int,(p/'resource.samples').read_text().split()))
locks=[tuple(map(int,l.split(','))) for l in (p/'samples').read_text().splitlines()]
print('H6B_DB '+json.dumps(dict(rep=rep,concurrency=c,starting_orders=320,journeys=600,tps=tps,p50_ms=q(.5),p95_ms=q(.95),p99_ms=q(.99),max_ms=q(1),cpu_ms=(b[0]-a[0])/1000 if a[0]>=0 else None,sampled_memory_peak_bytes=max([a[1],b[1]]+samples[1::2]) if a[1]>=0 else None,lock_samples=len(locks),max_waiters=max((x[0] for x in locks),default=0),max_active=max((x[1] for x in locks),default=0),max_connections=max((x[2] for x in locks),default=0),failed=0,events=3000,outbox=600)))
PY
  : >"$tmp/resource.samples"
  docker exec "$name" dropdb -U postgres "$db"
 done
done
echo H6B_FIXED_DB_PASS
