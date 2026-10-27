-- SYNTHETIC LOCAL FIXTURE ONLY. Not a production schema dump.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon,authenticated,service_role;
create table public.shops(id text primary key,owner_id text,name text,is_active boolean,approval_status text,
  archived_at timestamptz,latitude double precision,longitude double precision,lat double precision,lng double precision);
create table public.menu_items(id text primary key,shop_id text references public.shops(id),name text,price numeric,is_available boolean);
create table public.rider_profiles(id uuid primary key);
create table public.orders(id uuid primary key default gen_random_uuid(),shop_id text references public.shops(id),
  user_id text,rider_id uuid references public.rider_profiles(id),product_name text,product_variant text,
  total_price numeric not null default 0,price numeric,status text default 'pending',delivery_status text default 'pending',
  payment_method text default 'cash_on_delivery',customer_name text,phone text,email text,address text,city text,notes text,
  lat numeric,lng numeric,merchant_rating numeric,acceptance_message text,created_at timestamptz default now(),updated_at timestamptz default now(),
  delivery_fee numeric default 0,service_fee numeric default 0,discount_amount numeric default 0,tip_amount numeric default 0,
  idempotency_key text,items jsonb);
-- Deliberately standalone index, not a UNIQUE constraint: both supported.
create unique index orders_key on public.orders(idempotency_key);
alter table public.orders enable row level security;
-- Deliberately permissive historical policy to prove trigger write guard is effective.
create policy legacy_browser on public.orders to authenticated using (true) with check (true);
grant select,insert,update,delete on public.orders to authenticated,service_role;
grant select on public.shops,public.menu_items to service_role;
grant update(id) on public.shops,public.menu_items to service_role; -- SELECT FOR SHARE needs an update privilege.
insert into public.shops values('shop','merchant','Fixture shop',true,'approved',null,-26.0,28.0,-26.0,28.0);
insert into public.menu_items values('item','shop','Fixture meal',25,true);
insert into public.rider_profiles values('550e8400-e29b-41d4-a716-000000000099');
insert into public.orders(id,shop_id,user_id,status,delivery_status,rider_id) values
 ('550e8400-e29b-41d4-a716-000000000090','shop','historical',null,null,null),
 ('550e8400-e29b-41d4-a716-000000000091','shop','historical','cancelled','none',null),
 ('550e8400-e29b-41d4-a716-000000000092','shop','historical','delivered','delivered','550e8400-e29b-41d4-a716-000000000099'),
 ('550e8400-e29b-41d4-a716-000000000093','shop','historical','ready_for_pickup','rider_assigned','550e8400-e29b-41d4-a716-000000000099');
