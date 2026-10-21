# Protocolo de Sincronização & Contrato de Arquitetura

Este documento define o contrato de dados, autenticação, RPCs e tokens de design compartilhado entre os dois repositórios do ecossistema:
1. `template-barbearia-cliente` (Interface pública e agendamento)
2. `template-barbearia-dono` (Painel administrativo, gestão de agenda, financeiro e migrations)

Ambos os projetos conectam-se à **mesma instância do Supabase**.

---

## 1. Princípios de Segurança & RLS (Row Level Security)

- **Repositório Cliente (`template-barbearia-cliente`):**
  - Utiliza estritamente a chave pública `anon`.
  - NUNCA executa `SELECT *` diretamente nas tabelas sensíveis (`customers`, `bookings`, `payments`).
  - Todas as leituras públicas são feitas através das **Views Seguras**:
    - `public_site_settings`
    - `public_services`
    - `public_barbers`
    - `public_faq_items`
  - Todas as mutações e transações são executadas via **RPCs Seguras**:
    - `get_availability(p_barbershop_id, p_barber_id, p_date, p_service_ids)`
    - `create_booking_hold(...)` (retorna token do agendamento e reserva o horário com hold de 15 minutos)
    - `get_booking_by_token(p_token)`
    - `cancel_booking_by_token(p_token, p_reason)`
    - `reschedule_booking_by_token(p_token, p_new_starts_at, p_new_barber_id)`

- **Repositório Dono (`template-barbearia-dono`):**
  - Autenticado via Supabase Auth + `@supabase/ssr`.
  - Validação estrita na tabela `shop_members` (papéis: `owner`, `admin`, `barber`, `receptionist`).
  - Mutações administrativas utilizam RPCs com `SECURITY DEFINER` e verificação de filiação (`is_shop_member`):
    - `admin_create_booking(...)`
    - `admin_complete_booking(...)`
    - `admin_cancel_booking(...)`
    - `admin_mark_no_show(...)`
    - `admin_block_time(...)`
  - Trilha de auditoria gravada em `audit_log` para qualquer intervenção humana.

---

## 2. Variáveis de Ambiente Necessárias

Ambos os repositórios contam com o script `npm run check:env` que valida a presença de variáveis obrigatórias em tempo de build/execução.

### Cliente (`template-barbearia-cliente/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://sua-instancia.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
NEXT_PUBLIC_BARBERSHOP_ID=00000000-0000-0000-0000-000000000001
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

### Dono (`template-barbearia-dono/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://sua-instancia.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
NEXT_PUBLIC_APP_URL=http://localhost:3001
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=...
```

---

## 3. Webhook Mercado Pago & Idempotência

O endpoint `POST /api/webhooks/mercadopago` no repositório do dono processa confirmações de pagamento:
- **Verificação Criptográfica:** Valida o cabeçalho `x-signature` com HMAC-SHA256 (`ts`, `data.id` e `MERCADOPAGO_WEBHOOK_SECRET`) utilizando `crypto.timingSafeEqual` para prevenir ataques de temporização.
- **Tabela de Idempotência:** Toda notificação recebida é registrada na tabela `payment_events`. Se o evento já tiver sido processado (`processed_at IS NOT NULL`), o endpoint retorna `200 OK` imediatamente sem duplicar liquidações.
- **Validação de Valor:** O valor recebido na API do Mercado Pago é comparado com o valor registrado no banco de dados (`payments.amount`).

---

## 4. Sincronização de Design Tokens

Os tokens visuais (cores, tipografia, espaçamentos, raio de borda) residem em `src/styles/tokens.css` de ambos os projetos e devem ser mantidos idênticos.

Para verificar a conformidade dos tokens:
```bash
npm run tokens:check
```

O hash SHA-256 é comparado com o arquivo de trava `design-tokens.sha256`.
Hash canônico da release:
`658e3808591220e92cd6bf52f26483aeadad4f6d1ceeb4a6222c691d86be44fb`
