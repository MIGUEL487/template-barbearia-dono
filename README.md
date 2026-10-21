# Barbearia Template — Painel Administrativo & Banco de Dados (`template-barbearia-dono`)

Repositório administrativo e fonte da verdade do sistema premium de barbearia: painel do proprietário, gestão de agenda em tempo real, controle de serviços, profissionais, clientes (CRM), transações financeiras, automações e schema Supabase com restrições anti-duplicidade em banco (`btree_gist` e `tstzrange`).

## Stack
- **Framework:** Next.js (App Router) + TypeScript
- **Estilização:** Tailwind CSS + Design Tokens (`design-tokens.css`)
- **Autenticação & Banco:** Supabase Auth + PostgreSQL + RLS + Edge Functions + pg_cron
- **Pagamentos:** Mercado Pago (Pix e Cartão com webhooks idempotentes)
- **Notificações:** Resend (E-mail) + n8n / WhatsApp Business Platform

## Instalação e Execução Local

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local

# Iniciar servidor de desenvolvimento (porta 3001 para não colidir com o cliente)
npm run dev
```

Abra [http://localhost:3001](http://localhost:3001) no navegador.

## Banco de Dados (Supabase)
Toda a fonte da verdade do schema, migrations e RPCs fica na pasta `supabase/`.
```bash
# Aplicar migrations localmente com o Supabase CLI
npx supabase db reset
```

## Scripts Disponíveis
- `npm run dev`: Inicia o servidor local de desenvolvimento na porta 3001.
- `npm run build`: Gera o build de produção.
- `npm run lint`: Executa a verificação estática com ESLint.
- `npm run typecheck`: Validação rigorosa de tipagem com TypeScript.
- `npm test`: Executa os testes automatizados.
