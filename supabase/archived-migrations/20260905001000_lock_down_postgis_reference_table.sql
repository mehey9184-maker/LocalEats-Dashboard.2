begin;

-- public.spatial_ref_sys is owned and managed by the PostGIS extension.
-- Keep SELECT available for coordinate-system lookups, but browser-facing roles
-- do not need to mutate PostGIS reference definitions.
revoke insert, update, delete, truncate, references, trigger
  on table public.spatial_ref_sys
  from anon, authenticated;

commit;
