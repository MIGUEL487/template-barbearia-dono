BEGIN;
INSERT INTO auth.users(id) VALUES('88888888-8888-4888-8888-888888888888'),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') ON CONFLICT DO NOTHING;
SELECT set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
SET ROLE authenticated;
INSERT INTO public.raiox_notification_preferences(barbershop_id,user_id,morning,evening) VALUES('11111111-1111-1111-1111-111111111111',auth.uid(),true,false);
UPDATE public.raiox_notification_preferences SET evening=true WHERE user_id=auth.uid();
INSERT INTO public.raiox_settings(barbershop_id,low_occupancy_threshold) VALUES('11111111-1111-1111-1111-111111111111',.35) ON CONFLICT(barbershop_id) DO UPDATE SET low_occupancy_threshold=.35;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.raiox_notification_preferences WHERE morning AND evening) THEN RAISE EXCEPTION 'own preference missing';END IF;
 BEGIN INSERT INTO public.raiox_notification_preferences(barbershop_id,user_id) VALUES('11111111-1111-1111-1111-111111111111','88888888-8888-4888-8888-888888888888');RAISE EXCEPTION 'Foreign user accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN INSERT INTO public.raiox_job_runs(barbershop_id,date,kind,result) VALUES('11111111-1111-1111-1111-111111111111',current_date,'briefing','saved');RAISE EXCEPTION 'User forged scheduler log';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
SET ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.raiox_settings) OR EXISTS(SELECT 1 FROM public.raiox_notification_preferences) THEN RAISE EXCEPTION 'Tenant leakage';END IF;
 BEGIN INSERT INTO public.raiox_notification_preferences(barbershop_id,user_id) VALUES('11111111-1111-1111-1111-111111111111',auth.uid());RAISE EXCEPTION 'Nonmember accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN BEGIN PERFORM * FROM public.raiox_notification_preferences;RAISE EXCEPTION 'anon read allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;
INSERT INTO public.push_subscriptions(id,barbershop_id,user_id,endpoint,p256dh,auth) VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-1111-1111-111111111111','99999999-9999-4999-8999-999999999999','https://fcm.googleapis.com/test-raiox4',repeat('A',87),repeat('B',22));
SET ROLE service_role;
DO $$ DECLARE result boolean;BEGIN
 result:=public.claim_booking_push_delivery(repeat('a',64),'dddddddd-dddd-4ddd-8ddd-dddddddddddd');IF NOT result THEN RAISE EXCEPTION 'first delivery not claimed';END IF;
 IF public.claim_booking_push_delivery(repeat('a',64),'dddddddd-dddd-4ddd-8ddd-dddddddddddd') THEN RAISE EXCEPTION 'duplicate in lease';END IF;
 UPDATE public.booking_push_deliveries SET delivered_at=now(),locked_until=now()-interval '1 second';
 IF public.claim_booking_push_delivery(repeat('a',64),'dddddddd-dddd-4ddd-8ddd-dddddddddddd') THEN RAISE EXCEPTION 'delivered retried';END IF;
END $$;
RESET ROLE;
-- The local fixture service_role lacks production's BYPASSRLS; verify its grants,
-- then test uniqueness as the database owner without changing global roles.
DO $$ BEGIN
 IF NOT has_table_privilege('service_role','public.raiox_reports','INSERT') THEN RAISE EXCEPTION 'Worker grant missing';END IF;
 INSERT INTO public.raiox_reports(barbershop_id,date,kind,payload) VALUES('11111111-1111-1111-1111-111111111111','2099-12-31','briefing','{"version":4}') ON CONFLICT DO NOTHING;
 INSERT INTO public.raiox_reports(barbershop_id,date,kind,payload) VALUES('11111111-1111-1111-1111-111111111111','2099-12-31','briefing','{"version":4}') ON CONFLICT DO NOTHING;
 IF (SELECT count(*) FROM public.raiox_reports WHERE date='2099-12-31')<>1 THEN RAISE EXCEPTION 'duplicate report';END IF;
END $$;
RESET ROLE;
ROLLBACK;
