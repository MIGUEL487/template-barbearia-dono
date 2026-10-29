-- LOCAL ISOLATED PostgreSQL fixture ONLY. Never run this test in the real project.
\set ON_ERROR_STOP on
BEGIN;
UPDATE working_hours SET is_off=false,start_time='09:00',end_time='19:00',lunch_start='12:00',lunch_end='13:00'
 WHERE barber_id='22222222-2222-2222-2222-222222222221';
SET ROLE anon;
SELECT start_time,barber_id FROM get_group_availability('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222221',current_date+35,
 ARRAY['33333333-3333-3333-3333-333333333331','33333333-3333-3333-3333-333333333331']::uuid[]) LIMIT 1 \gset
SELECT create_group_booking_hold('11111111-1111-1111-1111-111111111111',:'barber_id',:'start_time',
 ARRAY['33333333-3333-3333-3333-333333333331','33333333-3333-3333-3333-333333333331']::uuid[],
 'Responsável fixture','11988887777',NULL,false) AS result \gset
RESET ROLE;
SELECT set_config('qa.group_booking_id',:'result'::jsonb->>'booking_id',true);
DO $$
DECLARE b bookings%rowtype; s services%rowtype; d date:=current_date+35; services_ids uuid[]:=ARRAY['33333333-3333-3333-3333-333333333331','33333333-3333-3333-3333-333333333331']::uuid[];
BEGIN
 SELECT * INTO b FROM bookings WHERE id=current_setting('qa.group_booking_id')::uuid;
 SELECT * INTO s FROM services WHERE id=services_ids[1];
 IF b.total_price<>2*s.price THEN RAISE EXCEPTION 'Group price incorrect';END IF;
 IF b.ends_at-b.starts_at<>make_interval(mins=>2*(s.duration_minutes+s.buffer_minutes)) THEN RAISE EXCEPTION 'Group duration incorrect';END IF;
 IF (SELECT count(*) FROM booking_items WHERE booking_id=b.id)<>2 THEN RAISE EXCEPTION 'Missing one item per person';END IF;
 IF b.status<>'hold' OR b.hold_expires_at<now()+interval '14 minutes' THEN RAISE EXCEPTION 'Hold/expiration incorrect';END IF;
 IF EXISTS(SELECT 1 FROM get_group_availability(b.barbershop_id,b.barber_id,d,services_ids) a WHERE a.start_time<b.ends_at AND a.end_time>b.starts_at) THEN RAISE EXCEPTION 'Group availability overlaps hold';END IF;
 IF EXISTS(SELECT 1 FROM get_availability(b.barbershop_id,b.barber_id,d,ARRAY[s.id]) a WHERE a.start_time<b.ends_at AND a.end_time>b.starts_at) THEN RAISE EXCEPTION 'Single availability overlaps group';END IF;
 IF EXISTS(SELECT 1 FROM get_group_availability(b.barbershop_id,b.barber_id,d,services_ids) a WHERE a.start_time<(d+time '13:00') AT TIME ZONE 'America/Sao_Paulo' AND a.end_time>(d+time '12:00') AT TIME ZONE 'America/Sao_Paulo') THEN RAISE EXCEPTION 'Group crosses lunch';END IF;
 UPDATE bookings SET hold_expires_at=now()-interval '1 minute' WHERE id=b.id;
 IF NOT EXISTS(SELECT 1 FROM get_group_availability(b.barbershop_id,b.barber_id,d,services_ids) a WHERE a.start_time=b.starts_at) THEN RAISE EXCEPTION 'Expired hold still blocks group';END IF;
 INSERT INTO time_off(barber_id,starts_at,ends_at) VALUES(b.barber_id,(d+time '14:00') AT TIME ZONE 'America/Sao_Paulo',(d+time '15:00') AT TIME ZONE 'America/Sao_Paulo');
 IF EXISTS(SELECT 1 FROM get_group_availability(b.barbershop_id,b.barber_id,d,services_ids) a WHERE a.start_time<(d+time '15:00') AT TIME ZONE 'America/Sao_Paulo' AND a.end_time>(d+time '14:00') AT TIME ZONE 'America/Sao_Paulo') THEN RAISE EXCEPTION 'Group crosses time off';END IF;
 UPDATE working_hours SET is_off=true WHERE barber_id=b.barber_id;
 IF EXISTS(SELECT 1 FROM get_group_availability(b.barbershop_id,b.barber_id,d,services_ids)) THEN RAISE EXCEPTION 'Group ignores day off';END IF;
 UPDATE working_hours SET is_off=false WHERE barber_id=b.barber_id;
 INSERT INTO closed_days(barbershop_id,date) VALUES(b.barbershop_id,d);
 IF EXISTS(SELECT 1 FROM get_group_availability(b.barbershop_id,b.barber_id,d,services_ids)) THEN RAISE EXCEPTION 'Group ignores closure';END IF;
 BEGIN PERFORM get_group_availability(b.barbershop_id,b.barber_id,d,array_fill(s.id,ARRAY[7]));RAISE EXCEPTION 'Quantity limit not enforced';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Quantidade de serviços inválida.' THEN RAISE;END IF;END;
 IF NOT has_function_privilege('anon','public.create_group_booking_hold(uuid,uuid,timestamptz,uuid[],text,text,text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Missing anon grant';END IF;
END $$;
SELECT 'Two-person hold, price, duration, items, collisions, lunch, quantity bounds and anon grant passed' AS result;
ROLLBACK;
