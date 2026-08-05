-- 1. Phone Number Cleanup and Constraints
-- Clean up existing phone numbers in profiles
UPDATE public.profiles
SET phone = '0' || right(regexp_replace(phone, '[^0-9]', '', 'g'), 9)
WHERE phone IS NOT NULL 
  AND phone !~ '^(?:\+27|0)[0-9]{9}$' 
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 9;

UPDATE public.profiles
SET phone = NULL
WHERE phone IS NOT NULL 
  AND phone !~ '^(?:\+27|0)[0-9]{9}$';

-- Clean up existing phone numbers in shops
UPDATE public.shops
SET phone = '0' || right(regexp_replace(phone, '[^0-9]', '', 'g'), 9)
WHERE phone IS NOT NULL 
  AND phone !~ '^(?:\+27|0)[0-9]{9}$' 
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 9;

UPDATE public.shops
SET phone = NULL
WHERE phone IS NOT NULL 
  AND phone !~ '^(?:\+27|0)[0-9]{9}$';

-- Apply the CHECK constraints
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_sa_phone;
ALTER TABLE public.profiles 
  ADD CONSTRAINT valid_sa_phone 
  CHECK (phone IS NULL OR phone ~ '^(?:\+27|0)[0-9]{9}$');

ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS valid_sa_phone;
ALTER TABLE public.shops 
  ADD CONSTRAINT valid_sa_phone 
  CHECK (phone IS NULL OR phone ~ '^(?:\+27|0)[0-9]{9}$');


-- 2. Order Total Price Enforcer Trigger
CREATE OR REPLACE FUNCTION public.enforce_order_total()
RETURNS TRIGGER AS $$
DECLARE
  calculated_items_total NUMERIC := 0;
  item JSONB;
  expected_total NUMERIC := 0;
BEGIN
  -- Sum up (price * quantity) for each item in the jsonb array
  IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items) = 'array' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
      IF jsonb_typeof(item) = 'object' THEN
        calculated_items_total := calculated_items_total + 
          (COALESCE((item->>'price')::numeric, 0) * COALESCE((item->>'quantity')::numeric, 1));
      END IF;
    END LOOP;
  END IF;

  -- Expected total = items total + delivery fee
  expected_total := calculated_items_total + COALESCE(NEW.delivery_fee, 0); 
  
  -- Raise an exception if it mismatches
  IF NEW.total_price IS DISTINCT FROM expected_total THEN
     RAISE EXCEPTION 'Pricing Integrity Error: Order total_price (%) does not match sum of items and fees (%)', NEW.total_price, expected_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_order_total ON public.orders;
CREATE TRIGGER trg_enforce_order_total
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_total();


-- 3. Strict RLS for menu_items (Merchant Privacy)
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Drop previous policies
DROP POLICY IF EXISTS "Allow all access for now" ON public.menu_items;
DROP POLICY IF EXISTS "Public Insert Menu" ON public.menu_items;
DROP POLICY IF EXISTS "Allow public insert access" ON public.menu_items;
DROP POLICY IF EXISTS "owner_can_read_own_menu" ON public.menu_items;
DROP POLICY IF EXISTS "owner_can_insert_own_menu" ON public.menu_items;
DROP POLICY IF EXISTS "owner_can_update_own_menu" ON public.menu_items;
DROP POLICY IF EXISTS "owner_can_delete_own_menu" ON public.menu_items;

-- Select
CREATE POLICY "owner_can_read_own_menu"
ON public.menu_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = menu_items.shop_id
      AND s.owner_id = auth.uid()
  )
);

-- Insert
CREATE POLICY "owner_can_insert_own_menu"
ON public.menu_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = menu_items.shop_id
      AND s.owner_id = auth.uid()
  )
);

-- Update
CREATE POLICY "owner_can_update_own_menu"
ON public.menu_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = menu_items.shop_id
      AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = menu_items.shop_id
      AND s.owner_id = auth.uid()
  )
);

-- Delete
CREATE POLICY "owner_can_delete_own_menu"
ON public.menu_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = menu_items.shop_id
      AND s.owner_id = auth.uid()
  )
);


-- 4. Secure public.spatial_ref_sys (GIS)
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated reads" ON public.spatial_ref_sys;
DROP POLICY IF EXISTS "Allow public read of spatial_ref_sys" ON public.spatial_ref_sys;

CREATE POLICY "Allow authenticated reads" 
ON public.spatial_ref_sys FOR SELECT TO authenticated 
USING (true);
