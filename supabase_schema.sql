-- Payments table to store subscription and other payment information
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL, -- 'OTT', '1Voucher', 'Admin Code'
  transaction_id TEXT, -- The voucher PIN or reference
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create policies for payments
-- Allow shop owners to view their own payments
CREATE POLICY "Shop owners can view their own payments"
ON payments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = payments.shop_id
    AND shops.owner_id = auth.uid()
  )
);

-- Allow shop owners to insert their own payments
CREATE POLICY "Shop owners can record their own payments"
ON payments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = payments.shop_id
    AND shops.owner_id = auth.uid()
  )
);
