# Registro de Decisões de Arquitetura (ADR) — Barbearia Template (Dono)

## Decisões Tomadas

### D1: Instalação Individual com Schema Multi-Tenant
- **Decisão:** Cada barbearia recebe seu próprio projeto Supabase e deploys na Vercel (instalação individual), porém com schema 100% multi-tenant (`barbershop_id` em todas as tabelas de negócio e RLS desde o dia 1).
- **Motivo:** Máximo isolamento de dados no início, facilidade de venda como template independente e caminho sem atritos para migração para SaaS multi-tenant unificado no futuro.

### D2: Pagamentos Flexíveis (Pix e Cartão via Mercado Pago)
- **Decisão:** Pagamento configurável por barbearia: desativado (apenas presencial), sinal (percentual) ou valor integral.
- **Motivo:** Atende barbearias que exigem garantia contra no-shows e barbearias tradicionais que só cobram no balcão.

### D3: Acesso ao Painel Restrito ao Proprietário (v1)
- **Decisão:** Na v1, apenas o dono tem credenciais e login. A tabela `shop_members` já possui papéis (`owner`, `staff`) para preparar o painel do barbeiro na v2 sem refatorar o banco.

### D4: Seleção de Múltiplos Serviços
- **Decisão:** O agendamento permite que o cliente selecione múltiplos serviços em uma mesma sessão, somando dinamicamente tempo e valor.
- **Motivo:** Aumenta o ticket médio (ex.: Corte + Barba + Sobrancelha) e reflete a realidade do atendimento em barbearias premium.

### D5: Política de Cancelamento e Reagendamento via Token Seguro
- **Decisão:** O cliente final não cria senha/conta. O gerenciamento é feito por link assinado com token seguro (armazenado apenas como hash SHA-256 com prazo de expiração).

### D6: Comunicação Idempotente e Confiável
- **Decisão:** Toda notificação é idempotente com chave única `(booking_id, tipo)`. E-mails via Resend na v1, com arquitetura aberta para WhatsApp Business oficial da Meta.

### D7: Segurança e Restrição de Exclusão no Banco de Dados
- **Decisão:** Anti-duplicidade garantida no PostgreSQL com `btree_gist` e `tstzrange` para status `hold` e `confirmed`. A expiração de holds transitórios é feita na própria transação e complementada por `pg_cron`.

---

## Decisões Pendentes / Configuráveis por Instalação
- `{{NOME}}`: Nome comercial da barbearia.
- `{{DOMINIO}}`: Domínio principal (`dominio.com` para cliente e `admin.dominio.com` para dono).
- `{{COR_ACCENT}}`: Padrão inicial âmbar (`#F59E0B`).
- Credenciais de produção do Mercado Pago e Resend (gerenciadas via `.env.local` / Vercel secrets).
