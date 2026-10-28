-- ============================================================================
-- PAINEL DO DONO — PARIDADE ENTRE CÓDIGO E SCHEMA
--
-- Execute somente pelo fluxo de migrations do Supabase. Este arquivo não cria
-- dados, não toca em auth.users e pode ser aplicado mais de uma vez.
--
-- Diferenças encontradas ao comparar src/**/.from().select()/insert()/upsert()
-- com as migrations anteriores:
--   * services.category
--   * working_hours.lunch_start e working_hours.lunch_end
--   * payments.payment_method (alias de leitura para payments.method)
--   * políticas RLS para relações consultadas pelo painel
-- ============================================================================

-- O código autoriza também estes papéis, enquanto a migration inicial só
-- declarava owner e staff. ADD VALUE IF NOT EXISTS preserva os membros atuais.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'shop_member_role'
  ) THEN
    ALTER TYPE public.shop_member_role ADD VALUE IF NOT EXISTS 'admin';
    ALTER TYPE public.shop_member_role ADD VALUE IF NOT EXISTS 'barber';
    ALTER TYPE public.shop_member_role ADD VALUE IF NOT EXISTS 'receptionist';
  END IF;
END
$$;

-- Serviços criados no painel gravam e a lista administrativa lê category.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Cabelo';

-- A tela de equipe cria, atualiza e consulta o intervalo de almoço.
ALTER TABLE public.working_hours
  ADD COLUMN IF NOT EXISTS lunch_start TIME DEFAULT TIME '12:00';

ALTER TABLE public.working_hours
  ADD COLUMN IF NOT EXISTS lunch_end TIME DEFAULT TIME '13:00';

-- O registro de pagamentos continua canônico em method, usado pelas RPCs.
-- O painel financeiro consulta payment_method; a coluna gerada o mantém sempre
-- igual, inclusive para registros novos, sem duplicar nem migrar dados.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method
  GENERATED ALWAYS AS (method) STORED;

-- Mantém o helper SECURITY DEFINER já presente na migration inicial.
-- A função só devolve a associação do auth.uid() corrente.
CREATE OR REPLACE FUNCTION public.is_shop_member(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shop_members
    WHERE barbershop_id = p_shop_id
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_shop_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_shop_member(UUID) TO authenticated, service_role;

-- As quatro tabelas abaixo já têm RLS habilitado na schema inicial, mas não
-- receberam políticas. Sem elas, as consultas e mutações do painel falham.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'closed_days'
      AND policyname = 'panel_members_manage_closed_days'
  ) THEN
    CREATE POLICY panel_members_manage_closed_days ON public.closed_days
      FOR ALL TO authenticated
      USING (public.is_shop_member(barbershop_id))
      WITH CHECK (public.is_shop_member(barbershop_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'working_hours'
      AND policyname = 'panel_members_manage_working_hours'
  ) THEN
    CREATE POLICY panel_members_manage_working_hours ON public.working_hours
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.barbers b
          WHERE b.id = working_hours.barber_id
            AND public.is_shop_member(b.barbershop_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.barbers b
          WHERE b.id = working_hours.barber_id
            AND public.is_shop_member(b.barbershop_id)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'barber_services'
      AND policyname = 'panel_members_manage_barber_services'
  ) THEN
    CREATE POLICY panel_members_manage_barber_services ON public.barber_services
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.barbers b
          WHERE b.id = barber_services.barber_id
            AND public.is_shop_member(b.barbershop_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.barbers b
          WHERE b.id = barber_services.barber_id
            AND public.is_shop_member(b.barbershop_id)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'booking_items'
      AND policyname = 'panel_members_read_booking_items'
  ) THEN
    CREATE POLICY panel_members_read_booking_items ON public.booking_items
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = booking_items.booking_id
            AND public.is_shop_member(b.barbershop_id)
        )
      );
  END IF;
END
$$;
