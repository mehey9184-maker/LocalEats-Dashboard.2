#!/usr/bin/env bash
# H6C queue rehearsal, only after H6A has seeded the disposable archived lab.
set -Eeuo pipefail
name="$1"
[[ "$name" =~ ^localeats_pickup_r35_[0-9]+$ ]]
[[ "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$name")" == none ]]
[[ "$(docker inspect -f '{{index .Config.Labels "localeats.h2d1"}}' "$name")" == synthetic ]]
python3 - "$name" <<'PY'
import concurrent.futures as cf, subprocess as sp, sys, time, json, statistics, threading
name=sys.argv[1]
def docker(*args,stdin=None):
 return sp.run(['docker','exec','-i',name,*args],input=stdin,text=True,capture_output=True,check=True,timeout=60).stdout.strip()
def query(db,sql): return docker('psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',db,stdin=sql)
for workers in (5,10,20):
 db='h6c_pool_'+str(workers)
 docker('createdb','-U','postgres','-T','pickup_r35_lab',db)
 try:
  # 40 explicitly offered jobs. No auto retries; commands are separate
  # autocommit transactions on a session. Queue bound = 40 in this lab.
  offered=time.monotonic();lock=threading.Lock();running=0;peak=0
  def job(i):
   global running,peak
   started=time.monotonic()
   with lock:
    running+=1;peak=max(peak,running)
   uid=f'h6a-4-u-{i}';shop=f'h6a-shop-{i}';owner=f'h6a-owner-{i}'
   sql=f"""
SET statement_timeout='15s';
SET lock_timeout='10s';
SET ROLE service_role;
SELECT (public.pickup_create_order('{uid}',repeat('c',64),jsonb_set(r34_fixture.make_record(gen_random_uuid(),25,25,0,'{shop}'),'{{items,0,menu_item_id}}',to_jsonb('{shop}-menu-1'::text)))->'order'->>'id') AS oid \\gset
SELECT public.pickup_order_command('{owner}',:'oid'::uuid,'accept',gen_random_uuid(),0,null,null,false);
SELECT public.pickup_order_command('{owner}',:'oid'::uuid,'ready',gen_random_uuid(),1,null,null,false);
SELECT public.pickup_order_command('{owner}',:'oid'::uuid,'confirm_payment',gen_random_uuid(),2,null,'cash',false);
SELECT public.pickup_order_command('{owner}',:'oid'::uuid,'collect',gen_random_uuid(),3,null,null,true);
"""
   try: query(db,sql)
   finally:
    with lock: running-=1
   return ((started-offered)*1000,(time.monotonic()-started)*1000)
  with cf.ThreadPoolExecutor(max_workers=workers) as ex: results=list(ex.map(job,range(1,41)))
  elapsed=time.monotonic()-offered
  assert query(db,"select count(*) from public.orders where user_id like 'h6a-4-u-%' and status='collected' and payment_status='paid' and revision=4;")=='240'
  for kind in ('created','payment_confirmed','collected'):
   assert query(db,f"select count(*) from public.pickup_order_events e join public.orders o on o.id=e.order_id where o.user_id like 'h6a-4-u-%' and e.kind='{kind}';")=='240'
  assert query(db,"select count(*) from public.pickup_push_outbox q join public.pickup_order_events e on e.id=q.event_id join public.orders o on o.id=e.order_id where o.user_id like 'h6a-4-u-%';")=='240'
  assert peak<=workers
  print('H6C_POOL '+json.dumps(dict(offered=40,workers=workers,peak_inflight=peak,committed=40,failed=0,automatic_retries=0,elapsed_ms=round(elapsed*1000,2),jobs_per_s=round(40/elapsed,2),queue_p95_ms=round(sorted(x[0] for x in results)[37],2),service_p95_ms=round(sorted(x[1] for x in results)[37],2))))
 finally: docker('dropdb','-U','postgres',db)
PY
echo H6C_QUEUE_REHEARSAL_PASS
