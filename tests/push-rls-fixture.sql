-- LOCAL EMPTY TEST DATABASE ONLY, never run this fixture in Supabase production.
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
CREATE TABLE public.barbershops(id uuid PRIMARY KEY);
CREATE TABLE public.shop_members(barbershop_id uuid,user_id uuid);
CREATE TABLE public.bookings(id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION public.is_shop_member(p_shop_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.shop_members WHERE barbershop_id=p_shop_id AND user_id=auth.uid()) $$;
INSERT INTO auth.users VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),('cccccccc-cccc-cccc-cccc-cccccccccccc');
INSERT INTO public.barbershops VALUES('11111111-1111-1111-1111-111111111111');
INSERT INTO public.shop_members VALUES('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),('11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
