-- ============================================================================
-- TEMPLATE BARBEARIA PREMIUM — MIGRATION: SYNC FIXES & ADMIN RPCS
-- ============================================================================

-- 1. REVOGAR ACESSO ANÔNIMO À FUNÇÃO INTERNA DE EXPIRAÇÃO DE HOLDS
REVOKE EXECUTE ON FUNCTION expire_stale_holds() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION expire_stale_holds() TO service_role;

-- 2. JOB PG_CRON PARA EXPIRAR HOLDS A CADA MINUTO (SE SUPORTADO NO AMBIENTE)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('expire_stale_holds_job');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule('expire_stale_holds_job', '* * * * *', 'SELECT expire_stale_holds()');
  END IF;
END $$;

-- 3. ATUALIZAR create_booking_hold PARA SUPORTAR BARBEIRO NULO ("SEM PREFERÊNCIA")
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
SET search_path = public
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
  SELECT COALESCE(SUM(duration_minutes), 0), COALESCE(SUM(price), 0)
  INTO v_total_duration, v_total_price
  FROM services
  WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id AND is_active = true;

  IF v_total_duration = 0 THEN
    RAISE EXCEPTION 'Nenhum serviço ativo selecionado.';
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
  v_hold_expires := now() + INTERVAL '10 minutes';

  -- 4. Percentual de sinal
  SELECT COALESCE(deposit_percentage, 50.00) INTO v_deposit_pct
  FROM site_settings WHERE barbershop_id = p_barbershop_id;

  v_deposit_amount := ROUND((v_total_price * (COALESCE(v_deposit_pct, 50.00) / 100.0)), 2);

  -- 5. Upsert de cliente
  INSERT INTO customers (barbershop_id, name, phone, email)
  VALUES (p_barbershop_id, p_customer_name, p_customer_phone, p_customer_email)
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

-- 4. RPC: REAGENDAMENTO POR TOKEN SEGURO
CREATE OR REPLACE FUNCTION reschedule_booking_by_token(
  p_token TEXT,
  p_new_starts_at TIMESTAMPTZ,
  p_new_barber_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION reschedule_booking_by_token(TEXT, TIMESTAMPTZ, UUID) TO anon, authenticated;

-- ============================================================================
-- 5. FUNÇÕES ADMINISTRATIVAS (EXCLUSIVAS PARA MEMBROS DA BARBEARIA)
-- ============================================================================

-- Admin: Agendamento Rápido / Manual
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

-- Admin: Concluir Atendimento e Confirmar Receita
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

-- Admin: Cancelar Reserva
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

-- Admin: Marcar No-Show (Não comparecimento)
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

-- Admin: Bloquear Horário / Ausência
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

-- PERMISSÕES: Funções administrativas exigem usuário autenticado com vínculo de membro
GRANT EXECUTE ON FUNCTION admin_create_booking TO authenticated;
GRANT EXECUTE ON FUNCTION admin_complete_booking TO authenticated;
GRANT EXECUTE ON FUNCTION admin_cancel_booking TO authenticated;
GRANT EXECUTE ON FUNCTION admin_mark_no_show TO authenticated;
GRANT EXECUTE ON FUNCTION admin_block_time TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_create_booking FROM anon;
REVOKE EXECUTE ON FUNCTION admin_complete_booking FROM anon;
REVOKE EXECUTE ON FUNCTION admin_cancel_booking FROM anon;
REVOKE EXECUTE ON FUNCTION admin_mark_no_show FROM anon;
REVOKE EXECUTE ON FUNCTION admin_block_time FROM anon;
