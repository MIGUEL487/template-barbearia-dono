-- ============================================================================
-- SUÍTE DE TESTES SQL EXTENDIDA — CONCORRÊNCIA, REAGENDAMENTO E PERMISSÕES
-- ============================================================================

DO $$
DECLARE
  v_shop_a UUID := gen_random_uuid();
  v_shop_b UUID := gen_random_uuid();
  v_barber_a UUID := gen_random_uuid();
  v_customer_1 UUID := gen_random_uuid();
  v_customer_2 UUID := gen_random_uuid();
  v_start TIMESTAMPTZ := now() + INTERVAL '1 day';
  v_end TIMESTAMPTZ := now() + INTERVAL '1 day 40 minutes';
  v_booking_1 UUID;
  v_second_booking_failed BOOLEAN := false;
  v_partial_overlap_failed BOOLEAN := false;
  v_reschedule_res JSONB;
  v_raw_token TEXT := 'test_token_1234567890_abcdef';
  v_token_hash TEXT;
BEGIN
  RAISE NOTICE 'Executando testes de validação SQL...';

  -- 1. Setup básico
  INSERT INTO barbershops (id, name, slug) VALUES (v_shop_a, 'Barbearia Alpha Test', 'alpha-test');
  INSERT INTO barbershops (id, name, slug) VALUES (v_shop_b, 'Barbearia Beta Test', 'beta-test');
  INSERT INTO site_settings (barbershop_id, cancellation_notice_hours) VALUES (v_shop_a, 24);

  INSERT INTO barbers (id, barbershop_id, name) VALUES (v_barber_a, v_shop_a, 'Barbeiro Teste');
  INSERT INTO customers (id, barbershop_id, name, phone, email) VALUES (v_customer_1, v_shop_a, 'Cliente 1', '+5511999991111', 'c1@test.com');
  INSERT INTO customers (id, barbershop_id, name, phone, email) VALUES (v_customer_2, v_shop_a, 'Cliente 2', '+5511999992222', 'c2@test.com');

  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

  -- ==========================================================================
  -- TESTE 1: Concorrência simultânea exata (mesmo barbeiro, mesmo horário)
  -- ==========================================================================
  INSERT INTO bookings (barbershop_id, barber_id, customer_id, starts_at, ends_at, total_price, status, cancellation_token_hash, cancellation_token_expires_at)
  VALUES (v_shop_a, v_barber_a, v_customer_1, v_start, v_end, 60.00, 'confirmed', v_token_hash, v_end + INTERVAL '7 days')
  RETURNING id INTO v_booking_1;

  INSERT INTO booking_items (booking_id, service_id, service_name, price, duration_minutes)
  VALUES (v_booking_1, gen_random_uuid(), 'Corte Teste', 60.00, 40);

  BEGIN
    INSERT INTO bookings (barbershop_id, barber_id, customer_id, starts_at, ends_at, total_price, status)
    VALUES (v_shop_a, v_barber_a, v_customer_2, v_start, v_end, 60.00, 'hold');
  EXCEPTION
    WHEN exclusion_violation THEN
      v_second_booking_failed := true;
  END;

  IF NOT v_second_booking_failed THEN
    RAISE EXCEPTION 'FALHA NO TESTE 1: O segundo agendamento duplicado foi aceito indevidamente!';
  END IF;

  -- ==========================================================================
  -- TESTE 2: Reserva com sobreposição parcial
  -- ==========================================================================
  BEGIN
    INSERT INTO bookings (barbershop_id, barber_id, customer_id, starts_at, ends_at, total_price, status)
    VALUES (v_shop_a, v_barber_a, v_customer_2, v_start + INTERVAL '20 minutes', v_start + INTERVAL '60 minutes', 60.00, 'hold');
  EXCEPTION
    WHEN exclusion_violation THEN
      v_partial_overlap_failed := true;
  END;

  IF NOT v_partial_overlap_failed THEN
    RAISE EXCEPTION 'FALHA NO TESTE 2: Agendamento parcialmente sobreposto foi aceito indevidamente!';
  END IF;

  -- ==========================================================================
  -- TESTE 3: Reagendamento Atômico por Token
  -- ==========================================================================
  -- Reagendar o booking 1 para 2 dias depois
  v_reschedule_res := reschedule_booking_by_token(v_raw_token, now() + INTERVAL '2 days');
  IF NOT (v_reschedule_res->>'success')::boolean THEN
    RAISE EXCEPTION 'FALHA NO TESTE 3: Reagendamento válido falhou!';
  END IF;

  -- Agora o horário antigo (v_start) deve estar LIVRE para outro cliente
  INSERT INTO bookings (barbershop_id, barber_id, customer_id, starts_at, ends_at, total_price, status)
  VALUES (v_shop_a, v_barber_a, v_customer_2, v_start, v_end, 60.00, 'confirmed');

  RAISE NOTICE 'SUCESSO: Todos os testes de concorrência e reagendamento atômico passaram!';
END $$;
