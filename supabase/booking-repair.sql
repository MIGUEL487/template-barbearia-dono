-- CORREÇÃO CONSOLIDADA DE AGENDAMENTO — NÃO EXECUTADA
-- Pré-requisito: schema inicial 20261021000000_initial_schema.sql aplicado.
-- Não executar seeds de exemplo em produção. Não cria contas ou vínculos.
-- Idempotente; mantém dados existentes. Revisar antes de executar no SQL Editor.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
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

CREATE OR REPLACE FUNCTION expire_stale_holds()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE bookings
  SET status = 'expired', updated_at = now()
  WHERE status = 'hold'
    AND hold_expires_at IS NOT NULL
    AND hold_expires_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
CREATE OR REPLACE FUNCTION get_availability(
  p_barbershop_id UUID,
  p_barber_id UUID,
  p_date DATE,
  p_service_ids UUID[]
)
RETURNS TABLE (
  barber_id UUID,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  v_total_duration INTEGER;
  v_day_of_week INTEGER;
  v_barber RECORD;
  v_wh RECORD;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
  v_lunch_start TIMESTAMPTZ;
  v_lunch_end TIMESTAMPTZ;
  v_tz TEXT;
BEGIN
  -- Limpar holds vencidos na própria consulta
  PERFORM expire_stale_holds();

  SELECT bs.timezone INTO v_tz FROM barbershops bs WHERE bs.id = p_barbershop_id;
  IF v_tz IS NULL THEN
    v_tz := 'America/Sao_Paulo';
  END IF;

  -- Calcular duração total dos serviços solicitados
  SELECT COALESCE(SUM(s.duration_minutes + s.buffer_minutes), 30)
  INTO v_total_duration
  FROM services s
  WHERE s.id = ANY(p_service_ids) AND s.barbershop_id = p_barbershop_id AND s.is_active = true;

  IF v_total_duration IS NULL OR v_total_duration <= 0 THEN
    v_total_duration := 30;
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- Se a barbearia estiver fechada nesta data, retorna vazio
  IF EXISTS (SELECT 1 FROM closed_days cd WHERE cd.barbershop_id = p_barbershop_id AND cd.date = p_date) THEN
    RETURN;
  END IF;

  -- Loop pelos barbeiros selecionados (ou todos ativos da barbearia)
  FOR v_barber IN
    SELECT b.id FROM barbers b
    WHERE b.barbershop_id = p_barbershop_id
      AND b.is_active = true
      AND (p_barber_id IS NULL OR b.id = p_barber_id)
  LOOP
    -- Buscar expediente do barbeiro no dia da semana
    SELECT wh.* INTO v_wh FROM working_hours wh
    WHERE wh.barber_id = v_barber.id
      AND wh.day_of_week = v_day_of_week;

    IF FOUND THEN
      -- Se for dia de folga do barbeiro, pula
      IF v_wh.is_off THEN
        CONTINUE;
      END IF;

      v_slot_start := (p_date + v_wh.start_time) AT TIME ZONE v_tz;
      v_day_end    := (p_date + v_wh.end_time) AT TIME ZONE v_tz;

      IF v_wh.lunch_start IS NOT NULL AND v_wh.lunch_end IS NOT NULL THEN
        v_lunch_start := (p_date + v_wh.lunch_start) AT TIME ZONE v_tz;
        v_lunch_end   := (p_date + v_wh.lunch_end) AT TIME ZONE v_tz;
      ELSE
        v_lunch_start := NULL;
        v_lunch_end   := NULL;
      END IF;

    ELSE
      CONTINUE; -- Sem expediente cadastrado: não inventar horário de atendimento.
    END IF;

    -- Gerar slots de 30 em 30 minutos
    WHILE (v_slot_start + (v_total_duration || ' minutes')::INTERVAL) <= v_day_end LOOP
      v_slot_end := v_slot_start + (v_total_duration || ' minutes')::INTERVAL;

      -- Verificar que não está no passado
      IF v_slot_start > now() THEN

        -- Pular horários que colidem com o horário de almoço
        IF v_lunch_start IS NOT NULL AND v_lunch_end IS NOT NULL 
           AND (v_slot_start < v_lunch_end AND v_slot_end > v_lunch_start) THEN
          v_slot_start := v_slot_start + INTERVAL '30 minutes';
          CONTINUE;
        END IF;

        -- Verificar que não colide com folga/férias
        IF NOT EXISTS (
          SELECT 1 FROM time_off tof
          WHERE tof.barber_id = v_barber.id
            AND tof.starts_at < v_slot_end
            AND tof.ends_at > v_slot_start
        )
        -- Verificar que não colide com agendamentos existentes (hold ou confirmed)
        AND NOT EXISTS (
          SELECT 1 FROM bookings bk
          WHERE bk.barber_id = v_barber.id
            AND bk.status IN ('hold', 'confirmed')
            AND bk.starts_at < v_slot_end
            AND bk.ends_at > v_slot_start
        ) THEN
          barber_id := v_barber.id;
          start_time := v_slot_start;
          end_time := v_slot_end;
          RETURN NEXT;
        END IF;

      END IF;

      v_slot_start := v_slot_start + INTERVAL '30 minutes';
    END LOOP;

  END LOOP;
END;
$$;
CREATE OR REPLACE FUNCTION create_booking_hold(
  p_barbershop_id UUID,
  p_barber_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_service_ids UUID[],
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT,
  p_marketing_consent BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_barber_id UUID := p_barber_id;
  v_total_duration INTEGER := 0;
  v_total_price NUMERIC(10, 2) := 0;
  v_ends_at TIMESTAMPTZ;
  v_customer_id UUID;
  v_booking_id UUID;
  v_deposit_pct NUMERIC(5, 2);
  v_deposit_amount NUMERIC(10, 2);
  v_raw_token TEXT;
  v_token_hash TEXT;
  v_hold_expires TIMESTAMPTZ;
  v_service RECORD;
  v_tz TEXT;
BEGIN
  -- 1. Expirar holds vencidos imediatamente antes da tentativa
  PERFORM expire_stale_holds();

  SELECT COALESCE(timezone, 'America/Sao_Paulo') INTO v_tz
  FROM barbershops WHERE id = p_barbershop_id;

  -- 2. Calcular preço e duração dos serviços
  SELECT COALESCE(SUM(duration_minutes + buffer_minutes), 0), COALESCE(SUM(price), 0)
  INTO v_total_duration, v_total_price
  FROM services
  WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id AND is_active = true;

  IF v_total_duration = 0 THEN
    RAISE EXCEPTION 'Nenhum serviço ativo selecionado.';
  END IF;

  IF p_service_ids IS NULL OR cardinality(p_service_ids) = 0 OR cardinality(p_service_ids) > 100
     OR (SELECT count(*) FROM services WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id AND is_active) <> cardinality(p_service_ids) THEN
    RAISE EXCEPTION 'Seleção de serviços inválida.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM get_availability(p_barbershop_id, p_barber_id, (p_starts_at AT TIME ZONE v_tz)::date, p_service_ids) a WHERE a.start_time = p_starts_at) THEN
    RAISE EXCEPTION 'Horário indisponível ou reservado.';
  END IF;
  -- 3. Tratamento de "Sem Preferência" de Barbeiro: alocar primeiro barbeiro disponível
  IF v_barber_id IS NULL THEN
    SELECT barber_id INTO v_barber_id
    FROM get_availability(p_barbershop_id, NULL, (p_starts_at AT TIME ZONE v_tz)::date, p_service_ids)
    WHERE start_time = p_starts_at
    LIMIT 1;

    IF v_barber_id IS NULL THEN
      RAISE EXCEPTION 'Nenhum profissional disponível para o horário selecionado.';
    END IF;
  END IF;

  v_ends_at := p_starts_at + (v_total_duration || ' minutes')::INTERVAL;
  v_hold_expires := now() + INTERVAL '15 minutes';

  -- 4. Percentual de sinal
  SELECT COALESCE(deposit_percentage, 50.00) INTO v_deposit_pct
  FROM site_settings WHERE barbershop_id = p_barbershop_id;

  v_deposit_amount := ROUND((v_total_price * (COALESCE(v_deposit_pct, 50.00) / 100.0)), 2);

  -- 5. Upsert de cliente
  INSERT INTO customers (barbershop_id, name, phone, email)
  VALUES (p_barbershop_id, p_customer_name, p_customer_phone, COALESCE(p_customer_email, ''))
  ON CONFLICT (barbershop_id, phone)
  DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = now()
  RETURNING id INTO v_customer_id;

  -- 6. Consentimento LGPD
  IF p_marketing_consent THEN
    INSERT INTO consents (barbershop_id, customer_id, channel, consent_given, legal_text, source)
    VALUES (p_barbershop_id, v_customer_id, 'whatsapp', true, 'Aceito receber lembretes e novidades da barbearia', 'checkout');
  END IF;

  -- 7. Token de gestão do agendamento (SHA-256)
  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

  -- 8. Inserir em estado HOLD (protegido pela constraint exclude_overlapping_bookings)
  BEGIN
    INSERT INTO bookings (
      barbershop_id, barber_id, customer_id,
      starts_at, ends_at, total_price, deposit_amount,
      status, hold_expires_at,
      cancellation_token_hash, cancellation_token_expires_at
    ) VALUES (
      p_barbershop_id, v_barber_id, v_customer_id,
      p_starts_at, v_ends_at, v_total_price, v_deposit_amount,
      'hold', v_hold_expires,
      v_token_hash, v_ends_at + INTERVAL '7 days'
    ) RETURNING id INTO v_booking_id;
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION 'Este horário acabou de ser reservado por outro cliente. Por favor, escolha outro horário.';
  END;

  -- 9. Inserir itens
  FOR v_service IN
    SELECT id, name, price, duration_minutes FROM services
    WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id
  LOOP
    INSERT INTO booking_items (booking_id, service_id, service_name, price, duration_minutes)
    VALUES (v_booking_id, v_service.id, v_service.name, v_service.price, v_service.duration_minutes);
  END LOOP;

  -- Registro esperado pelo webhook verificado; não representa pagamento aprovado.
  INSERT INTO payments (barbershop_id, booking_id, amount, method, status)
  VALUES (p_barbershop_id, v_booking_id, v_deposit_amount, 'pix', 'pending');

  RETURN jsonb_build_object(
    'booking_id', v_booking_id,
    'barber_id', v_barber_id,
    'hold_expires_at', v_hold_expires,
    'total_price', v_total_price,
    'deposit_amount', v_deposit_amount,
    'cancellation_token', v_raw_token
  );
END;
$$;
CREATE OR REPLACE FUNCTION get_booking_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token_hash TEXT;
  v_booking RECORD;
  v_services JSONB;
BEGIN
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT
    b.id, b.status, b.starts_at, b.ends_at, b.total_price, b.deposit_amount,
    barber.name AS barber_name,
    cust.name AS customer_name,
    s.cancellation_notice_hours
  INTO v_booking
  FROM bookings b
  JOIN barbers barber ON barber.id = b.barber_id
  JOIN customers cust ON cust.id = b.customer_id
  JOIN site_settings s ON s.barbershop_id = b.barbershop_id
  WHERE b.cancellation_token_hash = v_token_hash
    AND (b.cancellation_token_expires_at IS NULL OR b.cancellation_token_expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado ou link expirado.';
  END IF;

  SELECT jsonb_agg(service_name) INTO v_services
  FROM booking_items WHERE booking_id = v_booking.id;

  RETURN jsonb_build_object(
    'id', v_booking.id,
    'status', v_booking.status,
    'starts_at', v_booking.starts_at,
    'ends_at', v_booking.ends_at,
    'barber_name', v_booking.barber_name,
    'customer_name', v_booking.customer_name,
    'services', COALESCE(v_services, '[]'::jsonb),
    'total_price', v_booking.total_price,
    'deposit_amount', v_booking.deposit_amount,
    'can_cancel', (v_booking.status = 'confirmed' AND v_booking.starts_at > (now() + (v_booking.cancellation_notice_hours || ' hours')::INTERVAL)),
    'can_reschedule', (v_booking.status = 'confirmed' AND v_booking.starts_at > (now() + (v_booking.cancellation_notice_hours || ' hours')::INTERVAL))
  );
END;
$$;
CREATE OR REPLACE FUNCTION cancel_booking_by_token(p_token TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token_hash TEXT;
  v_booking_id UUID;
  v_starts_at TIMESTAMPTZ;
  v_notice_hours INTEGER;
  v_shop_id UUID;
BEGIN
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT b.id, b.starts_at, b.barbershop_id, s.cancellation_notice_hours
  INTO v_booking_id, v_starts_at, v_shop_id, v_notice_hours
  FROM bookings b
  JOIN site_settings s ON s.barbershop_id = b.barbershop_id
  WHERE b.cancellation_token_hash = v_token_hash
    AND b.status = 'confirmed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento confirmado não localizado ou token inválido.';
  END IF;

  IF v_starts_at <= (now() + (v_notice_hours || ' hours')::INTERVAL) THEN
    RAISE EXCEPTION 'Cancelamento fora do prazo permitido de % horas de antecedência.', v_notice_hours;
  END IF;

  UPDATE bookings
  SET status = 'cancelled', notes = COALESCE(notes || ' | Cancelado: ' || p_reason, p_reason), updated_at = now()
  WHERE id = v_booking_id;

  RETURN jsonb_build_object('success', true, 'message', 'Agendamento cancelado com sucesso.');
END;
$$;
CREATE OR REPLACE FUNCTION reschedule_booking_by_token(
  p_token TEXT,
  p_new_starts_at TIMESTAMPTZ,
  p_new_barber_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token_hash TEXT;
  v_booking RECORD;
  v_total_duration INTEGER;
  v_new_ends_at TIMESTAMPTZ;
  v_target_barber_id UUID;
BEGIN
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT b.id, b.barbershop_id, b.barber_id, b.starts_at, b.status, s.cancellation_notice_hours
  INTO v_booking
  FROM bookings b
  JOIN site_settings s ON s.barbershop_id = b.barbershop_id
  WHERE b.cancellation_token_hash = v_token_hash
    AND (b.cancellation_token_expires_at IS NULL OR b.cancellation_token_expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado ou token expirado.';
  END IF;

  IF v_booking.status NOT IN ('confirmed', 'hold') THEN
    RAISE EXCEPTION 'Apenas agendamentos ativos podem ser reagendados (status atual: %).', v_booking.status;
  END IF;

  -- Checagem de antecedência mínima para reagendamento
  IF v_booking.starts_at <= (now() + (v_booking.cancellation_notice_hours || ' hours')::INTERVAL) THEN
    RAISE EXCEPTION 'Reagendamento fora do prazo permitido de % horas de antecedência.', v_booking.cancellation_notice_hours;
  END IF;

  -- Duração total baseada nos itens do booking original
  SELECT COALESCE(SUM(duration_minutes), 30) INTO v_total_duration
  FROM booking_items WHERE booking_id = v_booking.id;

  v_new_ends_at := p_new_starts_at + (v_total_duration || ' minutes')::INTERVAL;
  v_target_barber_id := COALESCE(p_new_barber_id, v_booking.barber_id);

  -- Atualização atômica respeitando a constraint exclude_overlapping_bookings
  BEGIN
    UPDATE bookings
    SET
      barber_id = v_target_barber_id,
      starts_at = p_new_starts_at,
      ends_at = v_new_ends_at,
      updated_at = now()
    WHERE id = v_booking.id;
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION 'O novo horário selecionado já está ocupado por outro atendimento.';
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Agendamento reagendado com sucesso.',
    'new_starts_at', p_new_starts_at,
    'new_ends_at', v_new_ends_at
  );
END;
$$;
CREATE OR REPLACE VIEW public_barbers AS
  SELECT id, barbershop_id, name, bio, avatar_url
  FROM barbers
  WHERE is_active = true;

CREATE OR REPLACE VIEW public_services AS
  SELECT id, barbershop_id, name, description, duration_minutes, price
  FROM services
  WHERE is_active = true;

CREATE OR REPLACE VIEW public_site_settings AS
  SELECT
    barbershop_id, brand_name, brand_tagline, accent_color,
    hero_title, hero_subtitle, hero_image_url, deposit_percentage,
    instagram_url, maps_embed_url, about_history, about_location, about_payment_methods
  FROM site_settings;

CREATE OR REPLACE VIEW public_faq_items AS
  SELECT id, barbershop_id, question, answer, sort_order
  FROM faq_items
  WHERE is_active = true;

CREATE OR REPLACE VIEW public_gallery_items AS
  SELECT id, barbershop_id, image_url, title, sort_order
  FROM gallery_items
  WHERE is_active = true;

CREATE OR REPLACE VIEW public_reviews AS
  SELECT id, barbershop_id, customer_name, rating, comment, created_at
  FROM reviews
  WHERE is_approved = true;


GRANT SELECT ON public.public_barbers TO anon, authenticated;
GRANT SELECT ON public.public_services TO anon, authenticated;
GRANT SELECT ON public.public_site_settings TO anon, authenticated;
GRANT SELECT ON public.public_faq_items TO anon, authenticated;
GRANT SELECT ON public.public_gallery_items TO anon, authenticated;
GRANT SELECT ON public.public_reviews TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_availability(uuid,uuid,date,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_availability(uuid,uuid,date,uuid[]) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.create_booking_hold(uuid,uuid,timestamptz,uuid[],text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(uuid,uuid,timestamptz,uuid[],text,text,text,boolean) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_booking_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_booking_by_token(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_booking_by_token(text,text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.reschedule_booking_by_token(text,timestamptz,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_booking_by_token(text,timestamptz,uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_stale_holds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_holds() TO service_role;
REVOKE ALL ON public.customers, public.bookings, public.booking_items, public.payments, public.shop_members, public.financial_transactions FROM anon;
-- PROPOSTA: NÃO APLICADA. Requer autorização e validação em banco demo dedicado.
-- Executada apenas pelo webhook server-side após conferir assinatura e API oficial.
CREATE OR REPLACE FUNCTION public.process_verified_payment(p_payment_id text,p_booking_id uuid,p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b public.bookings%ROWTYPE; p public.payments%ROWTYPE;
BEGIN
 IF p_payment_id !~ '^[0-9]+$' OR p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Pagamento inválido'; END IF;
 -- Serializa também eventos concorrentes que apontam para a mesma reserva.
 SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reserva inexistente'; END IF;
 -- Cada lançamento do checkout deve ter um payment explícito. Não inventar amount.
 SELECT * INTO p FROM public.payments WHERE booking_id=b.id AND barbershop_id=b.barbershop_id ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR p.amount <> p_amount THEN RAISE EXCEPTION 'Valor divergente'; END IF;
 IF p.status='approved' THEN
  IF p.external_payment_id=p_payment_id THEN RETURN jsonb_build_object('duplicate',true); END IF;
  RAISE EXCEPTION 'Reserva já liquidada por outro pagamento';
 END IF;
 IF b.status NOT IN ('hold','confirmed') THEN RAISE EXCEPTION 'Reserva não pode ser confirmada'; END IF;
 IF b.status='hold' AND b.hold_expires_at IS NOT NULL AND b.hold_expires_at<=now() THEN RAISE EXCEPTION 'Hold expirado: requer conciliação manual'; END IF;
 INSERT INTO public.payment_events(event_key,event_type,payload) VALUES('mp_approved_'||p_payment_id,'payment.approved',jsonb_build_object('booking_id',b.id,'processed_at',now()));
 UPDATE public.bookings SET status='confirmed',updated_at=now() WHERE id=b.id;
 UPDATE public.payments SET status='approved',external_payment_id=p_payment_id,updated_at=now() WHERE id=p.id;
 INSERT INTO public.financial_transactions(barbershop_id,booking_id,payment_id,type,amount,description) VALUES(b.barbershop_id,b.id,p.id,'income',p_amount,'Mercado Pago verificado');
 RETURN jsonb_build_object('processed',true);
END $$;
REVOKE ALL ON FUNCTION public.process_verified_payment(text,uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_verified_payment(text,uuid,numeric) TO service_role;

CREATE OR REPLACE FUNCTION admin_create_booking(
  p_barbershop_id UUID,
  p_barber_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_service_ids UUID[],
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT DEFAULT NULL,
  p_payment_method payment_method DEFAULT 'in_person',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_total_duration INTEGER := 0;
  v_total_price NUMERIC(10, 2) := 0;
  v_ends_at TIMESTAMPTZ;
  v_customer_id UUID;
  v_booking_id UUID;
  v_service RECORD;
BEGIN
  IF NOT is_shop_member(p_barbershop_id) THEN
    RAISE EXCEPTION 'Acesso negado: você não é membro desta barbearia.';
  END IF;

  SELECT COALESCE(SUM(duration_minutes), 0), COALESCE(SUM(price), 0)
  INTO v_total_duration, v_total_price
  FROM services
  WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id;

  IF v_total_duration = 0 THEN
    RAISE EXCEPTION 'Nenhum serviço válido informado.';
  END IF;

  v_ends_at := p_starts_at + (v_total_duration || ' minutes')::INTERVAL;

  -- Upsert do cliente
  INSERT INTO customers (barbershop_id, name, phone, email, notes)
  VALUES (p_barbershop_id, p_customer_name, p_customer_phone, COALESCE(p_customer_email, ''), p_notes)
  ON CONFLICT (barbershop_id, phone)
  DO UPDATE SET
    name = EXCLUDED.name,
    email = CASE WHEN EXCLUDED.email <> '' THEN EXCLUDED.email ELSE customers.email END,
    updated_at = now()
  RETURNING id INTO v_customer_id;

  -- Criar reserva já confirmada
  BEGIN
    INSERT INTO bookings (
      barbershop_id, barber_id, customer_id,
      starts_at, ends_at, total_price, deposit_amount,
      status, notes
    ) VALUES (
      p_barbershop_id, p_barber_id, v_customer_id,
      p_starts_at, v_ends_at, v_total_price, 0,
      'confirmed', p_notes
    ) RETURNING id INTO v_booking_id;
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION 'Horário indisponível: conflito com outro atendimento do profissional.';
  END;

  -- Itens
  FOR v_service IN
    SELECT id, name, price, duration_minutes FROM services
    WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id
  LOOP
    INSERT INTO booking_items (booking_id, service_id, service_name, price, duration_minutes)
    VALUES (v_booking_id, v_service.id, v_service.name, v_service.price, v_service.duration_minutes);
  END LOOP;

  -- Registro de pagamento inicial presencial pendente
  INSERT INTO payments (barbershop_id, booking_id, amount, method, status)
  VALUES (p_barbershop_id, v_booking_id, v_total_price, p_payment_method, 'pending');

  -- Auditoria
  INSERT INTO audit_log (barbershop_id, user_id, action, entity_type, entity_id, changes)
  VALUES (
    p_barbershop_id, v_user_id, 'CREATE_BOOKING_MANUAL', 'bookings', v_booking_id::text,
    jsonb_build_object('customer', p_customer_name, 'total', v_total_price, 'starts_at', p_starts_at)
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'starts_at', p_starts_at,
    'ends_at', v_ends_at,
    'total_price', v_total_price
  );
END;
$$;
REVOKE ALL ON FUNCTION admin_create_booking FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_create_booking TO authenticated;
CREATE OR REPLACE FUNCTION admin_complete_booking(
  p_barbershop_id UUID,
  p_booking_id UUID,
  p_payment_received BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_payment RECORD;
BEGIN
  IF NOT is_shop_member(p_barbershop_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id AND barbershop_id = p_barbershop_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado.';
  END IF;

  -- Atualiza booking para completed
  UPDATE bookings SET status = 'completed', updated_at = now() WHERE id = p_booking_id;

  -- Se o pagamento estiver pendente e foi recebido no balcão:
  IF p_payment_received THEN
    UPDATE payments
    SET status = 'approved', updated_at = now()
    WHERE booking_id = p_booking_id AND status = 'pending';

    -- Registrar transação de receita no livro caixa (Receita Real)
    INSERT INTO financial_transactions (barbershop_id, booking_id, type, amount, description)
    VALUES (p_barbershop_id, p_booking_id, 'income', v_booking.total_price, 'Atendimento concluído - ' || v_booking.id::text);
  END IF;

  INSERT INTO audit_log (barbershop_id, user_id, action, entity_type, entity_id, changes)
  VALUES (p_barbershop_id, auth.uid(), 'COMPLETE_BOOKING', 'bookings', p_booking_id::text, jsonb_build_object('paid', p_payment_received));

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION admin_complete_booking FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_complete_booking TO authenticated;
CREATE OR REPLACE FUNCTION admin_cancel_booking(
  p_barbershop_id UUID,
  p_booking_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_shop_member(p_barbershop_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE bookings
  SET status = 'cancelled', notes = COALESCE(notes || ' | ' || p_reason, p_reason), updated_at = now()
  WHERE id = p_booking_id AND barbershop_id = p_barbershop_id;

  INSERT INTO audit_log (barbershop_id, user_id, action, entity_type, entity_id, changes)
  VALUES (p_barbershop_id, auth.uid(), 'CANCEL_BOOKING', 'bookings', p_booking_id::text, jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION admin_cancel_booking FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_cancel_booking TO authenticated;
CREATE OR REPLACE FUNCTION admin_mark_no_show(
  p_barbershop_id UUID,
  p_booking_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_shop_member(p_barbershop_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE bookings SET status = 'no_show', updated_at = now()
  WHERE id = p_booking_id AND barbershop_id = p_barbershop_id;

  INSERT INTO audit_log (barbershop_id, user_id, action, entity_type, entity_id, changes)
  VALUES (p_barbershop_id, auth.uid(), 'MARK_NO_SHOW', 'bookings', p_booking_id::text, jsonb_build_object('status', 'no_show'));

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION admin_mark_no_show FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_mark_no_show TO authenticated;
CREATE OR REPLACE FUNCTION admin_block_time(
  p_barbershop_id UUID,
  p_barber_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_reason TEXT DEFAULT 'Bloqueio de Agenda'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT is_shop_member(p_barbershop_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  INSERT INTO time_off (barber_id, starts_at, ends_at, reason)
  VALUES (p_barber_id, p_starts_at, p_ends_at, p_reason)
  RETURNING id INTO v_id;

  INSERT INTO audit_log (barbershop_id, user_id, action, entity_type, entity_id, changes)
  VALUES (p_barbershop_id, auth.uid(), 'BLOCK_TIME', 'time_off', v_id::text, jsonb_build_object('reason', p_reason, 'starts_at', p_starts_at));

  RETURN jsonb_build_object('success', true, 'time_off_id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION admin_block_time FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_block_time TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
