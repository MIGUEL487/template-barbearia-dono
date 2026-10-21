# Documentação do Banco de Dados e Segurança RLS

## Visão Geral do Schema
O banco de dados é hospedado no Supabase (PostgreSQL) com isolamento nativo multi-tenant garantido por `barbershop_id` em todas as tabelas de negócio e Row Level Security (RLS) habilitado.

## Proteção Anti-Duplicidade no Banco
O PostgreSQL utiliza a extensão `btree_gist` e o operador de sobreposição de intervalos temporais `tstzrange`:

```sql
CONSTRAINT exclude_overlapping_bookings
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status IN ('hold', 'confirmed'))
```

### Por que esta abordagem é superior:
1. **Atômica:** Não depende de conferência no frontend nem de checagens "SELECT ... INSERT" vulneráveis a race conditions.
2. **Rejeição em nível de motor:** Se duas conexões simultâneas tentarem alocar o mesmo barbeiro no mesmo intervalo (ou fração sobreposta), exatamente uma obtém o lock de escrita e a outra é abortada imediatamente com erro `exclusion_violation`.
3. **Holds temporários:** Bloqueiam o horário por 10 minutos para pagamento do sinal. Se não forem confirmados, a função `expire_stale_holds()` (executada a cada minuto e reexecutada dentro de cada nova tentativa de agendamento) altera o status para `expired`, liberando o slot.

## Políticas de RLS
1. **Default Deny:** Todas as 28 tabelas têm RLS ativo. Por padrão, nenhuma leitura ou escrita é permitida.
2. **Papéis Administrativos:** Usuários autenticados no Supabase Auth pertencentes a `shop_members` acessam apenas as linhas cujo `barbershop_id` coincide com suas permissões.
3. **Role Anônimo (`anon`):**
   - Não possui permissão `SELECT` direta em tabelas com dados pessoais (`customers`, `bookings`, `payments`, `consents`).
   - Acessa exclusivamente **Views Públicas** sanitizadas (`public_services`, `public_barbers`, `public_site_settings`, `public_faq_items`, `public_gallery_items`, `public_reviews`).
   - Executa mutações controladas exclusivamente via funções RPC com `SECURITY DEFINER` e `search_path` fixado.
