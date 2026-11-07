-- R3.4 SYNTHETIC_ONLY. Pure fake pickups, no real users or payments.
BEGIN;
CREATE SCHEMA r34_fixture;
CREATE FUNCTION r34_fixture.make_record(
  p_idempotency uuid,
  p_price numeric DEFAULT 25,
  p_total numeric DEFAULT 25,
  p_fee numeric DEFAULT 0,
  p_shop text DEFAULT 'my-kota-synthetic',
  p_lat numeric DEFAULT -26.0100,
  p_lng numeric DEFAULT 28.1900,
  p_method text DEFAULT 'cash'
) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog AS $fixture$
SELECT jsonb_build_object(
  'idempotency_key',p_idempotency::text,
  'shop_id',p_shop,
  'items',jsonb_build_array(jsonb_build_object(
    'menu_item_id','kota-synthetic-25',
    'name','Synthetic Kota',
    'quantity',1,
    'unit_price',25,
    'line_total',25)),
  'launch_location',jsonb_build_object('lat',p_lat,'lng',p_lng),
  'price',p_price,
  'total_price',p_total,
  'service_fee',p_fee,
  'delivery_fee',0,
  'payment_method',p_method,
  'customer_name','Fixture Customer',
  'phone','0000000000',
  'email','fixture.invalid@example.test',
  'address','Synthetic only',
  'city','Tembisa',
  'product_name','Synthetic Kota'
);
$fixture$;
INSERT INTO public.shops(
  id,owner_id,name,location,is_active,approval_status,
  lat,lng,latitude,longitude,opening_time,closing_time,
  availability_override_until)
VALUES
 ('my-kota-synthetic','synthetic-merchant','Synthetic My-Kota',
  'Ivory Park Tembisa',true,'approved',-26.0100,28.1900,
  -26.0100,28.1900,'00:00','23:59',statement_timestamp()+interval '1 day'),
 ('shop-closed-synthetic','synthetic-merchant','Closed Fake Shop',
  'Ivory Park Tembisa',false,'approved',-26.0100,28.1900,
  -26.0100,28.1900,'00:00','23:59',null),
 ('shop-pending-synthetic','synthetic-merchant','Unapproved Fake Shop',
  'Ivory Park Tembisa',true,'pending',-26.0100,28.1900,
  -26.0100,28.1900,'00:00','23:59',statement_timestamp()+interval '1 day');
INSERT INTO public.menu_items(id,shop_id,name,price,is_available)
VALUES ('kota-synthetic-25','my-kota-synthetic','Synthetic Kota',25,true);
INSERT INTO public.pickup_push_subscriptions(user_id,installation_id,fcm_token)
VALUES ('synthetic-customer','00000000-0000-4000-8000-000000008901'::uuid,
  'LOCAL_FAKE_FCM_TOKEN_DO_NOT_SEND');
COMMIT;
