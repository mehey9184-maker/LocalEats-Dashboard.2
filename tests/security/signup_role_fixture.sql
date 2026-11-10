-- Synthetic isolated PostgreSQL only. Never run against Production.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
 id uuid PRIMARY KEY,
 email text NOT NULL,
 raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.profiles (
 user_id text PRIMARY KEY,
 "fullName" text,
 email text,
 phone text,
 role text NOT NULL DEFAULT 'customer',
 city text,
 country text,
 updated_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
    INSERT INTO public.profiles (
        user_id,
        "fullName",
        email,
        phone,
        role,
        city,
        country,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'fullName',
            split_part(NEW.email, '@', 1)
        ),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
        'Johannesburg',
        'South Africa',
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        "fullName" = COALESCE(public.profiles."fullName", EXCLUDED."fullName"),
        updated_at = NOW();
    RETURN NEW;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated, service_role;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Explicitly demonstrate the pre-patch vulnerability in synthetic data.
INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES (
 '11111111-1111-4111-8111-111111111111','pre@example.invalid',
 '{"full_name":"Before","role":"admin"}'
);
DO $before$
BEGIN
 IF (SELECT role FROM public.profiles WHERE user_id='11111111-1111-4111-8111-111111111111') <> 'admin'
 THEN RAISE EXCEPTION 'SYNTHETIC_UNSAFE_BASELINE_NOT_REPRODUCED'; END IF;
END $before$;
