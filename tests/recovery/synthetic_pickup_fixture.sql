-- Synthetic-only rehearsal data: NEVER point this at a Supabase project.
-- GitHub Action uses an isolated PostgreSQL container with no production credentials.
CREATE ROLE authenticated NOLOGIN;

CREATE TABLE public.shops (
  id bigint PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  shop_id bigint NOT NULL REFERENCES public.shops(id),
  customer_id uuid NOT NULL,
  idempotency_key uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','preparing','ready_for_pickup','collected','cancelled')),
  total_minor integer NOT NULL CHECK (total_minor >= 0),
  arrival_minute integer NOT NULL CHECK (arrival_minute BETWEEN 0 AND 14),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_shop_created ON public.orders(shop_id,created_at DESC);

CREATE TABLE public.pickup_order_events (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id),
  command_id uuid NOT NULL,
  revision integer NOT NULL,
  kind text NOT NULL,
  UNIQUE(order_id,command_id),
  UNIQUE(order_id,revision)
);

CREATE TABLE public.pickup_push_outbox (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL UNIQUE REFERENCES public.pickup_order_events(id),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  state text NOT NULL DEFAULT 'pending'
);

CREATE FUNCTION public.prevent_order_idempotency_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key THEN
    RAISE EXCEPTION 'An order idempotency key cannot be changed';
  END IF;
  RETURN NEW;
END
$function$;
CREATE TRIGGER order_idempotency_immutable
BEFORE UPDATE OF idempotency_key ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.prevent_order_idempotency_mutation();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_authenticated_no_cross_shop_access ON public.orders
  FOR SELECT TO authenticated USING (false);
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;

INSERT INTO public.shops(id,name)
  SELECT i, 'Synthetic shop ' || lpad(i::text,2,'0')
  FROM generate_series(1,20) AS i;
INSERT INTO public.orders(id,shop_id,customer_id,idempotency_key,status,total_minor,arrival_minute)
  SELECT
    md5('synthetic-order-'||i)::uuid,
    ((i-1)%20)+1,
    md5('synthetic-user-'||((i-1)%5000))::uuid,
    md5('synthetic-intent-'||i)::uuid,
    'pending',
    2500 * (1+((i-1)%3)),
    (i-1)/10
  FROM generate_series(1,150) AS i;
INSERT INTO public.pickup_order_events(id,order_id,command_id,revision,kind)
  SELECT
    md5('synthetic-event-'||i)::uuid,
    md5('synthetic-order-'||i)::uuid,
    md5('synthetic-command-'||i)::uuid,
    0,
    'placed'
  FROM generate_series(1,150) AS i;
INSERT INTO public.pickup_push_outbox(id,event_id,order_id)
  SELECT
    md5('synthetic-push-'||i)::uuid,
    md5('synthetic-event-'||i)::uuid,
    md5('synthetic-order-'||i)::uuid
  FROM generate_series(1,150) AS i;
