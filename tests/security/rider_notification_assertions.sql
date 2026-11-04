-- Postconditions of reviewed draft, evaluated in a disposable database.
DO $verify$
DECLARE who text;
BEGIN
 FOR who IN SELECT unnest(ARRAY['anon','authenticated']) LOOP
   IF has_table_privilege(who,'public.rider_notifications','SELECT')
     OR has_table_privilege(who,'public.rider_notifications','INSERT')
     OR has_table_privilege(who,'public.rider_notifications','UPDATE')
     OR has_table_privilege(who,'public.rider_notifications','DELETE')
     OR has_function_privilege(who,'public.nudge_rider(uuid,text)','EXECUTE')
     OR has_function_privilege(who,'public.nudge_rider_by_id(uuid,bigint,text)','EXECUTE')
     THEN RAISE EXCEPTION 'Unsafe privilege remained for %',who;
   END IF;
 END LOOP;
 IF NOT has_table_privilege('service_role','public.rider_notifications','SELECT')
   OR NOT has_table_privilege('service_role','public.rider_notifications','INSERT')
   OR NOT has_function_privilege('service_role','public.nudge_rider_by_id(uuid,bigint,text)','EXECUTE')
   OR NOT has_function_privilege('service_role','public.nudge_rider(uuid,text)','EXECUTE')
   THEN RAISE EXCEPTION 'Server-side service access was broken';
 END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='rider_notifications')<>0
   THEN RAISE EXCEPTION 'Permissive RLS policy still exists'; END IF;
END $verify$;

SET ROLE service_role;
SELECT public.nudge_rider_by_id('00000000-0000-4000-8000-000000000001'::uuid,7,'safe-test');
RESET ROLE;
DO $verify$ BEGIN
  IF (SELECT count(*) FROM public.rider_notifications)<>1 THEN
    RAISE EXCEPTION 'Service-side notification path is broken';
  END IF;
END $verify$;
