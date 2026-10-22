-- ============================================================================
-- SCRIPT DE ATUALIZAÇÃO DO SUPABASE (EXECUTE NO SQL EDITOR DO SUPABASE)
-- Atualiza:
-- 1. Horário de almoço dos funcionários (lunch_start e lunch_end)
-- 2. Correção definitiva da função get_availability (horários de agendamento)
-- 3. Limpeza de caracteres corrompidos / estranhos (mojibake)
-- ============================================================================

-- 1. ADICIONAR COLUNAS DE ALMOÇO NA TABELA WORKING_HOURS
ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS lunch_start TIME DEFAULT '12:00';
ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS lunch_end TIME DEFAULT '13:00';

-- Preencher horários existentes com o padrão de almoço (12:00 às 13:00)
UPDATE working_hours 
SET lunch_start = '12:00' 
WHERE lunch_start IS NULL;

UPDATE working_hours 
SET lunch_end = '13:00' 
WHERE lunch_end IS NULL;


-- 2. RECRIAR FUNÇÃO get_availability COM CÁLCULO PRECISO E SUPORTE A ALMOÇO
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
SET search_path = public
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
  WHERE s.id = ANY(p_service_ids) AND s.barbershop_id = p_barbershop_id;

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
      -- Fallback caso o barbeiro ainda não tenha expediente configurado no banco
      -- Segunda (1) a Sábado (6): 09:00 às 19:00 com almoço das 12:00 às 13:00. Domingo (0) folga
      IF v_day_of_week = 0 THEN
        CONTINUE;
      END IF;

      v_slot_start  := (p_date + TIME '09:00:00') AT TIME ZONE v_tz;
      v_day_end     := (p_date + TIME '19:00:00') AT TIME ZONE v_tz;
      v_lunch_start := (p_date + TIME '12:00:00') AT TIME ZONE v_tz;
      v_lunch_end   := (p_date + TIME '13:00:00') AT TIME ZONE v_tz;
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

-- Permissões públicas para a consulta de disponibilidade
GRANT EXECUTE ON FUNCTION get_availability(UUID, UUID, DATE, UUID[]) TO anon, authenticated, service_role;


-- 3. CORRIGIR TEXTOS COM CARACTERES ESTRANHOS (MOJIBAKE) NO BANCO DE DADOS
UPDATE services SET 
  name = 'Corte Clássico', 
  description = 'Lavagem, corte estilizado e acabamento.'
WHERE name ILIKE '%Corte%' AND (name ILIKE '%ssico%' OR name ILIKE '%Ã%');

UPDATE services SET 
  name = 'Barba Terapia', 
  description = 'Toalha quente, hidratação e alinhamento.'
WHERE name ILIKE '%Barba%' AND (description ILIKE '%Toalha%' OR description ILIKE '%Ã%');

UPDATE services SET 
  name = 'Combo Corte + Barba', 
  description = 'Experiência completa com desconto especial.'
WHERE name ILIKE '%Combo%' AND (description ILIKE '%Experi%' OR description ILIKE '%Ã%');

UPDATE barbers SET 
  bio = 'Especialista em cortes clássicos e degradê.'
WHERE bio ILIKE '%degrad%' OR bio ILIKE '%Ã%';

UPDATE barbers SET 
  bio = 'Mestre em barboterapia e navalha tradicional.'
WHERE bio ILIKE '%navalha%';

UPDATE site_settings SET
  brand_tagline = 'Tradição & Estilo Masculino',
  hero_title = 'Redefinindo o Estilo Masculino',
  hero_subtitle = 'Cortes clássicos, barba na toalha quente e atendimento com pontualidade.';

UPDATE faq_items SET
  question = 'Como funciona o pagamento do sinal?',
  answer = 'Para garantir sua vaga sem fila de espera, cobramos um sinal de 50% via Pix ou Cartão de Crédito. O valor restante é pago no balcão.'
WHERE question ILIKE '%pagamento%sinal%';

UPDATE faq_items SET
  question = 'Qual a política para cancelamentos?',
  answer = 'Você pode cancelar ou reagendar sem nenhum custo com até 24 horas de antecedência através do link recebido na confirmação.'
WHERE question ILIKE '%cancelamento%';

UPDATE faq_items SET
  question = 'Vocês atendem por ordem de chegada?',
  answer = 'Trabalhamos com pontualidade britânica e agendamento prévio online para que nenhum cliente perca tempo esperando.'
WHERE question ILIKE '%chegada%';

-- Limpeza genérica caso ainda haja outros registros com encoding duplo
UPDATE services SET 
  name = replace(replace(replace(replace(name, 'Ã¡', 'á'), 'Ã©', 'é'), 'Ãª', 'ê'), 'Ã§Ã£', 'çã'),
  description = replace(replace(replace(replace(replace(replace(description, 'Ã§Ã£', 'çã'), 'Ã¡', 'á'), 'Ã©', 'é'), 'Ãª', 'ê'), 'Ã­', 'í'), 'Ã ', 'à');

UPDATE faq_items SET 
  question = replace(replace(replace(replace(question, 'Ã§Ã£', 'çã'), 'Ã¡', 'á'), 'Ã©', 'é'), 'Ãª', 'ê'),
  answer = replace(replace(replace(replace(replace(replace(replace(answer, 'Ã§Ã£', 'çã'), 'Ã¡', 'á'), 'Ã©', 'é'), 'Ãª', 'ê'), 'Ã­', 'í'), 'Ã ', 'à'), 'Ã¢', 'â');
