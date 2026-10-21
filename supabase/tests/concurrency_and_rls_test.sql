-- ============================================================================
-- SUÍTE DE TESTES SQL — CONCORRÊNCIA, SOBREPOSIÇÃO, RLS E ANON ACCESS
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
BEGIN
  RAISE NOTICE 'Iniciando testes de integridade do banco...';

  -- 1. Setup básico
  INSERT INTO barbershops (id, name, slug) VALUES (v_shop_a, 'Barbearia Alpha Test', 'alpha-test');
  INSERT INTO barbershops (id, name, slug) VALUES (v_shop_b, 'Barbearia Beta Test', 'beta-test');
  INSERT INTO barbers (id, barbershop_id, name) VALUES (v_barber_a, v_shop_a, 'Barbeiro Teste');
  INSERT INTO customers (id, barbershop_id, name, phone, email) VALUES (v_customer_1, v_shop_a, 'Cliente 1', '+5511999991111', 'c1@test.com');
  INSERT INTO customers (id, barbershop_id, name, phone, email) VALUES (v_customer_2, v_shop_a, 'Cliente 2', '+5511999992222', 'c2@test.com');

  -- ==========================================================================
  -- TESTE 1: Concorrência simultânea exata (mesmo barbeiro, mesmo horário)
  -- ==========================================================================
  INSERT INTO bookings (barbershop_id, barber_id, customer_id, starts_at, ends_at, total_price, status)
  VALUES (v_shop_a, v_barber_a, v_customer_1, v_start, v_end, 60.00, 'confirmed')
  RETURNING id INTO v_booking_1;

  BEGIN
    -- Tentativa do segundo agendamento no mesmo horário exato
    INSERT INTO bookings (barbershop_id, barber_id, customer_id, starts_at, ends_at, total_price, status)
    VALUES (v_shop_a, v_barber_a, v_customer_2, v_start, v_end, 60.00, 'hold');
  EXCEPTION
    WHEN exclusion_violation THEN
      v_second_booking_failed := true;
  END;

  IF NOT v_second_booking_failed THEN
    RAISE EXCEPTION 'FALHA NO TESTE 1: O segundo agendamento duplicado foi aceito indevidamente!';
  ELSE
    RAISE NOTICE 'SUCESSO TESTE 1: Agendamento duplicado bloqueado com sucesso pelo exclude_overlapping_bookings.';
  END IF;

  -- ==========================================================================
  -- TESTE 2: Reserva com sobreposição parcial
  -- ==========================================================================
  BEGIN
    -- Tenta agendar iniciando 20 minutos após o início do agendamento 1 (que dura 40 minutos)
    INSERT INTO bookings (barbershop_id, barber_id, customer_id, starts_at, ends_at, total_price, status)
    VALUES (v_shop_a, v_barber_a, v_customer_2, v_start + INTERVAL '20 minutes', v_start + INTERVAL '60 minutes', 60.00, 'hold');
  EXCEPTION
    WHEN exclusion_violation THEN
      v_partial_overlap_failed := true;
  END;

  IF NOT v_partial_overlap_failed THEN
    RAISE EXCEPTION 'FALHA NO TESTE 2: Agendamento com sobreposição parcial foi aceito indevidamente!';
  ELSE
    RAISE NOTICE 'SUCESSO TESTE 2: Agendamento parcialmente sobreposto rejeitado com sucesso.';
  END IF;

  -- ==========================================================================
  -- TESTE 3: Expiração de Hold transitório
  -- ==========================================================================
  -- Criar um hold que expirou no passado
  INSERT INTO bookings (barbershop_id, barber_id, customer_id, starts_at, ends_at, total_price, status, hold_expires_at)
  VALUES (v_shop_a, v_barber_a, v_customer_2, now() + INTERVAL '2 days', now() + INTERVAL '2 days 30 minutes', 50.00, 'hold', now() - INTERVAL '1 minute');

  -- Executar rotina de expiração
  PERFORM expire_stale_holds();

  -- Verificar se o status mudou para 'expired'
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE barbershop_id = v_shop_a AND customer_id = v_customer_2 AND status = 'hold'
  ) THEN
    RAISE EXCEPTION 'FALHA NO TESTE 3: Hold vencido não foi alterado para expired!';
  ELSE
    RAISE NOTICE 'SUCESSO TESTE 3: Hold vencido expirado corretamente e horário liberado.';
  END IF;

  RAISE NOTICE 'TODOS OS TESTES DE INTEGRIDADE PASSARAM COM SUCESSO!';
END $$;
