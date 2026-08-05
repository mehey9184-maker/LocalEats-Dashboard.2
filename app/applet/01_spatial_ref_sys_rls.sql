-- ==============================================================================
-- 01: PostGIS SPATIAL REF SYS RLS FIX
-- Copy and run this script in your Supabase SQL Editor as postgres / admin:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- Safely attempt enabling Row Level Security on public.spatial_ref_sys
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notice: ALTER TABLE spatial_ref_sys ENABLE RLS skipped: %', SQLERRM;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Allow public read access to spatial_ref_sys" ON public.spatial_ref_sys;
    CREATE POLICY "Allow public read access to spatial_ref_sys" 
    ON public.spatial_ref_sys FOR SELECT 
    TO anon, authenticated, service_role 
    USING (true);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notice: Policy creation on spatial_ref_sys skipped: %', SQLERRM;
  END;

  BEGIN
    GRANT SELECT ON public.spatial_ref_sys TO anon, authenticated, service_role;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

SELECT '01_spatial_ref_sys_rls.sql applied successfully: RLS block executed.' AS status;
