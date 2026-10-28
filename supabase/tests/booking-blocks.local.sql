-- APENAS POSTGRESQL LOCAL ISOLADO. NUNCA EXECUTAR EM SUPABASE REAL.
\set ON_ERROR_STOP on
DO $$
DECLARE d date := current_date+7; b uuid := '22222222-2222-2222-2222-222222222221'; s uuid := '11111111-1111-1111-1111-111111111111'; services uuid[] := ARRAY['33333333-3333-3333-3333-333333333331']::uuid[];
BEGIN
 UPDATE working_hours SET lunch_start='12:00', lunch_end='13:00' WHERE barber_id=b;
 IF EXISTS(SELECT 1 FROM get_availability(s,b,d,services) a WHERE a.start_time < (d+time '13:00') AT TIME ZONE 'America/Sao_Paulo' AND a.end_time > (d+time '12:00') AT TIME ZONE 'America/Sao_Paulo') THEN RAISE EXCEPTION 'Lunch exposed'; END IF;
 INSERT INTO time_off (barber_id,starts_at,ends_at) VALUES (b,(d+time '14:00') AT TIME ZONE 'America/Sao_Paulo',(d+time '16:00') AT TIME ZONE 'America/Sao_Paulo');
 IF EXISTS(SELECT 1 FROM get_availability(s,b,d,services) a WHERE a.start_time < (d+time '16:00') AT TIME ZONE 'America/Sao_Paulo' AND a.end_time > (d+time '14:00') AT TIME ZONE 'America/Sao_Paulo') THEN RAISE EXCEPTION 'Time off exposed'; END IF;
 UPDATE working_hours SET is_off=true WHERE barber_id=b;
 IF EXISTS(SELECT 1 FROM get_availability(s,b,d,services)) THEN RAISE EXCEPTION 'Day off exposed'; END IF;
 UPDATE working_hours SET is_off=false WHERE barber_id=b;
 INSERT INTO closed_days(barbershop_id,date) VALUES(s,d);
 IF EXISTS(SELECT 1 FROM get_availability(s,b,d,services)) THEN RAISE EXCEPTION 'Closure exposed'; END IF;
 IF has_table_privilege('anon','public.customers','SELECT') OR has_table_privilege('anon','public.bookings','INSERT') THEN RAISE EXCEPTION 'Private access exposed'; END IF;
 IF has_function_privilege('anon','public.process_verified_payment(text,uuid,numeric)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous payment approval exposed'; END IF;
END $$;
