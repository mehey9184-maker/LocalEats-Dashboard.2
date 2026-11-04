-- Disposable PostgreSQL test only. No Supabase URL or production credentials.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE TABLE public.rider_notifications (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 rider_id uuid, shop_id bigint, message text NOT NULL, type text DEFAULT 'nudge'
);
ALTER TABLE public.rider_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rider notifications access" ON public.rider_notifications
  FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
GRANT ALL PRIVILEGES ON public.rider_notifications TO PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.nudge_rider(rider_id uuid,message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$ BEGIN
  INSERT INTO public.rider_notifications (rider_id,shop_id,message,type)
  VALUES (rider_id,1,message,'nudge');
END $f$;

CREATE FUNCTION public.nudge_rider_by_id(target_rider_id uuid,target_shop_id bigint,nudge_message text DEFAULT 'New order')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$ BEGIN
  INSERT INTO public.rider_notifications (rider_id,shop_id,message,type)
  VALUES (target_rider_id,target_shop_id,nudge_message,'nudge');
END $f$;
GRANT EXECUTE ON FUNCTION public.nudge_rider(uuid,text) TO PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.nudge_rider_by_id(uuid,bigint,text) TO PUBLIC,anon,authenticated,service_role;

DO $verify$
BEGIN
 IF NOT has_table_privilege('anon','public.rider_notifications','SELECT')
   OR NOT has_table_privilege('authenticated','public.rider_notifications','INSERT')
   OR NOT has_function_privilege('anon','public.nudge_rider_by_id(uuid,bigint,text)','EXECUTE')
   THEN RAISE EXCEPTION 'Fixture failed to reproduce the unsafe starting privileges';
 END IF;
END $verify$;
