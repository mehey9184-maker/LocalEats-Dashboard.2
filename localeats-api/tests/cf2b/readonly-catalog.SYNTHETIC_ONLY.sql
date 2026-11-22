-- CF2-B / SYNTHETIC ONLY / NEVER APPLY TO SUPABASE OR PRODUCTION.
-- Disposable PG17 CI only. No remote DB connection or real user data.
-- Demonstrates a no-login, no-bypass, SELECT-column-scoped reader + RLS.
-- In a future real DB, computed availability must come from the exact
-- authoritative shop_effective_open function; this rehearsal uses a fixture
-- boolean ONLY to exercise permissions and the projection boundary.

CREATE ROLE cf2_catalog_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
CREATE SCHEMA cf2_fixture;
CREATE SCHEMA catalog_cf2;

CREATE TABLE cf2_fixture.shops (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  location text,
  category text,
  logo_url text,
  rating numeric(3,2),
  opening_time text,
  closing_time text,
  latitude numeric,
  longitude numeric,
  lat numeric,
  lng numeric,
  story text,
  approval_status text NOT NULL,
  archived_at timestamptz,
  is_active boolean NOT NULL,
  effective_is_active boolean NOT NULL,
  availability_revision bigint NOT NULL,
  availability_override_until timestamptz,
  owner_id text NOT NULL,
  private_notes text
);
CREATE TABLE cf2_fixture.menu_items (
  id text PRIMARY KEY,
  shop_id text NOT NULL REFERENCES cf2_fixture.shops(id),
  name text NOT NULL,
  price numeric(9,2) NOT NULL,
  description text,
  image_url text,
  category text,
  is_available boolean NOT NULL,
  popularity_score numeric,
  customizations jsonb,
  created_at timestamptz,
  cost_price numeric,
  private_notes text
);

INSERT INTO cf2_fixture.shops (
 id,name,approval_status,archived_at,is_active,effective_is_active,
 availability_revision,lat,lng,owner_id,private_notes
) VALUES
 ('stg-test-shop-open','STAGING TEST Open Kota','approved',NULL,true,true,0,-25.98,28.2,'synthetic-owner','private'),
 ('stg-test-shop-far','STAGING TEST Far Kota','approved',NULL,true,true,0,-26.06,28.2,'synthetic-owner','private'),
 ('stg-test-shop-closed','STAGING TEST Closed Kota','approved',NULL,false,false,0,-25.98,28.2,'synthetic-owner','private'),
 ('stg-test-shop-pending','STAGING TEST Pending Kota','pending',NULL,true,false,0,-25.98,28.2,'synthetic-owner','private'),
 ('stg-test-shop-archived','STAGING TEST Archived Kota','approved',now(),true,false,0,-25.98,28.2,'synthetic-owner','private');
INSERT INTO cf2_fixture.menu_items (id,shop_id,name,price,is_available,cost_price,private_notes) VALUES
 ('stg-test-item-kota-open','stg-test-shop-open','STAGING TEST Kota',25.00,true,5.00,'private'),
 ('stg-test-item-drink-open','stg-test-shop-open','STAGING TEST Drink',10.00,true,3.00,'private'),
 ('stg-test-item-kota-closed','stg-test-shop-closed','STAGING TEST Closed Kota',25.00,true,5.00,'private'),
 ('stg-test-item-hidden','stg-test-shop-pending','STAGING TEST Pending Item',25.00,true,5.00,'private');

ALTER TABLE cf2_fixture.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE cf2_fixture.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY cf2_shop_read ON cf2_fixture.shops
  FOR SELECT TO cf2_catalog_reader
  USING (approval_status='approved' AND archived_at IS NULL);
CREATE POLICY cf2_menu_read ON cf2_fixture.menu_items
  FOR SELECT TO cf2_catalog_reader
  USING (EXISTS (
    SELECT 1 FROM cf2_fixture.shops s
    WHERE s.id=shop_id AND s.approval_status='approved' AND s.archived_at IS NULL
  ));

CREATE VIEW catalog_cf2.public_shops
WITH (security_invoker=true, security_barrier=true) AS
SELECT approval_status, archived_at, effective_is_active,
 availability_revision,availability_override_until,id,name,description,
 location,category,logo_url,rating,opening_time,closing_time,is_active,
 latitude,longitude,lat,lng,story
FROM cf2_fixture.shops WHERE approval_status='approved' AND archived_at IS NULL;
CREATE VIEW catalog_cf2.public_menu
WITH (security_invoker=true, security_barrier=true) AS
SELECT id,shop_id,name,price,description,image_url,category,is_available,
 popularity_score,customizations,created_at
FROM cf2_fixture.menu_items;

GRANT USAGE ON SCHEMA cf2_fixture,catalog_cf2 TO cf2_catalog_reader;
GRANT SELECT (
  approval_status,archived_at,effective_is_active,availability_revision,
  availability_override_until,id,name,description,location,category,logo_url,
  rating,opening_time,closing_time,is_active,latitude,longitude,lat,lng,story
) ON cf2_fixture.shops TO cf2_catalog_reader;
GRANT SELECT (
  id,shop_id,name,price,description,image_url,category,is_available,
  popularity_score,customizations,created_at
) ON cf2_fixture.menu_items TO cf2_catalog_reader;
GRANT SELECT ON catalog_cf2.public_shops,catalog_cf2.public_menu TO cf2_catalog_reader;

-- Privilege assertions under the privileged disposable test harness.
DO $$
BEGIN
 IF (SELECT rolcanlogin OR rolbypassrls OR rolcreaterole OR rolsuper FROM pg_roles WHERE rolname='cf2_catalog_reader') THEN
   RAISE EXCEPTION 'CF2_ROLE_PRIVILEGES_TOO_BROAD';
 END IF;
 IF has_table_privilege('cf2_catalog_reader','cf2_fixture.shops','INSERT') OR
    has_table_privilege('cf2_catalog_reader','cf2_fixture.shops','UPDATE') OR
    has_table_privilege('cf2_catalog_reader','cf2_fixture.shops','DELETE') OR
    has_table_privilege('cf2_catalog_reader','cf2_fixture.menu_items','INSERT') OR
    has_table_privilege('cf2_catalog_reader','cf2_fixture.menu_items','UPDATE') OR
    has_table_privilege('cf2_catalog_reader','cf2_fixture.menu_items','DELETE') THEN
   RAISE EXCEPTION 'CF2_WRITE_GRANT_PRESENT';
 END IF;
 IF has_column_privilege('cf2_catalog_reader','cf2_fixture.shops','owner_id','SELECT') OR
    has_column_privilege('cf2_catalog_reader','cf2_fixture.shops','private_notes','SELECT') OR
    has_column_privilege('cf2_catalog_reader','cf2_fixture.menu_items','cost_price','SELECT') OR
    has_column_privilege('cf2_catalog_reader','cf2_fixture.menu_items','private_notes','SELECT') THEN
   RAISE EXCEPTION 'CF2_PRIVATE_COLUMN_GRANT_PRESENT';
 END IF;
END $$;

-- Only this synthetic role can access these projections.
SET ROLE cf2_catalog_reader;
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM catalog_cf2.public_shops;
  IF n <> 3 THEN RAISE EXCEPTION 'CF2_PUBLIC_SHOPS_EXPECTED_3_GOT_%',n; END IF;
  SELECT count(*) INTO n FROM catalog_cf2.public_shops WHERE id='stg-test-shop-pending';
  IF n <> 0 THEN RAISE EXCEPTION 'CF2_PENDING_LEAK'; END IF;
  SELECT count(*) INTO n FROM catalog_cf2.public_shops WHERE id='stg-test-shop-archived';
  IF n <> 0 THEN RAISE EXCEPTION 'CF2_ARCHIVED_LEAK'; END IF;
  SELECT count(*) INTO n FROM catalog_cf2.public_menu;
  IF n <> 3 THEN RAISE EXCEPTION 'CF2_PUBLIC_MENU_EXPECTED_3_GOT_%',n; END IF;
  SELECT count(*) INTO n FROM catalog_cf2.public_menu WHERE shop_id='stg-test-shop-pending';
  IF n <> 0 THEN RAISE EXCEPTION 'CF2_PENDING_MENU_LEAK'; END IF;
  SELECT count(*) INTO n FROM catalog_cf2.public_menu WHERE shop_id='stg-test-shop-closed' AND price=25;
  IF n <> 1 THEN RAISE EXCEPTION 'CF2_CLOSED_SHOP_MENU_NOT_BROWSABLE'; END IF;
END $$;
RESET ROLE;

SELECT 'CF2B_SYNTHETIC_POSTGRES_ROLE_AND_RLS_PASS' AS result;
