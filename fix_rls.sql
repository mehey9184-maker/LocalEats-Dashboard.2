DROP POLICY IF EXISTS "Riders can view unassigned live missions" ON orders;
CREATE POLICY "Riders can view unassigned live missions"
ON orders FOR SELECT
TO authenticated
USING (
  delivery_status = 'finding_rider' 
  AND (rider_id IS NULL OR rider_id::text = '' OR rider_id::text = 'null')
  AND (status = 'pending' OR status = 'accepted' OR status = 'preparing')
  AND (
    -- Case A: The shop allows external/public riders
    EXISTS (
      SELECT 1 FROM shops 
      WHERE shops.id = orders.shop_id 
      AND (shops.allow_external_riders = true OR shops.allow_external_riders IS NULL)
    )
    OR
    -- Case B: The rider is linked to the shop
    EXISTS (
      SELECT 1 FROM rider_connections 
      WHERE rider_connections.shop_id = orders.shop_id 
      AND rider_connections.rider_id::text = auth.uid()::text
    )
  )
);

-- Fix check constraint for delivery_status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_status_check;
-- Clean up any legacy data that would violate the constraint
UPDATE orders SET delivery_status = NULL WHERE delivery_status NOT IN ('finding_rider', 'accepted', 'picked_up', 'delivered', 'cancelled');
-- Add the constraint back
ALTER TABLE orders ADD CONSTRAINT orders_delivery_status_check 
CHECK (delivery_status IN ('finding_rider', 'accepted', 'picked_up', 'delivered', 'cancelled') OR delivery_status IS NULL);

DROP POLICY IF EXISTS "Riders can view missions assigned to them" ON orders;
CREATE POLICY "Riders can view missions assigned to them"
ON orders FOR SELECT
TO authenticated
USING (
  rider_id::text = auth.uid()::text
);

DROP POLICY IF EXISTS "Paired riders can view shop missions" ON orders;
CREATE POLICY "Paired riders can view shop missions"
ON orders FOR SELECT
TO authenticated
USING (
  shop_id IN (
    SELECT shop_id FROM rider_connections 
    WHERE rider_id::text = auth.uid()::text 
    AND expires_at > now()
  )
);
