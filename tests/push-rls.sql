-- LOCAL fixture from push-rls-fixture.sql + migration; do not run in production.
SET ROLE authenticated;
SET request.jwt.claim.sub='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
INSERT INTO public.push_subscriptions(barbershop_id,user_id,endpoint,p256dh,auth)
VALUES('11111111-1111-1111-1111-111111111111',auth.uid(),'https://fcm.googleapis.com/fcm/send/member-a',repeat('A',87),repeat('B',22));
DO $$ BEGIN
 IF (SELECT count(*) FROM public.push_subscriptions)<>1 THEN RAISE EXCEPTION 'own subscription not readable'; END IF;
 BEGIN
  INSERT INTO public.push_subscriptions(barbershop_id,user_id,endpoint,p256dh,auth) VALUES('11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','https://fcm.googleapis.com/fcm/send/impersonation',repeat('A',87),repeat('B',22));
  RAISE EXCEPTION 'impersonation allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.push_subscriptions SET auth=repeat('X',22);RAISE EXCEPTION 'update allowed';EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.claim_booking_push_delivery(repeat('a',64),gen_random_uuid());RAISE EXCEPTION 'client claim allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SET request.jwt.claim.sub='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.push_subscriptions) THEN RAISE EXCEPTION 'other user subscription leaked'; END IF;
 DELETE FROM public.push_subscriptions;IF FOUND THEN RAISE EXCEPTION 'other user deleted subscription';END IF;
END $$;
SET request.jwt.claim.sub='cccccccc-cccc-cccc-cccc-cccccccccccc';
DO $$ BEGIN
 BEGIN
  INSERT INTO public.push_subscriptions(barbershop_id,user_id,endpoint,p256dh,auth) VALUES('11111111-1111-1111-1111-111111111111',auth.uid(),'https://fcm.googleapis.com/fcm/send/nonmember',repeat('A',87),repeat('B',22));
  RAISE EXCEPTION 'nonmember insert allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
DELETE FROM public.shop_members WHERE user_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET ROLE authenticated;
SET request.jwt.claim.sub='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.push_subscriptions) THEN RAISE EXCEPTION 'ex-member access allowed'; END IF; END $$;
SET ROLE anon;
DO $$ BEGIN BEGIN PERFORM * FROM public.push_subscriptions;RAISE EXCEPTION 'anon read allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END; END $$;
RESET ROLE;
DO $$ DECLARE subscription uuid; BEGIN
 SELECT id INTO subscription FROM public.push_subscriptions LIMIT 1;
 IF NOT public.claim_booking_push_delivery(repeat('a',64),subscription) THEN RAISE EXCEPTION 'first claim denied';END IF;
 IF public.claim_booking_push_delivery(repeat('a',64),subscription) THEN RAISE EXCEPTION 'concurrent duplicate claimed';END IF;
 UPDATE public.booking_push_deliveries SET locked_until=now()-interval '1 second';
 IF NOT public.claim_booking_push_delivery(repeat('a',64),subscription) THEN RAISE EXCEPTION 'retry denied';END IF;
 UPDATE public.booking_push_deliveries SET delivered_at=now(),locked_until=now()-interval '1 second';
 IF public.claim_booking_push_delivery(repeat('a',64),subscription) THEN RAISE EXCEPTION 'delivered event claimed again';END IF;
END $$;
SELECT 'RLS isolation, member revocation, client privilege restrictions and delivery claims passed' AS result;
