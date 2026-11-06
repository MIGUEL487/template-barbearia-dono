-- Auto Stilo Raio-X 4.0. Manual upgrade after SaaS 2/3 and booking-push.
-- Review and execute manually. Requires SaaS 2/3 and booking-push migrations.
BEGIN;
CREATE TABLE IF NOT EXISTS public.raiox_notification_preferences (
 barbershop_id uuid NOT NULL REFERENCES public.barbershops(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 morning boolean NOT NULL DEFAULT false,
 evening boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(barbershop_id,user_id)
);
ALTER TABLE public.raiox_notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.raiox_notification_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.raiox_notification_preferences TO authenticated;
GRANT ALL ON public.raiox_notification_preferences TO service_role;
DROP POLICY IF EXISTS raiox_preferences_own ON public.raiox_notification_preferences;
CREATE POLICY raiox_preferences_own ON public.raiox_notification_preferences TO authenticated
 USING(user_id=(SELECT auth.uid()) AND public.saas_can_manage(barbershop_id))
 WITH CHECK(user_id=(SELECT auth.uid()) AND public.saas_can_manage(barbershop_id));
CREATE TABLE IF NOT EXISTS public.raiox_settings (
 barbershop_id uuid PRIMARY KEY REFERENCES public.barbershops(id),
 low_occupancy_threshold numeric NOT NULL DEFAULT 0.4 CHECK(low_occupancy_threshold BETWEEN 0 AND 1)
);
ALTER TABLE public.raiox_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.raiox_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.raiox_settings TO authenticated;
GRANT ALL ON public.raiox_settings TO service_role;
DROP POLICY IF EXISTS raiox_settings_manage ON public.raiox_settings;
CREATE POLICY raiox_settings_manage ON public.raiox_settings TO authenticated
 USING(public.saas_can_manage(barbershop_id)) WITH CHECK(public.saas_can_manage(barbershop_id));
-- Immutable historical snapshots; existing reports, messages, bookings and quotas retained.
GRANT SELECT,INSERT ON public.raiox_reports TO service_role;
-- Explicit least-privilege read contract for the scheduled server client.
GRANT SELECT ON public.barbershops,public.bookings,public.booking_items,public.barbers,
 public.services,public.working_hours,public.time_off,public.closed_days,
 public.financial_transactions,public.daily_goals TO service_role;
GRANT EXECUTE ON FUNCTION public.get_availability(uuid,uuid,date,uuid[]) TO service_role;
CREATE TABLE IF NOT EXISTS public.raiox_job_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 barbershop_id uuid NOT NULL REFERENCES public.barbershops(id),
 date date NOT NULL,kind text NOT NULL CHECK(kind IN('briefing','closing')),
 result text NOT NULL CHECK(result IN('saved','push_accepted','failed')),
 error_code text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS raiox_job_runs_shop_date ON public.raiox_job_runs(barbershop_id,date,created_at DESC);
ALTER TABLE public.raiox_job_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.raiox_job_runs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.raiox_job_runs TO authenticated;
GRANT ALL ON public.raiox_job_runs TO service_role;
DROP POLICY IF EXISTS raiox_job_read ON public.raiox_job_runs;
CREATE POLICY raiox_job_read ON public.raiox_job_runs FOR SELECT TO authenticated USING(public.saas_can_manage(barbershop_id));
COMMIT;
