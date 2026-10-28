-- Proposta não aplicada. Permite a agenda ler bloqueios da própria barbearia.
-- A tabela time_off já tem RLS na migration inicial, mas faltava SELECT policy.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='time_off' AND policyname='panel_members_read_time_off') THEN
  CREATE POLICY panel_members_read_time_off ON public.time_off FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b WHERE b.id=time_off.barber_id AND public.is_shop_member(b.barbershop_id)));
 END IF;
END $$;
GRANT SELECT ON public.time_off TO authenticated;
