\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
 id uuid PRIMARY KEY,
 email text NOT NULL,
 raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.profiles(
 user_id text PRIMARY KEY,
 "fullName" text,
 email text,
 phone text,
 role text NOT NULL DEFAULT 'customer',
 city text,
 country text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Reproduce currently observed insecure signup trigger in disposable PostgreSQL.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
 INSERT INTO public.profiles (user_id,"fullName",email,phone,role,city,country,updated_at)
 VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'fullName',split_part(NEW.email,'@',1)),
 NEW.email, COALESCE(NEW.raw_user_meta_data->>'phone',''), COALESCE(NEW.raw_user_meta_data->>'role','customer'),
 'Johannesburg','South Africa', NOW())
 ON CONFLICT (user_id) DO UPDATE SET email=EXCLUDED.email,
 "fullName"=COALESCE(public.profiles."fullName",EXCLUDED."fullName"),updated_at=NOW();
 RETURN NEW;
END;
$function$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
INSERT INTO auth.users (id,email,raw_user_meta_data)
VALUES ('550e8400-e29b-41d4-a716-100000000001','baseline@example.test','{"role":"admin","fullName":"Unsafe"}'::jsonb);
DO $check$
BEGIN
 IF (SELECT role FROM public.profiles WHERE user_id='550e8400-e29b-41d4-a716-100000000001')<>'admin' THEN
  RAISE EXCEPTION 'Fixture failed to reproduce user-controlled role bug';
 END IF;
END $check$;

-- Preserve a preexisting verified merchant record on signup conflict.
INSERT INTO public.profiles(user_id,"fullName",email,role) VALUES
('550e8400-e29b-41d4-a716-100000000003','Existing merchant','merchant@example.test','merchant');
