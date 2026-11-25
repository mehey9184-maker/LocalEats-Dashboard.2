\set ON_ERROR_STOP on
-- NEVER a migration. Disposable Docker lab only; H4A fixture and observed index subset.
DO $$ BEGIN IF current_database() <> 'h4c_lab' THEN RAISE EXCEPTION 'DISPOSABLE_DATABASE_REQUIRED'; END IF; END $$;
\ir ../h4a/baseline.SYNTHETIC_ONLY.sql
CREATE TEMP TABLE h4c_queries(name text PRIMARY KEY,sql text);
INSERT INTO h4c_queries VALUES
 ('customer_history',$q$SELECT * FROM orders WHERE user_id='customer-7' AND delivery_type='collection' ORDER BY created_at DESC,id DESC LIMIT 51$q$),
 ('customer_recent',$q$SELECT * FROM orders WHERE user_id='customer-7' ORDER BY created_at DESC,id DESC LIMIT 50$q$),
 ('customer_cursor',$q$SELECT * FROM orders WHERE user_id='customer-7' AND delivery_type='collection' AND (created_at < '2026-01-10' OR (created_at = '2026-01-10' AND id < 'ffffffff-ffff-ffff-ffff-ffffffffffff')) ORDER BY created_at DESC,id DESC LIMIT 51$q$),
 ('menu',$q$SELECT id,shop_id,name,price,is_available FROM menu_items WHERE shop_id='shop-7'$q$),
 ('batch_menu',$q$SELECT id,shop_id,name,price,is_available FROM menu_items WHERE shop_id IN ('shop-7','shop-8','shop-9','shop-10') LIMIT 500$q$),
 ('merchant_recent',$q$SELECT * FROM orders WHERE shop_id='shop-7' ORDER BY created_at DESC,id DESC LIMIT 50$q$);
CREATE TEMP TABLE h4c_measurements(variant text,name text,scan_rows numeric,buffers numeric,execution_ms numeric,result_digest text,plan jsonb,PRIMARY KEY(variant,name));
CREATE FUNCTION pg_temp.h4c_measure(variant text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE q record; j jsonb; digest text; scanned numeric;
BEGIN
 FOR q IN SELECT * FROM h4c_queries LOOP
  EXECUTE 'EXPLAIN (ANALYZE,BUFFERS,TIMING OFF,FORMAT JSON) '||q.sql INTO j;
  WITH RECURSIVE nodes(n) AS (
    SELECT j->0->'Plan' UNION ALL
    SELECT child FROM nodes CROSS JOIN LATERAL jsonb_array_elements(COALESCE(n->'Plans','[]'::jsonb)) child
  ) SELECT COALESCE(sum((COALESCE((n->>'Actual Rows')::numeric,0)+COALESCE((n->>'Rows Removed by Filter')::numeric,0)+COALESCE((n->>'Rows Removed by Index Recheck')::numeric,0))*COALESCE((n->>'Actual Loops')::numeric,0)),0)
    INTO scanned FROM nodes WHERE n->>'Node Type' LIKE '%Scan%';
  EXECUTE 'SELECT md5(COALESCE(string_agg(to_jsonb(x)::text,'','' ORDER BY to_jsonb(x)::text),'''')) FROM ('||q.sql||') x' INTO digest;
  INSERT INTO h4c_measurements VALUES(variant,q.name,scanned,
   COALESCE((j->0->'Plan'->>'Shared Hit Blocks')::numeric,0)+COALESCE((j->0->'Plan'->>'Shared Read Blocks')::numeric,0),
   (j->0->>'Execution Time')::numeric,digest,j);
 END LOOP;
END $$;
SELECT pg_temp.h4c_measure('before');
CREATE INDEX h4c_orders_user_created_id_lab ON orders(user_id,created_at DESC,id DESC);
CREATE INDEX h4c_menu_shop_lab ON menu_items(shop_id);
ANALYZE orders; ANALYZE menu_items;
SELECT pg_temp.h4c_measure('after');
SELECT name,variant,scan_rows,buffers,execution_ms FROM h4c_measurements ORDER BY name,variant DESC;
SELECT name,variant,plan FROM h4c_measurements ORDER BY name,variant DESC;
SELECT relname,pg_relation_size(oid) AS bytes FROM pg_class WHERE relname IN ('h4c_orders_user_created_id_lab','h4c_menu_shop_lab');
DO $$ DECLARE r record;
BEGIN
 FOR r IN SELECT b.name,b.scan_rows AS before_rows,a.scan_rows AS after_rows,b.buffers AS before_buffers,a.buffers AS after_buffers,b.result_digest AS before_digest,a.result_digest AS after_digest
 FROM h4c_measurements b JOIN h4c_measurements a ON a.name=b.name AND a.variant='after' WHERE b.variant='before'
 LOOP
  IF r.before_digest IS DISTINCT FROM r.after_digest THEN RAISE EXCEPTION 'RESULT_CHANGED %',r.name; END IF;
  IF r.name IN ('customer_history','menu') AND NOT (r.after_rows<=r.before_rows*0.2 OR r.after_buffers<=r.before_buffers*0.2) THEN
    RAISE EXCEPTION 'H4A_80_PERCENT_TARGET_NOT_MET %',r.name;
  END IF;
 END LOOP;
END $$;
\echo H4C_DISPOSABLE_PLAN_PASS
