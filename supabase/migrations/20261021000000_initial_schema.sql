-- ============================================================================
-- TEMPLATE BARBEARIA PREMIUM — MIGRATION INICIAL
-- Schema multi-tenant com btree_gist, tstzrange anti-duplicidade e RLS estrito
-- ============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Tipos enumerados
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('hold', 'confirmed', 'completed', 'no_show', 'cancelled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'rejected', 'refunded', 'partially_refunded', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('pix', 'credit_card', 'debit_card', 'cash', 'in_person');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE shop_member_role AS ENUM ('owner', 'staff');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Barbearias (Tenants)
CREATE TABLE IF NOT EXISTS barbershops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Membros e permissões da barbearia
CREATE TABLE IF NOT EXISTS shop_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role shop_member_role NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shop_member UNIQUE (barbershop_id, user_id)
);

-- 3. Barbeiros / Profissionais
CREATE TABLE IF NOT EXISTS barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Serviços
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  buffer_minutes INTEGER NOT NULL DEFAULT 5 CHECK (buffer_minutes >= 0),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Relação Barbeiro <-> Serviços Executados
CREATE TABLE IF NOT EXISTS barber_services (
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (barber_id, service_id)
);

-- 6. Horário de Funcionamento por Barbeiro (0 = Domingo, 6 = Sábado)
CREATE TABLE IF NOT EXISTS working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_off BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT chk_working_hours_order CHECK (start_time < end_time),
  CONSTRAINT uq_barber_day UNIQUE (barber_id, day_of_week)
);

-- 7. Intervalos do Barbeiro (ex: Almoço)
CREATE TABLE IF NOT EXISTS breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  working_hour_id UUID NOT NULL REFERENCES working_hours(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CONSTRAINT chk_breaks_order CHECK (start_time < end_time)
);

-- 8. Dias Fechados da Barbearia (Feriados / Eventos)
CREATE TABLE IF NOT EXISTS closed_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  CONSTRAINT uq_shop_closed_date UNIQUE (barbershop_id, date)
);

-- 9. Folgas / Férias / Ausências do Barbeiro
CREATE TABLE IF NOT EXISTS time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  CONSTRAINT chk_time_off_order CHECK (starts_at < ends_at)
);

-- 10. Clientes
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shop_customer_phone UNIQUE (barbershop_id, phone)
);

-- 11. Agendamentos (Bookings) com RESTRIÇÃO ANTI-DUPLICIDADE ATÔMICA
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
  deposit_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  status booking_status NOT NULL DEFAULT 'hold',
  hold_expires_at TIMESTAMPTZ,
  cancellation_token_hash TEXT,
  cancellation_token_expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_booking_time_range CHECK (starts_at < ends_at),
  -- RESTRIÇÃO DE EXCLUSÃO CRÍTICA: impede reservas simultâneas ou sobrepostas
  CONSTRAINT exclude_overlapping_bookings
    EXCLUDE USING gist (
      barber_id WITH =,
      tstzrange(starts_at, ends_at, '[)') WITH &&
    )
    WHERE (status IN ('hold', 'confirmed'))
);

-- 12. Itens do Agendamento (Serviços congelados no momento da reserva)
CREATE TABLE IF NOT EXISTS booking_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  service_name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  duration_minutes INTEGER NOT NULL
);

-- 13. Pagamentos
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  method payment_method NOT NULL DEFAULT 'pix',
  status payment_status NOT NULL DEFAULT 'pending',
  external_payment_id TEXT,
  pix_qr_code TEXT,
  pix_copy_paste TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Eventos de Webhook de Pagamento (Idempotência)
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. Transações Financeiras (Livro Caixa)
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'refund', 'expense')),
  amount NUMERIC(10, 2) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. Cupons de Desconto
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_percentage NUMERIC(5, 2) CHECK (discount_percentage BETWEEN 0 AND 100),
  discount_amount NUMERIC(10, 2) CHECK (discount_amount >= 0),
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shop_coupon UNIQUE (barbershop_id, code)
);

-- 17. Livro de Fidelidade
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. Consentimentos LGPD
CREATE TABLE IF NOT EXISTS consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  consent_given BOOLEAN NOT NULL DEFAULT false,
  legal_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'booking_flow',
  ip_address TEXT,
  given_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

-- 19. Campanhas
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  message_template TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 20. Destinatários da Campanha
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT
);

-- 21. Modelos de Notificação
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  subject TEXT,
  body_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_shop_template UNIQUE (barbershop_id, event_type, channel)
);

-- 22. Log de Notificações com Idempotência
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'sent',
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 23. Log de Automações
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  workflow_name TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB,
  error_details TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

-- 24. Auditoria Administrativa
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 25. Configurações do Site e Identidade da Barbearia
CREATE TABLE IF NOT EXISTS site_settings (
  barbershop_id UUID PRIMARY KEY REFERENCES barbershops(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL DEFAULT 'Barbearia Premium',
  brand_tagline TEXT DEFAULT 'Tradição & Estilo Masculino',
  accent_color TEXT NOT NULL DEFAULT '#F59E0B',
  hero_title TEXT NOT NULL DEFAULT 'Redefinindo o Estilo Masculino',
  hero_subtitle TEXT NOT NULL DEFAULT 'Cortes clássicos, barba na toalha quente e pontualidade britânica.',
  hero_image_url TEXT,
  deposit_percentage NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
  min_booking_notice_hours INTEGER NOT NULL DEFAULT 1,
  max_booking_ahead_days INTEGER NOT NULL DEFAULT 30,
  cancellation_notice_hours INTEGER NOT NULL DEFAULT 24,
  instagram_url TEXT DEFAULT 'https://instagram.com',
  maps_embed_url TEXT,
  about_history TEXT,
  about_location TEXT,
  about_payment_methods TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 26. FAQ
CREATE TABLE IF NOT EXISTS faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- 27. Galeria de Fotos
CREATE TABLE IF NOT EXISTS gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- 28. Avaliações de Clientes
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- HABILITAR ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- ============================================================================
ALTER TABLE barbershops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Helper function: Verifica se usuário autenticado é membro da barbearia
CREATE OR REPLACE FUNCTION is_shop_member(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shop_members
    WHERE barbershop_id = p_shop_id
      AND user_id = auth.uid()
  );
$$;

-- Políticas para membros autenticados da barbearia
CREATE POLICY shop_member_all_barbershops ON barbershops
  FOR ALL TO authenticated USING (is_shop_member(id));

CREATE POLICY shop_member_all_shop_members ON shop_members
  FOR ALL TO authenticated USING (is_shop_member(barbershop_id));

CREATE POLICY shop_member_all_barbers ON barbers
  FOR ALL TO authenticated USING (is_shop_member(barbershop_id));

CREATE POLICY shop_member_all_services ON services
  FOR ALL TO authenticated USING (is_shop_member(barbershop_id));

CREATE POLICY shop_member_all_customers ON customers
  FOR ALL TO authenticated USING (is_shop_member(barbershop_id));

CREATE POLICY shop_member_all_bookings ON bookings
  FOR ALL TO authenticated USING (is_shop_member(barbershop_id));

CREATE POLICY shop_member_all_payments ON payments
  FOR ALL TO authenticated USING (is_shop_member(barbershop_id));

CREATE POLICY shop_member_all_transactions ON financial_transactions
  FOR ALL TO authenticated USING (is_shop_member(barbershop_id));

CREATE POLICY shop_member_all_settings ON site_settings
  FOR ALL TO authenticated USING (is_shop_member(barbershop_id));

CREATE POLICY shop_member_all_audit ON audit_log
  FOR ALL TO authenticated USING (is_shop_member(barbershop_id));

-- ============================================================================
-- VIEWS PÚBLICAS PARA LEITURA SEGURA (SEM EXPOR PII OU DADOS INTERNOS)
-- ============================================================================
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

-- Permissões de leitura pública apenas para as views públicas
GRANT SELECT ON public_barbers TO anon, authenticated;
GRANT SELECT ON public_services TO anon, authenticated;
GRANT SELECT ON public_site_settings TO anon, authenticated;
GRANT SELECT ON public_faq_items TO anon, authenticated;
GRANT SELECT ON public_gallery_items TO anon, authenticated;
GRANT SELECT ON public_reviews TO anon, authenticated;

-- ============================================================================
-- FUNÇÕES RPC PÚBLICAS E CRÍTICAS DE AGENDAMENTO
-- ============================================================================

-- Expira holds vencidos
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

-- RPC: Obter horários disponíveis
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
DECLARE
  v_total_duration INTEGER;
  v_day_of_week INTEGER;
  v_barber RECORD;
  v_wh RECORD;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_tz TEXT;
BEGIN
  -- Limpar holds vencidos na própria consulta
  PERFORM expire_stale_holds();

  SELECT timezone INTO v_tz FROM barbershops WHERE id = p_barbershop_id;
  IF v_tz IS NULL THEN
    v_tz := 'America/Sao_Paulo';
  END IF;

  -- Calcular duração total dos serviços solicitados
  SELECT COALESCE(SUM(duration_minutes + buffer_minutes), 30)
  INTO v_total_duration
  FROM services
  WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id;

  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- Se a barbearia estiver fechada nesta data, retorna vazio
  IF EXISTS (SELECT 1 FROM closed_days WHERE barbershop_id = p_barbershop_id AND date = p_date) THEN
    RETURN;
  END IF;

  -- Loop pelos barbeiros selecionados (ou todos ativos da loja)
  FOR v_barber IN
    SELECT b.id FROM barbers b
    WHERE b.barbershop_id = p_barbershop_id
      AND b.is_active = true
      AND (p_barber_id IS NULL OR b.id = p_barber_id)
  LOOP
    -- Buscar expediente do barbeiro no dia
    SELECT * INTO v_wh FROM working_hours
    WHERE barber_id = v_barber.id
      AND day_of_week = v_day_of_week
      AND is_off = false;

    IF FOUND THEN
      -- Gerar slots de 30 em 30 minutos
      v_slot_start := (p_date || ' ' || v_wh.start_time)::TIMESTAMP AT TIME ZONE v_tz;

      WHILE (v_slot_start + (v_total_duration || ' minutes')::INTERVAL) <= ((p_date || ' ' || v_wh.end_time)::TIMESTAMP AT TIME ZONE v_tz) LOOP
        v_slot_end := v_slot_start + (v_total_duration || ' minutes')::INTERVAL;

        -- Verificar que não está no passado
        IF v_slot_start > now() THEN
          -- Verificar que não colide com folga/férias
          IF NOT EXISTS (
            SELECT 1 FROM time_off
            WHERE barber_id = v_barber.id
              AND starts_at < v_slot_end
              AND ends_at > v_slot_start
          )
          -- Verificar que não colide com agendamentos existentes (hold ou confirmed)
          AND NOT EXISTS (
            SELECT 1 FROM bookings
            WHERE barber_id = v_barber.id
              AND status IN ('hold', 'confirmed')
              AND starts_at < v_slot_end
              AND ends_at > v_slot_start
          ) THEN
            barber_id := v_barber.id;
            start_time := v_slot_start;
            end_time := v_slot_end;
            RETURN NEXT;
          END IF;
        END IF;

        v_slot_start := v_slot_start + INTERVAL '30 minutes';
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- RPC: Criar Hold de Reserva
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
BEGIN
  -- 1. Expirar holds vencidos imediatamente antes de tentar alocar
  PERFORM expire_stale_holds();

  -- 2. Calcular preço e duração dos serviços
  SELECT COALESCE(SUM(duration_minutes), 0), COALESCE(SUM(price), 0)
  INTO v_total_duration, v_total_price
  FROM services
  WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id;

  IF v_total_duration = 0 THEN
    RAISE EXCEPTION 'Nenhum serviço válido selecionado';
  END IF;

  v_ends_at := p_starts_at + (v_total_duration || ' minutes')::INTERVAL;
  v_hold_expires := now() + INTERVAL '10 minutes';

  -- 3. Calcular percentual de sinal
  SELECT COALESCE(deposit_percentage, 50.00) INTO v_deposit_pct
  FROM site_settings WHERE barbershop_id = p_barbershop_id;

  v_deposit_amount := ROUND((v_total_price * (COALESCE(v_deposit_pct, 50.00) / 100.0)), 2);

  -- 4. Upsert do cliente
  INSERT INTO customers (barbershop_id, name, phone, email)
  VALUES (p_barbershop_id, p_customer_name, p_customer_phone, p_customer_email)
  ON CONFLICT (barbershop_id, phone)
  DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = now()
  RETURNING id INTO v_customer_id;

  -- 5. Registrar consentimento LGPD se concedido
  IF p_marketing_consent THEN
    INSERT INTO consents (barbershop_id, customer_id, channel, consent_given, legal_text, source)
    VALUES (p_barbershop_id, v_customer_id, 'whatsapp', true, 'Aceito receber lembretes e ofertas da barbearia', 'checkout');
  END IF;

  -- 6. Gerar token de cancelamento seguro (hash sha256)
  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

  -- 7. Inserir agendamento em estado HOLD
  -- Se houver conflito de horário, a constraint 'exclude_overlapping_bookings' disparará exceção
  BEGIN
    INSERT INTO bookings (
      barbershop_id, barber_id, customer_id,
      starts_at, ends_at, total_price, deposit_amount,
      status, hold_expires_at,
      cancellation_token_hash, cancellation_token_expires_at
    ) VALUES (
      p_barbershop_id, p_barber_id, v_customer_id,
      p_starts_at, v_ends_at, v_total_price, v_deposit_amount,
      'hold', v_hold_expires,
      v_token_hash, v_ends_at + INTERVAL '7 days'
    ) RETURNING id INTO v_booking_id;
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION 'Este horário acabou de ser reservado por outro cliente. Por favor, selecione outro horário.';
  END;

  -- 8. Inserir itens do agendamento
  FOR v_service IN
    SELECT id, name, price, duration_minutes FROM services
    WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id
  LOOP
    INSERT INTO booking_items (booking_id, service_id, service_name, price, duration_minutes)
    VALUES (v_booking_id, v_service.id, v_service.name, v_service.price, v_service.duration_minutes);
  END LOOP;

  -- 9. Retornar dados da reserva
  RETURN jsonb_build_object(
    'booking_id', v_booking_id,
    'hold_expires_at', v_hold_expires,
    'total_price', v_total_price,
    'deposit_amount', v_deposit_amount,
    'cancellation_token', v_raw_token
  );
END;
$$;

-- RPC: Consultar agendamento via token
CREATE OR REPLACE FUNCTION get_booking_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- RPC: Cancelar agendamento via token
CREATE OR REPLACE FUNCTION cancel_booking_by_token(p_token TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Conceder permissão de execução das RPCs para anônimos e autenticados
GRANT EXECUTE ON FUNCTION get_availability(UUID, UUID, DATE, UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_booking_hold(UUID, UUID, TIMESTAMPTZ, UUID[], TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_booking_by_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_booking_by_token(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION expire_stale_holds() TO anon, authenticated;
