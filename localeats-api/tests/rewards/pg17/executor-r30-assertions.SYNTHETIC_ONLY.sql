-- R3.0 synthetic only: deterministic trusted source and narrow executor assertions.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO r30_source.orders(id,customer_uid,shop_id,origin,registered,test_order,status,payment_status)
 VALUES
 ('00000000-0000-4000-8000-000000000301'::uuid,'alice','shop-a','server_created_pickup',true,false,'collected','paid'),
 ('00000000-0000-4000-8000-000000000302'::uuid,'bob','shop-a','server_created_pickup',true,false,'collected','paid'),
 ('00000000-0000-4000-8000-000000000303'::uuid,'guest','shop-a','server_created_pickup',false,false,'collected','paid'),
 ('00000000-0000-4000-8000-000000000304'::uuid,'test-user','shop-a','server_created_pickup',true,true,'collected','paid'),
 ('00000000-0000-4000-8000-000000000305'::uuid,'carol','shop-a','server_created_pickup',true,false,'collected','unpaid'),
 ('00000000-0000-4000-8000-000000000306'::uuid,'refunded','shop-a','server_created_pickup',true,false,'collected','paid'),
 ('00000000-0000-4000-8000-000000000307'::uuid,'noevents','shop-a','server_created_pickup',true,false,'collected','paid');
INSERT INTO r30_source.purchase_lines(order_id,line_index,quantity,qualifies_kota,provenance,snapshot_at)
 SELECT id,1,4,true,'immutable_checkout_snapshot',created_at
 FROM r30_source.orders;
INSERT INTO r30_source.pickup_events(order_id,revision,command_id,kind,occurred_at)
 SELECT id,1,
  CASE customer_uid
    WHEN 'alice' THEN '00000000-0000-4000-8000-000000000311'::uuid
    WHEN 'bob' THEN '00000000-0000-4000-8000-000000000312'::uuid
    WHEN 'guest' THEN '00000000-0000-4000-8000-000000000313'::uuid
    WHEN 'test-user' THEN '00000000-0000-4000-8000-000000000314'::uuid
    WHEN 'carol' THEN '00000000-0000-4000-8000-000000000315'::uuid
    ELSE '00000000-0000-4000-8000-000000000316'::uuid
  END,'payment_confirmed',created_at
 FROM r30_source.orders WHERE customer_uid<>'noevents';
INSERT INTO r30_source.pickup_events(order_id,revision,command_id,kind,occurred_at)
 SELECT id,2,
  CASE customer_uid
    WHEN 'alice' THEN '00000000-0000-4000-8000-000000000321'::uuid
    WHEN 'bob' THEN '00000000-0000-4000-8000-000000000322'::uuid
    WHEN 'guest' THEN '00000000-0000-4000-8000-000000000323'::uuid
    WHEN 'test-user' THEN '00000000-0000-4000-8000-000000000324'::uuid
    WHEN 'carol' THEN '00000000-0000-4000-8000-000000000325'::uuid
    ELSE '00000000-0000-4000-8000-000000000326'::uuid
  END,'collected',created_at
 FROM r30_source.orders WHERE customer_uid<>'noevents';
INSERT INTO r30_source.refund_events(refund_id,order_id,review_status,approved_by_merchant,approved_by_admin)
 VALUES('00000000-0000-4000-8000-000000000330'::uuid,
 '00000000-0000-4000-8000-000000000306'::uuid,'verified','merchant-a','admin-b');
COMMIT;

DO $r30checks$
DECLARE
  v_first integer;
  v_replay integer;
BEGIN
  -- Disabled by default even if fake source rows are syntactically valid.
  BEGIN
    PERFORM r30_private.credit_verified_pickup('00000000-0000-4000-8000-000000000301'::uuid);
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R30_REWARDS_DISABLED%' THEN RAISE; END IF;
  END;
  UPDATE r30_private.programme SET active=true,budget_minor=2500
    WHERE version='synthetic-v1';

  FOR v_first IN 303..304 LOOP
    BEGIN
      PERFORM r30_private.credit_verified_pickup(
        ('00000000-0000-4000-8000-000000000'||v_first)::uuid);
      RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%R30_TRUSTED_ORDER_REQUIRED%' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    PERFORM r30_private.credit_verified_pickup('00000000-0000-4000-8000-000000000305'::uuid);
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R30_TRUSTED_ORDER_REQUIRED%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM r30_private.credit_verified_pickup('00000000-0000-4000-8000-000000000306'::uuid);
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R30_REFUND_REVIEW_REQUIRED%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM r30_private.credit_verified_pickup('00000000-0000-4000-8000-000000000307'::uuid);
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R30_PAYMENT_AND_COLLECTION_PROOF_REQUIRED%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM r30_private.credit_verified_pickup('00000000-0000-4000-8000-000000000399'::uuid);
    RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%R30_TRUSTED_ORDER_REQUIRED%' THEN RAISE; END IF;
  END;

  v_first:=r30_private.credit_verified_pickup(
    '00000000-0000-4000-8000-000000000301'::uuid);
  v_replay:=r30_private.credit_verified_pickup(
    '00000000-0000-4000-8000-000000000301'::uuid);
  IF v_first<>4 OR v_replay<>0 OR
     (SELECT lifetime_units FROM r30_private.progress WHERE customer_uid='alice')<>4 OR
     (SELECT committed_minor FROM r30_private.programme WHERE version='synthetic-v1')<>2500 OR
     (SELECT count(*) FROM r30_private.credits)<>1 OR
     (SELECT count(*) FROM r30_private.bronze_grants)<>1 OR
     (SELECT count(*) FROM r30_private.audit_events)<>1
  THEN RAISE EXCEPTION 'R30_REPLAY_OR_LEDGER_FAILURE'; END IF;

  -- Test owner is not a Postgres superuser and cannot bypass RLS.
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles
     WHERE rolname='r30_finance_owner' AND (rolsuper OR rolbypassrls OR rolcanlogin))
  THEN RAISE EXCEPTION 'R30_FINANCE_OWNER_IS_PRIVILEGED_LOGIN'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles
     WHERE rolname IN ('r30_api_executor','r30_browser','r30_merchant')
       AND (rolsuper OR rolbypassrls OR rolcanlogin))
  THEN RAISE EXCEPTION 'R30_EXECUTOR_ROLE_TOO_PRIVILEGED'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles parent ON parent.oid=m.roleid
    JOIN pg_catalog.pg_roles member ON member.oid=m.member
    WHERE parent.rolname='r30_finance_owner' AND member.rolname='r30_api_executor')
  THEN RAISE EXCEPTION 'R30_EXECUTOR_CAN_INHERIT_OWNER'; END IF;
  IF (SELECT prosecdef FROM pg_catalog.pg_proc
      WHERE oid='r30_private.credit_verified_pickup(uuid)'::regprocedure) IS DISTINCT FROM true OR
     (SELECT proconfig FROM pg_catalog.pg_proc
      WHERE oid='r30_private.credit_verified_pickup(uuid)'::regprocedure)
        IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR
     (SELECT rolname FROM pg_catalog.pg_roles WHERE oid=(
      SELECT proowner FROM pg_catalog.pg_proc
       WHERE oid='r30_private.credit_verified_pickup(uuid)'::regprocedure))<>'r30_finance_owner'
  THEN RAISE EXCEPTION 'R30_UNSAFE_DEFINER_CONFIG'; END IF;
  IF (SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity)
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('r30_source','r30_private') AND c.relkind='r') IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'R30_NO_FORCED_RLS'; END IF;
END;
$r30checks$;
\echo R30_PRIVATE_EXECUTOR_SOURCE_IDENTITY_AND_BUDGET_PASS
