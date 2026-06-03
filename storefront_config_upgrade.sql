-- ==============================================================================
-- STOREFRONT CONFIGURATION UPGRADE
-- Run this in your Supabase SQL Editor to add the new merchant configuration
-- fields to the 'shops' table for Courier and Trust-Builder features.
-- ==============================================================================

-- 1. Add the configuration columns if they don't exist
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS allow_external_riders BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_look_for_rider BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cash_trust_enabled BOOLEAN DEFAULT false;

-- 2. Notify PostgREST to refresh its schema cache (crucial to avoid PGRST204 errors)
NOTIFY pgrst, 'reload schema';
