-- Run manually in the real project's SQL Editor after reviewing. Idempotent.
BEGIN;
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 endpoint text NOT NULL UNIQUE CHECK (length(endpoint)<=4096 AND endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/[^[:space:]]+$'),
 p256dh text NOT NULL CHECK (length(p256dh) BETWEEN 64 AND 128 AND p256dh ~ '^[A-Za-z0-9_=-]+$'),
 auth text NOT NULL CHECK (length(auth) BETWEEN 16 AND 128 AND auth ~ '^[A-Za-z0-9_=-]+$'),
 user_agent text CHECK (length(user_agent)<=512),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_shop_idx ON public.push_subscriptions(barbershop_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
DROP POLICY IF EXISTS push_own_read ON public.push_subscriptions;
CREATE POLICY push_own_read ON public.push_subscriptions FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND public.is_shop_member(barbershop_id));
DROP POLICY IF EXISTS push_own_insert ON public.push_subscriptions;
CREATE POLICY push_own_insert ON public.push_subscriptions FOR INSERT TO authenticated
 WITH CHECK (user_id=(SELECT auth.uid()) AND public.is_shop_member(barbershop_id));
DROP POLICY IF EXISTS push_own_delete ON public.push_subscriptions;
CREATE POLICY push_own_delete ON public.push_subscriptions FOR DELETE TO authenticated
 USING (user_id=(SELECT auth.uid()) AND public.is_shop_member(barbershop_id));

-- No booking/customer data or payloads stored here. Only the server can use it.
CREATE TABLE IF NOT EXISTS public.booking_push_deliveries (
 event_key text NOT NULL CHECK (event_key ~ '^[a-f0-9]{64}$'),
 subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
 locked_until timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz,
 attempts integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_key,subscription_id)
);
ALTER TABLE public.booking_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_push_deliveries FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.booking_push_deliveries TO service_role;
CREATE OR REPLACE FUNCTION public.claim_booking_push_delivery(p_event_key text,p_subscription_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE claimed boolean;
BEGIN
 INSERT INTO public.booking_push_deliveries(event_key,subscription_id,locked_until)
 VALUES(p_event_key,p_subscription_id,now()+interval '90 seconds')
 ON CONFLICT(event_key,subscription_id) DO UPDATE
 SET locked_until=now()+interval '90 seconds',attempts=booking_push_deliveries.attempts+1
 WHERE booking_push_deliveries.delivered_at IS NULL AND booking_push_deliveries.locked_until<=now()
   AND booking_push_deliveries.attempts<5
 RETURNING true INTO claimed;
 RETURN coalesce(claimed,false);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_booking_push_delivery(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_booking_push_delivery(text,uuid) TO service_role;

-- Existing SELECT RLS on bookings remains responsible for Realtime authorization.
-- Never add a public/anon bookings policy for notifications.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  CREATE PUBLICATION supabase_realtime;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='bookings') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
 END IF;
END $$;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
COMMIT;
