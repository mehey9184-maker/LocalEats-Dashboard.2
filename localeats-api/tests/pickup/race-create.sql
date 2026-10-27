begin;
set local role service_role;
select public.pickup_create_order('customer',repeat('e',64),jsonb_build_object('shop_id','shop','idempotency_key','550e8400-e29b-41d4-a716-000000000050','items',jsonb_build_array(jsonb_build_object('menu_item_id','item','name','Fixture meal','unit_price',25,'quantity',1,'line_total',25)),'product_name','Fixture meal','price',25,'service_fee',2.5,'total_price',27.5,'payment_method','cash','customer_name','Synthetic customer','phone','+27712345678','email','','address','','city','','launch_location',jsonb_build_object('lat',-26,'lng',28)));
select pg_sleep(0.3);
commit;
