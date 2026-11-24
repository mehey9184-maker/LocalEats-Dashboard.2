-- H4A synthetic query-shape lab ONLY. Not a migration or full hosted schema.
-- Index definitions are the relevant subset of read-only hosted catalog metadata.
CREATE TABLE menu_items(id text PRIMARY KEY,shop_id text NOT NULL,name text,price numeric,is_available boolean);
CREATE TABLE orders(id uuid PRIMARY KEY,shop_id text,user_id text,delivery_type text,status text,rider_id uuid,created_at timestamptz,idempotency_key text UNIQUE,items jsonb);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_shop_created_at ON orders(shop_id,created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_rider_id ON orders(rider_id);
CREATE INDEX orders_shop_id_idx ON orders(shop_id);
CREATE TABLE pickup_order_events(id uuid PRIMARY KEY,order_id uuid,recipient_uid text,kind text,occurred_at timestamptz);
CREATE INDEX pickup_ready_inbox ON pickup_order_events(recipient_uid,occurred_at DESC,id DESC) WHERE kind='ready';
\echo H4A_SCALE_2500
\set n 2500
\set menus 400
\ir seed.SYNTHETIC_ONLY.sql
\ir plans.SYNTHETIC_ONLY.sql
\echo H4A_SCALE_25000
\set n 25000
\set menus 10000
\ir seed.SYNTHETIC_ONLY.sql
\ir plans.SYNTHETIC_ONLY.sql
