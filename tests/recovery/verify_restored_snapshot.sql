-- Validate restored synthetic snapshot: record integrity, unique keys,
-- replay safety and privileges. This is not a full Supabase disaster recovery test.
DO $check$
DECLARE
  shop_count bigint;
  order_count bigint;
  event_count bigint;
  push_count bigint;
  minute_count bigint;
  max_per_minute bigint;
  rls_on boolean;
  policy_count integer;
  trigger_count integer;
BEGIN
  SELECT count(*) INTO shop_count FROM public.shops;
  SELECT count(*) INTO order_count FROM public.orders;
  SELECT count(*) INTO event_count FROM public.pickup_order_events;
  SELECT count(*) INTO push_count FROM public.pickup_push_outbox;
  IF shop_count <> 20 OR order_count <> 150 OR event_count <> 150 OR push_count <> 150 THEN
    RAISE EXCEPTION 'Restore mismatch shops %, orders %, events %, outbox %',
      shop_count, order_count, event_count, push_count;
  END IF;
  IF EXISTS (SELECT id FROM public.orders GROUP BY id HAVING count(*)>1)
    OR EXISTS (SELECT idempotency_key FROM public.orders GROUP BY idempotency_key HAVING count(*)>1)
    OR EXISTS (SELECT order_id FROM public.pickup_order_events GROUP BY order_id HAVING count(*)>1)
    OR EXISTS (SELECT event_id FROM public.pickup_push_outbox GROUP BY event_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Unique recovery constraint violated';
  END IF;
  SELECT count(*), max(c) INTO minute_count,max_per_minute FROM
    (SELECT arrival_minute,count(*) AS c FROM public.orders GROUP BY arrival_minute) AS rush;
  IF minute_count <> 15 OR max_per_minute <> 10 OR
     EXISTS (SELECT 1 FROM (SELECT count(*) AS c FROM public.orders GROUP BY arrival_minute) v WHERE c<>10) THEN
    RAISE EXCEPTION 'Restored burst distribution differs from fixture';
  END IF;
  SELECT relrowsecurity INTO rls_on FROM pg_class WHERE oid='public.orders'::regclass;
  SELECT count(*) INTO policy_count FROM pg_policies
    WHERE schemaname='public' AND tablename='orders'
      AND policyname='orders_authenticated_no_cross_shop_access' AND qual='false';
  SELECT count(*) INTO trigger_count FROM pg_trigger
    WHERE tgrelid='public.orders'::regclass AND tgname='order_idempotency_immutable'
      AND NOT tgisinternal;
  IF NOT rls_on OR policy_count<>1 OR trigger_count<>1
    OR NOT has_table_privilege('authenticated','public.orders','SELECT') THEN
    RAISE EXCEPTION 'RLS, policies, trigger, or grants not restored';
  END IF;
END
$check$;

-- Confirm duplicate logical order intent cannot be inserted after restore.
DO $dedup$
BEGIN
  BEGIN
    INSERT INTO public.orders(id,shop_id,customer_id,idempotency_key,status,total_minor,arrival_minute)
      SELECT md5('synthetic-duplicate')::uuid,shop_id,customer_id,
        idempotency_key,status,total_minor,arrival_minute
      FROM public.orders LIMIT 1;
    RAISE EXCEPTION 'UNIQUE_GUARD_FAILED: duplicated idempotency key was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$dedup$;

-- Confirm the trigger prevents changing the original idempotency key.
DO $immutable$
DECLARE
  rejected boolean := false;
BEGIN
  BEGIN
    UPDATE public.orders SET idempotency_key=md5('altered-idempotency')::uuid
    WHERE id=(SELECT id FROM public.orders ORDER BY id LIMIT 1);
  EXCEPTION WHEN raise_exception THEN
    rejected := true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'Restored immutable-order trigger failed';
  END IF;
END
$immutable$;

DO $final$
BEGIN
  IF (SELECT count(*) FROM public.orders)<>150
    OR (SELECT count(*) FROM public.pickup_order_events)<>150
    OR (SELECT count(*) FROM public.pickup_push_outbox)<>150 THEN
    RAISE EXCEPTION 'Recovery assertions modified the archive content';
  END IF;
END
$final$;
