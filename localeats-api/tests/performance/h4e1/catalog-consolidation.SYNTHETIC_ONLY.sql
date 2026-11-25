\set ON_ERROR_STOP on
-- Disposable PostgreSQL only. NOT an active migration or a PostgREST integration.
DO $$ BEGIN IF current_database()<>'h4e1_lab' THEN RAISE EXCEPTION 'DISPOSABLE_DATABASE_REQUIRED'; END IF; END $$;
CREATE TEMP TABLE shops(id text PRIMARY KEY,approval_status text NOT NULL,archived_at timestamptz,is_active boolean,private_owner text);
CREATE TEMP TABLE menu_items(id text PRIMARY KEY,shop_id text NOT NULL REFERENCES shops(id),name text,price numeric,description text,image_url text,category text,is_available boolean,popularity_score integer,customizations jsonb,created_at timestamptz,private_note text);
CREATE INDEX ON menu_items(shop_id);
INSERT INTO shops VALUES ('a','approved',NULL,true,'private'),('b','approved',NULL,false,'private'),('c','approved',NULL,true,'private'),('d','approved',NULL,true,'private'),('pending','pending',NULL,true,'private'),('archived','approved',now(),true,'private'),('outside','approved',NULL,true,'private'),('large','approved',NULL,true,'private');
INSERT INTO menu_items SELECT s.id||'-'||i,s.id,'fixture',25,'description',NULL,'meal',i%2=0,0,'[]',now(),'PRIVATE_MARKER'
FROM shops s CROSS JOIN LATERAL generate_series(1,CASE WHEN s.id='large' THEN 501 WHEN s.id='c' THEN 0 ELSE 3 END) i;
ANALYZE shops; ANALYZE menu_items;
-- This function is a lab representation of the proposed single statement, not
-- a deployable RPC. The trusted API would validate IDs and supply pilot allowlist.
CREATE FUNCTION pg_temp.read_batch(ids text[],pilot text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE result jsonb;
BEGIN
 IF ids IS NULL OR cardinality(ids) NOT BETWEEN 1 AND 6 OR EXISTS(SELECT 1 FROM unnest(ids) x WHERE x IS NULL OR x !~ '^[A-Za-z0-9_-]{1,128}$') OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) THEN
  RETURN jsonb_build_object('success',false,'code','INVALID_MENU_BATCH');
 END IF;
 WITH allowed AS MATERIALIZED (
  SELECT s.id,r.ordinality FROM unnest(ids) WITH ORDINALITY r(id,ordinality)
  JOIN pg_temp.shops s ON s.id=r.id
  WHERE s.approval_status='approved' AND s.archived_at IS NULL AND (pilot IS NULL OR s.id=ANY(pilot))
 ), bounded AS MATERIALIZED (
  SELECT m.id,m.shop_id,m.name,m.price,m.description,m.image_url,m.category,m.is_available,m.popularity_score,m.customizations,m.created_at
  FROM pg_temp.menu_items m JOIN allowed a ON a.id=m.shop_id LIMIT 501
 ), grouped AS (
  SELECT a.id,a.ordinality,COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM bounded b WHERE b.shop_id=a.id),'[]'::jsonb) AS menu_items FROM allowed a
 )
 SELECT CASE WHEN (SELECT count(*) FROM bounded)>500 THEN jsonb_build_object('success',false,'code','MENU_BATCH_TOO_LARGE')
 ELSE jsonb_build_object('success',true,'menus',COALESCE((SELECT jsonb_agg(jsonb_build_object('shop_id',id,'menu_items',menu_items) ORDER BY ordinality) FROM grouped),'[]'::jsonb)) END INTO result;
 RETURN result;
END $$;
DO $$
DECLARE actual jsonb; expected jsonb; ids text[]:=ARRAY['a','b','c','d']; pilot text[]:=ARRAY['a','b','c','d','large'];
BEGIN
 -- Legacy two-read logical output normalized to stable item ordering for comparison.
 SELECT jsonb_build_object('success',true,'menus',jsonb_agg(jsonb_build_object('shop_id',s.id,'menu_items',COALESCE((SELECT jsonb_agg(to_jsonb(m) - 'private_note' ORDER BY m.id) FROM menu_items m WHERE m.shop_id=s.id),'[]'::jsonb)) ORDER BY r.ordinality))
 INTO expected FROM unnest(ids) WITH ORDINALITY r(id,ordinality) JOIN shops s ON s.id=r.id WHERE s.approval_status='approved' AND s.archived_at IS NULL AND s.id=ANY(pilot);
 actual:=pg_temp.read_batch(ids,pilot);
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'PARITY_FAILED'; END IF;
 IF actual::text LIKE '%PRIVATE_MARKER%' OR actual::text LIKE '%private_owner%' THEN RAISE EXCEPTION 'PRIVATE_FIELD_LEAK'; END IF;
 IF jsonb_array_length(actual->'menus')<>4 OR actual->'menus'->2->'menu_items'<>'[]'::jsonb OR actual->'menus'->1->>'shop_id'<>'b' THEN RAISE EXCEPTION 'EMPTY_OR_CLOSED_FAILED'; END IF;
 actual:=pg_temp.read_batch(ARRAY['a','pending','archived','outside','missing'],pilot);
 IF jsonb_array_length(actual->'menus')<>1 OR actual->'menus'->0->>'shop_id'<>'a' THEN RAISE EXCEPTION 'PUBLICATION_FAILED'; END IF;
 IF pg_temp.read_batch(ARRAY['a'],ARRAY[]::text[])->'menus'<>'[]'::jsonb THEN RAISE EXCEPTION 'EMPTY_PILOT_FAILED'; END IF;
 IF pg_temp.read_batch(ARRAY['a','a'],pilot)->>'code'<>'INVALID_MENU_BATCH' OR pg_temp.read_batch(ARRAY['bad!'],pilot)->>'code'<>'INVALID_MENU_BATCH' OR pg_temp.read_batch(ARRAY['a','b','c','d','large','missing','outside'],pilot)->>'code'<>'INVALID_MENU_BATCH' THEN RAISE EXCEPTION 'INPUT_BOUNDS_FAILED'; END IF;
 actual:=pg_temp.read_batch(ARRAY['large'],pilot);
 IF actual->>'code'<>'MENU_BATCH_TOO_LARGE' OR actual ? 'menus' THEN RAISE EXCEPTION 'TRUNCATION_FAILED'; END IF;
 DELETE FROM menu_items WHERE id='large-501';
 IF jsonb_array_length(pg_temp.read_batch(ARRAY['large'],pilot)->'menus'->0->'menu_items')<>500 THEN RAISE EXCEPTION 'LIMIT_500_FAILED'; END IF;
 UPDATE shops SET approval_status='pending' WHERE id='a';
 IF pg_temp.read_batch(ARRAY['a'],pilot)->'menus'<>'[]'::jsonb THEN RAISE EXCEPTION 'REVOKED_PUBLICATION_FAILED'; END IF;
 RAISE NOTICE 'H4E1_CATALOG_PARITY_PASS closed empty pending archived pilot missing private invalid oversized exactly500 revoked';
END $$;
\echo H4E1_CATALOG_REHEARSAL_PASS
