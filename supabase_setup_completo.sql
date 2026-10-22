-- ============================================================================
-- TEMPLATE BARBEARIA PREMIUM â€” MIGRATION INICIAL
-- Schema multi-tenant com btree_gist, tstzrange anti-duplicidade e RLS estrito
-- ============================================================================

-- ExtensÃµes necessÃ¡rias
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

-- 2. Membros e permissÃµes da barbearia
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

-- 4. ServiÃ§os
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

-- 5. RelaÃ§Ã£o Barbeiro <-> ServiÃ§os Executados
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
  lunch_start TIME DEFAULT '12:00',
  lunch_end TIME DEFAULT '13:00',
  is_off BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT chk_working_hours_order CHECK (start_time < end_time),
  CONSTRAINT uq_barber_day UNIQUE (barber_id, day_of_week)
);

-- 7. Intervalos do Barbeiro (ex: AlmoÃ§o)
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

-- 9. Folgas / FÃ©rias / AusÃªncias do Barbeiro
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

-- 11. Agendamentos (Bookings) com RESTRIÃ‡ÃƒO ANTI-DUPLICIDADE ATÃ”MICA
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
  -- RESTRIÃ‡ÃƒO DE EXCLUSÃƒO CRÃTICA: impede reservas simultÃ¢neas ou sobrepostas
  CONSTRAINT exclude_overlapping_bookings
    EXCLUDE USING gist (
      barber_id WITH =,
      tstzrange(starts_at, ends_at, '[)') WITH &&
    )
    WHERE (status IN ('hold', 'confirmed'))
);

-- 12. Itens do Agendamento (ServiÃ§os congelados no momento da reserva)
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

-- 14. Eventos de Webhook de Pagamento (IdempotÃªncia)
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. TransaÃ§Ãµes Financeiras (Livro Caixa)
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

-- 20. DestinatÃ¡rios da Campanha
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT
);

-- 21. Modelos de NotificaÃ§Ã£o
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

-- 22. Log de NotificaÃ§Ãµes com IdempotÃªncia
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

-- 23. Log de AutomaÃ§Ãµes
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

-- 25. ConfiguraÃ§Ãµes do Site e Identidade da Barbearia
CREATE TABLE IF NOT EXISTS site_settings (
  barbershop_id UUID PRIMARY KEY REFERENCES barbershops(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL DEFAULT 'Barbearia Premium',
  brand_tagline TEXT DEFAULT 'TradiÃ§Ã£o & Estilo Masculino',
  accent_color TEXT NOT NULL DEFAULT '#F59E0B',
  hero_title TEXT NOT NULL DEFAULT 'Redefinindo o Estilo Masculino',
  hero_subtitle TEXT NOT NULL DEFAULT 'Cortes clÃ¡ssicos, barba na toalha quente e pontualidade britÃ¢nica.',
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

-- 28. AvaliaÃ§Ãµes de Clientes
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

-- Helper function: Verifica se usuÃ¡rio autenticado Ã© membro da barbearia
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

-- PolÃ­ticas para membros autenticados da barbearia
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
-- VIEWS PÃšBLICAS PARA LEITURA SEGURA (SEM EXPOR PII OU DADOS INTERNOS)
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

-- PermissÃµes de leitura pÃºblica apenas para as views pÃºblicas
GRANT SELECT ON public_barbers TO anon, authenticated;
GRANT SELECT ON public_services TO anon, authenticated;
GRANT SELECT ON public_site_settings TO anon, authenticated;
GRANT SELECT ON public_faq_items TO anon, authenticated;
GRANT SELECT ON public_gallery_items TO anon, authenticated;
GRANT SELECT ON public_reviews TO anon, authenticated;

-- ============================================================================
-- FUNÃ‡Ã•ES RPC PÃšBLICAS E CRÃTICAS DE AGENDAMENTO
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

  -- Loop pelos barbeiros selecionados (ou todos ativos da loja)
  FOR v_barber IN
    SELECT b.id FROM barbers b
    WHERE b.barbershop_id = p_barbershop_id
      AND b.is_active = true
      AND (p_barber_id IS NULL OR b.id = p_barber_id)
  LOOP
    -- Buscar expediente do barbeiro no dia
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

  -- 2. Calcular preÃ§o e duraÃ§Ã£o dos serviÃ§os
  SELECT COALESCE(SUM(duration_minutes), 0), COALESCE(SUM(price), 0)
  INTO v_total_duration, v_total_price
  FROM services
  WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id;

  IF v_total_duration = 0 THEN
    RAISE EXCEPTION 'Nenhum serviÃ§o vÃ¡lido selecionado';
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
  -- Se houver conflito de horÃ¡rio, a constraint 'exclude_overlapping_bookings' dispararÃ¡ exceÃ§Ã£o
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
      RAISE EXCEPTION 'Este horÃ¡rio acabou de ser reservado por outro cliente. Por favor, selecione outro horÃ¡rio.';
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
    RAISE EXCEPTION 'Agendamento nÃ£o encontrado ou link expirado.';
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
    RAISE EXCEPTION 'Agendamento confirmado nÃ£o localizado ou token invÃ¡lido.';
  END IF;

  IF v_starts_at <= (now() + (v_notice_hours || ' hours')::INTERVAL) THEN
    RAISE EXCEPTION 'Cancelamento fora do prazo permitido de % horas de antecedÃªncia.', v_notice_hours;
  END IF;

  UPDATE bookings
  SET status = 'cancelled', notes = COALESCE(notes || ' | Cancelado: ' || p_reason, p_reason), updated_at = now()
  WHERE id = v_booking_id;

  RETURN jsonb_build_object('success', true, 'message', 'Agendamento cancelado com sucesso.');
END;
$$;

-- Conceder permissÃ£o de execuÃ§Ã£o das RPCs para anÃ´nimos e autenticados
GRANT EXECUTE ON FUNCTION get_availability(UUID, UUID, DATE, UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_booking_hold(UUID, UUID, TIMESTAMPTZ, UUID[], TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_booking_by_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_booking_by_token(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION expire_stale_holds() TO anon, authenticated;


-- ============================================================================
-- TEMPLATE BARBEARIA PREMIUM â€” MIGRATION: SYNC FIXES & ADMIN RPCS
-- ============================================================================

-- 1. REVOGAR ACESSO ANÃ”NIMO Ã€ FUNÃ‡ÃƒO INTERNA DE EXPIRAÃ‡ÃƒO DE HOLDS
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

-- 3. ATUALIZAR create_booking_hold PARA SUPORTAR BARBEIRO NULO ("SEM PREFERÃŠNCIA")
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

  -- 2. Calcular preÃ§o e duraÃ§Ã£o dos serviÃ§os
  SELECT COALESCE(SUM(duration_minutes), 0), COALESCE(SUM(price), 0)
  INTO v_total_duration, v_total_price
  FROM services
  WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id AND is_active = true;

  IF v_total_duration = 0 THEN
    RAISE EXCEPTION 'Nenhum serviÃ§o ativo selecionado.';
  END IF;

  -- 3. Tratamento de "Sem PreferÃªncia" de Barbeiro: alocar primeiro barbeiro disponÃ­vel
  IF v_barber_id IS NULL THEN
    SELECT barber_id INTO v_barber_id
    FROM get_availability(p_barbershop_id, NULL, (p_starts_at AT TIME ZONE v_tz)::date, p_service_ids)
    WHERE start_time = p_starts_at
    LIMIT 1;

    IF v_barber_id IS NULL THEN
      RAISE EXCEPTION 'Nenhum profissional disponÃ­vel para o horÃ¡rio selecionado.';
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

  -- 7. Token de gestÃ£o do agendamento (SHA-256)
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
      RAISE EXCEPTION 'Este horÃ¡rio acabou de ser reservado por outro cliente. Por favor, escolha outro horÃ¡rio.';
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
    RAISE EXCEPTION 'Agendamento nÃ£o encontrado ou token expirado.';
  END IF;

  IF v_booking.status NOT IN ('confirmed', 'hold') THEN
    RAISE EXCEPTION 'Apenas agendamentos ativos podem ser reagendados (status atual: %).', v_booking.status;
  END IF;

  -- Checagem de antecedÃªncia mÃ­nima para reagendamento
  IF v_booking.starts_at <= (now() + (v_booking.cancellation_notice_hours || ' hours')::INTERVAL) THEN
    RAISE EXCEPTION 'Reagendamento fora do prazo permitido de % horas de antecedÃªncia.', v_booking.cancellation_notice_hours;
  END IF;

  -- DuraÃ§Ã£o total baseada nos itens do booking original
  SELECT COALESCE(SUM(duration_minutes), 30) INTO v_total_duration
  FROM booking_items WHERE booking_id = v_booking.id;

  v_new_ends_at := p_new_starts_at + (v_total_duration || ' minutes')::INTERVAL;
  v_target_barber_id := COALESCE(p_new_barber_id, v_booking.barber_id);

  -- AtualizaÃ§Ã£o atÃ´mica respeitando a constraint exclude_overlapping_bookings
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
      RAISE EXCEPTION 'O novo horÃ¡rio selecionado jÃ¡ estÃ¡ ocupado por outro atendimento.';
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
-- 5. FUNÃ‡Ã•ES ADMINISTRATIVAS (EXCLUSIVAS PARA MEMBROS DA BARBEARIA)
-- ============================================================================

-- Admin: Agendamento RÃ¡pido / Manual
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
    RAISE EXCEPTION 'Acesso negado: vocÃª nÃ£o Ã© membro desta barbearia.';
  END IF;

  SELECT COALESCE(SUM(duration_minutes), 0), COALESCE(SUM(price), 0)
  INTO v_total_duration, v_total_price
  FROM services
  WHERE id = ANY(p_service_ids) AND barbershop_id = p_barbershop_id;

  IF v_total_duration = 0 THEN
    RAISE EXCEPTION 'Nenhum serviÃ§o vÃ¡lido informado.';
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

  -- Criar reserva jÃ¡ confirmada
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
      RAISE EXCEPTION 'HorÃ¡rio indisponÃ­vel: conflito com outro atendimento do profissional.';
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
    RAISE EXCEPTION 'Agendamento nÃ£o encontrado.';
  END IF;

  -- Atualiza booking para completed
  UPDATE bookings SET status = 'completed', updated_at = now() WHERE id = p_booking_id;

  -- Se o pagamento estiver pendente e foi recebido no balcÃ£o:
  IF p_payment_received THEN
    UPDATE payments
    SET status = 'approved', updated_at = now()
    WHERE booking_id = p_booking_id AND status = 'pending';

    -- Registrar transaÃ§Ã£o de receita no livro caixa (Receita Real)
    INSERT INTO financial_transactions (barbershop_id, booking_id, type, amount, description)
    VALUES (p_barbershop_id, p_booking_id, 'income', v_booking.total_price, 'Atendimento concluÃ­do - ' || v_booking.id::text);
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

-- Admin: Marcar No-Show (NÃ£o comparecimento)
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

-- Admin: Bloquear HorÃ¡rio / AusÃªncia
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

-- PERMISSÃ•ES: FunÃ§Ãµes administrativas exigem usuÃ¡rio autenticado com vÃ­nculo de membro
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


-- ============================================================================
-- SEED EXCLUSIVO DE DESENVOLVIMENTO LOCAL â€” NUNCA EXECUTAR EM PRODUÃ‡ÃƒO
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

  -- 6. Horário de Funcionamento (Segunda a Sábado, 09:00 às 19:00 com almoço das 12:00 às 13:00)
  FOR i IN 1..6 LOOP
    INSERT INTO working_hours (barber_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_off)
    VALUES (v_barber_1, i, '09:00', '19:00', '12:00', '13:00', false)
    ON CONFLICT (barber_id, day_of_week) DO NOTHING;

    INSERT INTO working_hours (barber_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_off)
    VALUES (v_barber_2, i, '09:00', '19:00', '12:00', '13:00', false)
    ON CONFLICT (barber_id, day_of_week) DO NOTHING;
  END LOOP;

  -- Domingo fechado (day_of_week = 0)
  INSERT INTO working_hours (barber_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_off)
  VALUES
    (v_barber_1, 0, '09:00', '19:00', '12:00', '13:00', true),
    (v_barber_2, 0, '09:00', '19:00', '12:00', '13:00', true)
  ON CONFLICT (barber_id, day_of_week) DO NOTHING;

  -- 7. FAQ de Teste
  INSERT INTO faq_items (barbershop_id, question, answer, sort_order)
  VALUES
    (v_shop_id, 'Como funciona o pagamento do sinal?', 'Para garantir sua vaga sem fila de espera, cobramos um sinal de 50% via Pix ou Cartão de Crédito. O valor restante é pago no balcão.', 1),
    (v_shop_id, 'Qual a política para cancelamentos?', 'Você pode cancelar ou reagendar sem nenhum custo com até 24 horas de antecedência através do link recebido na confirmação.', 2),
    (v_shop_id, 'Vocês atendem por ordem de chegada?', 'Trabalhamos com pontualidade britânica e agendamento prévio online para que nenhum cliente perca tempo esperando.', 3)
  ON CONFLICT DO NOTHING;
END $$;
