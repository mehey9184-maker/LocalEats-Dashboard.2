-- REVIEW DRAFT ONLY. Never apply automatically. No historical order updates.
BEGIN;
ALTER TABLE public.shops ADD COLUMN availability_override_until timestamptz;
ALTER TABLE public.shops ADD COLUMN availability_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.shops ADD CONSTRAINT shops_availability_revision_nonnegative CHECK (availability_revision >= 0);
ALTER TABLE public.shops ADD CONSTRAINT shops_availability_override_finite CHECK (availability_override_until IS NULL OR isfinite(availability_override_until));

CREATE FUNCTION public.shop_schedule_open(p_open text, p_close text, p_at timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog, public AS $$
 SELECT CASE WHEN p_open !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR p_close !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN false
 WHEN p_open = p_close THEN false
 WHEN p_open < p_close THEN to_char(p_at AT TIME ZONE 'Africa/Johannesburg','HH24:MI') >= p_open AND to_char(p_at AT TIME ZONE 'Africa/Johannesburg','HH24:MI') < p_close
 ELSE to_char(p_at AT TIME ZONE 'Africa/Johannesburg','HH24:MI') >= p_open OR to_char(p_at AT TIME ZONE 'Africa/Johannesburg','HH24:MI') < p_close END;
$$;
CREATE FUNCTION public.shop_effective_open(p_shop public.shops, p_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
 SELECT coalesce(p_shop.is_active,false) AND
 (coalesce(public.shop_schedule_open(p_shop.opening_time,p_shop.closing_time,p_at),false) OR coalesce(p_shop.availability_override_until > p_at,false));
$$;
CREATE FUNCTION public.shop_availability_revision_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.opening_time IS DISTINCT FROM OLD.opening_time OR NEW.closing_time IS DISTINCT FROM OLD.closing_time OR NEW.availability_override_until IS DISTINCT FROM OLD.availability_override_until THEN
  NEW.availability_revision := OLD.availability_revision + 1;
 ELSE NEW.availability_revision := OLD.availability_revision; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER shops_availability_revision BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.shop_availability_revision_guard();

CREATE VIEW public.shops_with_availability WITH (security_invoker = true) AS
 SELECT s.*, public.shop_effective_open(s,statement_timestamp()) AS effective_is_active FROM public.shops s;
REVOKE ALL ON public.shops_with_availability FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shops_with_availability TO service_role;

CREATE FUNCTION public.merchant_set_availability(p_uid text,p_shop_id text,p_open boolean,p_confirm_outside boolean,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE s public.shops; t timestamptz;
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'SERVER_AUTHORITY_REQUIRED'; END IF;
 IF p_uid IS NULL OR length(btrim(p_uid)) = 0 OR p_open IS NULL OR p_confirm_outside IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 SELECT * INTO s FROM public.shops WHERE id=p_shop_id FOR UPDATE;
 IF NOT FOUND OR s.owner_id IS DISTINCT FROM p_uid OR s.archived_at IS NOT NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF s.availability_revision <> p_expected_revision THEN RAISE EXCEPTION 'AVAILABILITY_CHANGED'; END IF;
 t := clock_timestamp();
 IF p_open AND s.approval_status IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'SHOP_UNAVAILABLE'; END IF;
 IF p_open AND NOT coalesce(public.shop_schedule_open(s.opening_time,s.closing_time,t),false) AND NOT p_confirm_outside THEN RAISE EXCEPTION 'OUTSIDE_HOURS_CONFIRMATION_REQUIRED'; END IF;
 UPDATE public.shops SET is_active=p_open, availability_override_until=CASE WHEN p_open AND NOT coalesce(public.shop_schedule_open(s.opening_time,s.closing_time,t),false) THEN t + interval '1 hour' ELSE NULL END WHERE id=s.id RETURNING * INTO s;
 RETURN to_jsonb(s) || jsonb_build_object('effective_is_active',public.shop_effective_open(s,clock_timestamp()));
END; $$;

-- Existing pickup RPC already locks this row FOR SHARE. This insert guard also
-- protects other collection writers and rechecks expiry immediately before insert.
CREATE FUNCTION public.pickup_shop_availability_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE s public.shops;
BEGIN
 IF NEW.delivery_type = 'collection' THEN
  SELECT * INTO s FROM public.shops WHERE id=NEW.shop_id FOR SHARE;
  IF NOT FOUND OR s.archived_at IS NOT NULL OR s.approval_status IS DISTINCT FROM 'approved' OR NOT public.shop_effective_open(s,clock_timestamp()) THEN RAISE EXCEPTION 'SHOP_UNAVAILABLE'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER pickup_shop_availability BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.pickup_shop_availability_guard();
REVOKE ALL ON FUNCTION public.shop_schedule_open(text,text,timestamptz),public.shop_effective_open(public.shops,timestamptz),public.shop_availability_revision_guard(),public.merchant_set_availability(text,text,boolean,boolean,bigint),public.pickup_shop_availability_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shop_schedule_open(text,text,timestamptz),public.shop_effective_open(public.shops,timestamptz),public.shop_availability_revision_guard(),public.merchant_set_availability(text,text,boolean,boolean,bigint),public.pickup_shop_availability_guard() TO service_role;
GRANT UPDATE(is_active,availability_override_until,availability_revision) ON public.shops TO service_role;
COMMIT;
