-- Group booking RPCs; original single-person functions stay unchanged.
-- Generated from the audited booking-repair.sql; repeated service IDs represent quantities.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_group_availability(
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
  IF p_service_ids IS NULL OR cardinality(p_service_ids) NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM unnest(p_service_ids) i GROUP BY i HAVING count(*)>6) THEN RAISE EXCEPTION 'Quantidade de serviços inválida.'; END IF;
  IF (SELECT count(*) FROM public.services s JOIN unnest(p_service_ids) requested(service_id) ON requested.service_id=s.id
      WHERE s.barbershop_id=p_barbershop_id AND s.is_active)<>cardinality(p_service_ids) THEN
    RAISE EXCEPTION 'Seleção de serviços inválida.';
  END IF;
  -- Limpar holds vencidos na própria consulta
  PERFORM expire_stale_holds();

  SELECT bs.timezone INTO v_tz FROM barbershops bs WHERE bs.id = p_barbershop_id;
  IF v_tz IS NULL THEN
    v_tz := 'America/Sao_Paulo';
  END IF;

  -- Calcular duração total dos serviços solicitados
  SELECT COALESCE(SUM(s.duration_minutes + s.buffer_minutes), 30)
  INTO v_total_duration
  FROM services s JOIN unnest(p_service_ids) requested(service_id) ON requested.service_id=s.id
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
CREATE OR REPLACE FUNCTION public.create_group_booking_hold(
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
  FROM services JOIN unnest(p_service_ids) requested(service_id) ON requested.service_id=services.id
  WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id AND is_active = true;

  IF v_total_duration = 0 THEN
    RAISE EXCEPTION 'Nenhum serviço ativo selecionado.';
  END IF;

  IF p_service_ids IS NULL OR cardinality(p_service_ids) = 0 OR cardinality(p_service_ids) > 100
     OR (SELECT count(*) FROM services JOIN unnest(p_service_ids) requested(service_id) ON requested.service_id=services.id WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id AND is_active) <> cardinality(p_service_ids) THEN
    RAISE EXCEPTION 'Seleção de serviços inválida.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM get_group_availability(p_barbershop_id, p_barber_id, (p_starts_at AT TIME ZONE v_tz)::date, p_service_ids) a WHERE a.start_time = p_starts_at) THEN
    RAISE EXCEPTION 'Horário indisponível ou reservado.';
  END IF;
  -- 3. Tratamento de "Sem Preferência" de Barbeiro: alocar primeiro barbeiro disponível
  IF v_barber_id IS NULL THEN
    SELECT barber_id INTO v_barber_id
    FROM get_group_availability(p_barbershop_id, NULL, (p_starts_at AT TIME ZONE v_tz)::date, p_service_ids)
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
    SELECT id, name, price, duration_minutes FROM services JOIN unnest(p_service_ids) requested(service_id) ON requested.service_id=services.id
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

REVOKE ALL ON FUNCTION public.get_group_availability(uuid,uuid,date,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_availability(uuid,uuid,date,uuid[]) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.create_group_booking_hold(uuid,uuid,timestamptz,uuid[],text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_booking_hold(uuid,uuid,timestamptz,uuid[],text,text,text,boolean) TO anon,authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
