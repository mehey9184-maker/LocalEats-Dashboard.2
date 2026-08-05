-- Add the updated_at column to the shops table to resolve the telemetry warning
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
