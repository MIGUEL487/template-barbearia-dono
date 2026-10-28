-- APENAS POSTGRESQL LOCAL ISOLADO. NUNCA EXECUTAR EM SUPABASE REAL.
\set ON_ERROR_STOP on
INSERT INTO auth.users VALUES ('99999999-9999-4999-8999-999999999999');
INSERT INTO public.shop_members (barbershop_id,user_id) VALUES ('11111111-1111-1111-1111-111111111111','99999999-9999-4999-8999-999999999999');
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
SET ROLE anon;
SELECT start_time, barber_id FROM get_availability('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222221',current_date+7,ARRAY['33333333-3333-3333-3333-333333333331']::uuid[]) LIMIT 1 \gset
SELECT create_booking_hold('11111111-1111-1111-1111-111111111111', :'barber_id', :'start_time', ARRAY['33333333-3333-3333-3333-333333333331']::uuid[], 'Fixture local','11999999999',NULL,false) AS result \gset
RESET ROLE;
SELECT (:'result'::jsonb->>'booking_id') AS booking_id \gset
SET ROLE service_role;
SELECT process_verified_payment('123456', :'booking_id', 30);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false);
SET ROLE authenticated;
SELECT id,status FROM public.bookings WHERE id=:'booking_id' AND barbershop_id='11111111-1111-1111-1111-111111111111';
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.bookings WHERE status='confirmed') THEN RAISE EXCEPTION 'Owner cannot see confirmed booking'; END IF; END $$;
RESET ROLE;
