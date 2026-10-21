-- ============================================================================
-- SEED EXCLUSIVO DE DESENVOLVIMENTO LOCAL — NUNCA EXECUTAR EM PRODUÇÃO
-- ============================================================================

DO $$
DECLARE
  v_shop_id UUID := '11111111-1111-1111-1111-111111111111';
  v_barber_1 UUID := '22222222-2222-2222-2222-222222222221';
  v_barber_2 UUID := '22222222-2222-2222-2222-222222222222';
  v_service_corte UUID := '33333333-3333-3333-3333-333333333331';
  v_service_barba UUID := '33333333-3333-3333-3333-333333333332';
  v_service_combo UUID := '33333333-3333-3333-3333-333333333333';
  v_wh_id UUID;
  i INTEGER;
BEGIN
  -- 1. Barbearia de Teste
  INSERT INTO barbershops (id, name, slug, phone, email, address, timezone)
  VALUES (
    v_shop_id,
    'Barbearia Modelo Dev',
    'barbearia-modelo-dev',
    '+5511999990000',
    'contato@barbearia-dev.local',
    'Rua dos Barbeiros, 123 - Centro',
    'America/Sao_Paulo'
  ) ON CONFLICT (id) DO NOTHING;

  -- 2. Configurações do Site
  INSERT INTO site_settings (
    barbershop_id, brand_name, brand_tagline, accent_color,
    hero_title, hero_subtitle, deposit_percentage, cancellation_notice_hours
  ) VALUES (
    v_shop_id,
    'Barbearia Modelo Dev',
    'Tradição & Estilo Masculino (Ambiente Dev)',
    '#F59E0B',
    'Redefinindo o Estilo Masculino',
    'Cortes clássicos, barba na toalha quente e atendimento com pontualidade.',
    50.00,
    24
  ) ON CONFLICT (barbershop_id) DO NOTHING;

  -- 3. Barbeiros de Teste
  INSERT INTO barbers (id, barbershop_id, name, bio, is_active)
  VALUES
    (v_barber_1, v_shop_id, 'Barbeiro Teste Alpha', 'Especialista em cortes clássicos e degradê.', true),
    (v_barber_2, v_shop_id, 'Barbeiro Teste Beta', 'Mestre em barboterapia e navalha tradicional.', true)
  ON CONFLICT (id) DO NOTHING;

  -- 4. Serviços de Teste
  INSERT INTO services (id, barbershop_id, name, description, duration_minutes, buffer_minutes, price, is_active)
  VALUES
    (v_service_corte, v_shop_id, 'Corte Clássico', 'Lavagem, corte estilizado e acabamento.', 40, 5, 60.00, true),
    (v_service_barba, v_shop_id, 'Barba Terapia', 'Toalha quente, hidratação e alinhamento.', 35, 5, 50.00, true),
    (v_service_combo, v_shop_id, 'Combo Corte + Barba', 'Experiência completa com desconto especial.', 70, 10, 100.00, true)
  ON CONFLICT (id) DO NOTHING;

  -- 5. Vincular Barbeiros aos Serviços
  INSERT INTO barber_services (barber_id, service_id)
  VALUES
    (v_barber_1, v_service_corte),
    (v_barber_1, v_service_barba),
    (v_barber_1, v_service_combo),
    (v_barber_2, v_service_corte),
    (v_barber_2, v_service_barba),
    (v_barber_2, v_service_combo)
  ON CONFLICT DO NOTHING;

  -- 6. Horário de Funcionamento (Segunda a Sábado, 09:00 às 19:00)
  FOR i IN 1..6 LOOP
    INSERT INTO working_hours (barber_id, day_of_week, start_time, end_time, is_off)
    VALUES (v_barber_1, i, '09:00', '19:00', false)
    ON CONFLICT (barber_id, day_of_week) DO NOTHING;

    INSERT INTO working_hours (barber_id, day_of_week, start_time, end_time, is_off)
    VALUES (v_barber_2, i, '09:00', '19:00', false)
    ON CONFLICT (barber_id, day_of_week) DO NOTHING;
  END LOOP;

  -- Domingo fechado (day_of_week = 0)
  INSERT INTO working_hours (barber_id, day_of_week, start_time, end_time, is_off)
  VALUES
    (v_barber_1, 0, '09:00', '19:00', true),
    (v_barber_2, 0, '09:00', '19:00', true)
  ON CONFLICT (barber_id, day_of_week) DO NOTHING;

  -- 7. FAQ de Teste
  INSERT INTO faq_items (barbershop_id, question, answer, sort_order)
  VALUES
    (v_shop_id, 'Como funciona o pagamento do sinal?', 'Para garantir sua vaga sem fila de espera, cobramos um sinal de 50% via Pix ou Cartão de Crédito. O valor restante é pago no balcão.', 1),
    (v_shop_id, 'Qual a política para cancelamentos?', 'Você pode cancelar ou reagendar sem nenhum custo com até 24 horas de antecedência através do link recebido na confirmação.', 2),
    (v_shop_id, 'Vocês atendem por ordem de chegada?', 'Trabalhamos com pontualidade britânica e agendamento prévio online para que nenhum cliente perca tempo esperando.', 3)
  ON CONFLICT DO NOTHING;
END $$;
