-- ISOLATED LOCAL FIXTURE ONLY. Run with psql -v ON_ERROR_STOP=1; all records rolled back.
BEGIN;
DO $$ DECLARE pct numeric;slot record;result jsonb;s uuid:='11111111-1111-1111-1111-111111111111';barber uuid:='22222222-2222-2222-2222-222222222221';svc uuid:='33333333-3333-3333-3333-333333333331';d date:=current_date+14;deposit numeric;original numeric; BEGIN
 IF extract(dow from d)=0 THEN d:=d+1;END IF;
 UPDATE public.services SET price=50,duration_minutes=30,buffer_minutes=5 WHERE id=svc;
 FOREACH pct IN ARRAY ARRAY[0,50,100,33.33] LOOP
 UPDATE public.site_settings SET deposit_percentage=pct WHERE barbershop_id=s;
 SELECT * INTO slot FROM public.get_availability(s,barber,d,ARRAY[svc]) ORDER BY start_time LIMIT 1;
 IF slot IS NULL THEN RAISE EXCEPTION 'Fixture has no slot';END IF;
 result:=public.create_booking_hold(s,barber,slot.start_time,ARRAY[svc],'Teste sinal local','11988880000',null,false);
 deposit:=(result->>'deposit_amount')::numeric;
 IF deposit<>round(50*pct/100,2) THEN RAISE EXCEPTION 'Deposit mismatch %: %',pct,deposit;END IF;
 IF ((result->>'hold_expires_at')::timestamptz-now())<>interval '15 minutes' THEN RAISE EXCEPTION 'Hold must be 15min';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.payments WHERE booking_id=(result->>'booking_id')::uuid AND status='pending' AND amount=deposit) THEN RAISE EXCEPTION 'Pending payment missing';END IF;
 UPDATE public.site_settings SET deposit_percentage=75 WHERE barbershop_id=s;
 SELECT deposit_amount INTO original FROM public.bookings WHERE id=(result->>'booking_id')::uuid;
 IF original<>deposit THEN RAISE EXCEPTION 'Existing snapshot changed';END IF;
 IF EXISTS(SELECT 1 FROM public.get_availability(s,barber,d,ARRAY[svc]) a WHERE a.start_time=slot.start_time) THEN RAISE EXCEPTION 'Held slot still available';END IF;
 UPDATE public.bookings SET status='cancelled' WHERE id=(result->>'booking_id')::uuid;
 END LOOP;
 UPDATE public.services SET price=19.99 WHERE id=svc;UPDATE public.site_settings SET deposit_percentage=25 WHERE barbershop_id=s;
 result:=public.create_group_booking_hold(s,barber,slot.start_time,ARRAY[svc,svc,svc],'Teste grupo local','11988880000',null,false);
 IF (result->>'total_price')::numeric<>59.97 OR (result->>'deposit_amount')::numeric<>14.99 THEN RAISE EXCEPTION 'Group money mismatch';END IF;
 IF (SELECT ends_at-starts_at FROM public.bookings WHERE id=(result->>'booking_id')::uuid)<>interval '105 minutes' THEN RAISE EXCEPTION 'Group buffers missing';END IF;
 UPDATE public.bookings SET hold_expires_at=now()-interval '1 second' WHERE id=(result->>'booking_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.get_availability(s,barber,d,ARRAY[svc]) a WHERE a.start_time=slot.start_time) THEN RAISE EXCEPTION 'Expired hold blocks availability';END IF;
 BEGIN UPDATE public.site_settings SET deposit_percentage=101 WHERE barbershop_id=s;RAISE EXCEPTION 'Invalid percentage accepted';EXCEPTION WHEN check_violation THEN NULL;END;
END $$;
-- Anonymous can join, but cannot read queue/goals or offer a booking.
SET ROLE anon;
SELECT public.join_waitlist('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222221',ARRAY['33333333-3333-3333-3333-333333333331']::uuid[],current_date+15,'09:00','19:00','Primeiro local','11911111111',null,'phone',true) AS first_id \gset
SELECT public.join_waitlist('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222221',ARRAY['33333333-3333-3333-3333-333333333331']::uuid[],current_date+15,'09:00','19:00','Segundo local','11922222222',null,'phone',true) AS second_id \gset
DO $$ BEGIN BEGIN PERFORM 1 FROM public.waitlist_entries;RAISE EXCEPTION 'Anonymous queue leaked';EXCEPTION WHEN insufficient_privilege THEN NULL;END;BEGIN PERFORM 1 FROM public.daily_goals;RAISE EXCEPTION 'Anonymous goal leaked';EXCEPTION WHEN insufficient_privilege THEN NULL;END; END $$;
RESET ROLE;
-- Make FIFO order explicit rather than relying on tied now() timestamps within a transaction.
UPDATE public.waitlist_entries SET created_at=now()-interval '2 minutes' WHERE id=:'first_id';
UPDATE public.waitlist_entries SET created_at=now()-interval '1 minute' WHERE id=:'second_id';
SELECT set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
SET ROLE authenticated;
INSERT INTO public.daily_goals VALUES('11111111-1111-1111-1111-111111111111',current_date,500,now()) ON CONFLICT(barbershop_id,date) DO UPDATE SET amount=500;
SELECT start_time FROM public.get_availability('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222221',current_date+15,ARRAY['33333333-3333-3333-3333-333333333331']::uuid[]) ORDER BY start_time LIMIT 1 \gset
-- The second request must not take the first request's slot.
SELECT set_config('saas.second',:'second_id',true),set_config('saas.first',:'first_id',true),set_config('saas.start',:'start_time',true);
DO $$ BEGIN BEGIN PERFORM public.offer_waitlist('11111111-1111-1111-1111-111111111111',current_setting('saas.second')::uuid,'22222222-2222-2222-2222-222222222221',current_setting('saas.start')::timestamptz);RAISE EXCEPTION 'FIFO bypass';EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Há uma solicitação anterior%' THEN RAISE;END IF;END;END $$;
SELECT public.offer_waitlist('11111111-1111-1111-1111-111111111111',:'first_id','22222222-2222-2222-2222-222222222221',:'start_time') AS result \gset
SELECT public.offer_waitlist('11111111-1111-1111-1111-111111111111',:'first_id','22222222-2222-2222-2222-222222222221',:'start_time')->>'already_offered' AS already \gset
SELECT set_config('saas.already',:'already',true);
DO $$ DECLARE allowed boolean;i int; BEGIN IF current_setting('saas.already')<>'true' THEN RAISE EXCEPTION 'Offer not idempotent';END IF;FOR i IN 1..5 LOOP allowed:=public.consume_raiox_ai_quota('11111111-1111-1111-1111-111111111111');IF NOT allowed THEN RAISE EXCEPTION 'Quota denied early';END IF;END LOOP;IF public.consume_raiox_ai_quota('11111111-1111-1111-1111-111111111111') THEN RAISE EXCEPTION 'Quota bypass';END IF;END $$;
RESET ROLE;
-- Another JWT must see no private records and cannot generate an offer or use quota.
SELECT set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',true);
SET ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.waitlist_entries) OR EXISTS(SELECT 1 FROM public.daily_goals) THEN RAISE EXCEPTION 'Tenant leak';END IF;BEGIN PERFORM public.consume_raiox_ai_quota('11111111-1111-1111-1111-111111111111');RAISE EXCEPTION 'Other tenant quota allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;BEGIN PERFORM public.offer_waitlist('11111111-1111-1111-1111-111111111111',current_setting('saas.first')::uuid,'22222222-2222-2222-2222-222222222221',current_setting('saas.start')::timestamptz);RAISE EXCEPTION 'Other tenant offer allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;
ROLLBACK;
