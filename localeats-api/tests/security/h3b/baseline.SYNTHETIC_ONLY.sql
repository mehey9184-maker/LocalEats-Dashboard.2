-- Pure synthetic PG17 fixtures; no customer or business records.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.shops(id text primary key, name text, owner_id text, approval_status text, approval_reason text, archived_at timestamptz, is_active boolean, availability_revision bigint, availability_override_until timestamptz, pickup_payment_methods text[]);
CREATE TABLE public.menu_items(id text primary key,shop_id text,name text,price numeric,is_available boolean);
CREATE TABLE public.reviews(id text primary key,shop_id text,order_id text,rating int,comment text);
CREATE TABLE public.announcements(id text primary key,shop_id text,is_active boolean,title text);
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY shops_select_public ON shops FOR SELECT TO PUBLIC USING(true);
CREATE POLICY menu_items_select_public ON menu_items FOR SELECT TO PUBLIC USING(true);
CREATE POLICY "Public read reviews" ON reviews FOR SELECT TO PUBLIC USING(true);
CREATE POLICY "Public read announcements" ON announcements FOR SELECT TO PUBLIC USING(true);
GRANT ALL ON shops,menu_items,reviews TO anon,authenticated,service_role;
GRANT ALL ON announcements TO service_role;
GRANT SELECT ON announcements TO anon,authenticated;
GRANT UPDATE(is_active,availability_revision,availability_override_until,pickup_payment_methods) ON shops TO authenticated;
CREATE VIEW shops_with_availability WITH (security_invoker=true) AS SELECT *,is_active AS effective_is_active FROM shops;
REVOKE ALL ON shops_with_availability FROM PUBLIC,anon,authenticated;
GRANT SELECT ON shops_with_availability TO service_role;
INSERT INTO shops(id,name,owner_id,approval_status,approval_reason,is_active) VALUES
 ('approved','Public shop','fake-owner','approved',null,false),('pending','Private draft','fake-owner2','pending','synthetic private reason',true),('archived','Old shop','fake-owner3','approved',null,false);
UPDATE shops SET archived_at=now() WHERE id='archived';
INSERT INTO menu_items VALUES ('item','approved','Meal',25,true),('draft','pending','Draft meal',30,true);
INSERT INTO reviews VALUES ('review','approved','synthetic-order',5,'test');
INSERT INTO announcements VALUES ('notice','approved',false,'unpublished');
SET ROLE anon;
SELECT owner_id,approval_reason FROM shops WHERE id='pending';
SELECT order_id FROM reviews;
RESET ROLE;
\echo H3B_LEGACY_RAW_READ_REPRODUCED
