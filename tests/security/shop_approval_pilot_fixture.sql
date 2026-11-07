-- SYNTHETIC DISPOSABLE POSTGRES 17 DATABASE ONLY.
-- Prepared against the exact Phase4G shop-approval SQL source, not Supabase Production.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create table public.shops (
 id text primary key,
 owner_id text not null,
 name text not null,
 approval_status text not null default 'pending',
 approval_reason text,
 is_active boolean not null default false,
 archived_at timestamptz
);
-- API uses service-role access. Browser roles do not have shop writes.
grant select,update on table public.shops to service_role;

insert into public.shops(id,owner_id,name,approval_status,is_active,archived_at)
values
('test-pending','merchant-a','Approved Later','pending',false,null),
('test-active','merchant-b','Suspended Later','approved',true,null),
('test-rejected','merchant-c','Reapply Later','rejected',false,null),
('test-archived','merchant-d','Archived Shop','pending',false,now()),
('test-still-pending','merchant-e','Pending Shop','pending',false,null);
