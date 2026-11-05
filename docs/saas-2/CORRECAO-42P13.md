# Correção do instalador: PostgreSQL 42P13

## Causa e mudança

A assinatura informada de produção tem oito parâmetros de entrada, sendo sete opcionais. A versão inicial da migration preservava somente `p_marketing_consent DEFAULT false`. PostgreSQL não permite remover defaults existentes com `CREATE OR REPLACE FUNCTION`: gera `42P13: cannot remove parameter defaults from existing function`.

A migration original `20261105010000_saas2_booking_contract.sql` e o bundle gerado agora declaram:

```sql
CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_barbershop_id uuid,
  p_barber_id uuid DEFAULT NULL::uuid,
  p_starts_at timestamptz DEFAULT NULL::timestamptz,
  p_service_ids uuid[] DEFAULT '{}'::uuid[],
  p_customer_name text DEFAULT ''::text,
  p_customer_phone text DEFAULT ''::text,
  p_customer_email text DEFAULT NULL::text,
  p_marketing_consent boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
  SELECT public.create_group_booking_hold(
    p_barbershop_id, p_barber_id, p_starts_at, p_service_ids,
    p_customer_name, p_customer_phone, p_customer_email, p_marketing_consent
  );
$$;
```

O corpo, os tipos/nomes dos parâmetros, o retorno, a configuração de segurança e os comandos de permissões da migration não foram alterados por esta correção. A identidade continua sendo a mesma função de oito argumentos; defaults não criam overloads. `PUBLIC` continua sem execute; `anon` e `authenticated` continuam autorizados a chamar a RPC pública. Grants adicionais preexistentes não são removidos pelo replace.

Não há remoção de função, reconstrução de agendamentos ou atualização retroativa de valores. As validações de contato, serviços, preço, duração, buffer, disponibilidade, concorrência e hold de 15 minutos continuam no contrato canônico. Um parâmetro ser opcional na assinatura não transforma uma solicitação sem dados obrigatórios de negócio em reserva válida.

## Auditoria das nove funções do instalador

| Função | Parâmetros de entrada | Defaults esperados | Retorno |
| --- | --- | --- | --- |
| `create_booking_hold` | 8 | últimos 7, conforme produção informada | jsonb |
| `create_group_booking_hold` | 8 | último: marketing=false | jsonb |
| `get_availability` | 4 | nenhum | TABLE(barber_id uuid,start_time timestamptz,end_time timestamptz) |
| `get_group_availability` | 4 | nenhum | mesma TABLE |
| `saas_can_manage` | 1 | nenhum | boolean |
| `consume_raiox_ai_quota` | 1 | nenhum | boolean |
| `join_waitlist` | 11 | nenhum | uuid |
| `offer_waitlist` | 4 | nenhum | jsonb |
| `cancel_waitlist` | 2 | nenhum | void |

Nomes, tipos e retornos foram comparados com as definições versionadas e o catálogo do banco de teste. Não foi encontrada outra remoção de default nessa referência. Na segunda execução do instalador, as nove funções já existiam: seus OIDs, assinaturas, defaults, retornos e grants permaneceram iguais.

**Limite da auditoria:** o catálogo de produção não foi consultado. Somente a assinatura de produção fornecida pelo proprietário foi reproduzida. Se outras funções de produção tiverem sido modificadas manualmente, confira a consulta de auditoria abaixo; não se deve presumir equivalência completa de um schema não exportado.

## Dependências e chamadas opcionais

- Uma view dependente da função existente foi criada apenas na fixture local antes da instalação; continuou ligada ao mesmo OID e planejável após duas instalações.
- Foram preparados calls posicionais de 1 a 8 argumentos e uma chamada nomeada omitindo profissional, email e consentimento. A chamada nomeada válida também foi executada com dados sintéticos, gerando hold normal e sem consentimento de marketing; a transação foi revertida.
- Os pontos de chamada atuais do cliente enviam os oito argumentos por nome. O wrapper delega os oito explicitamente à função de grupo. Não foi preciso alterar frontend, tipos gerados ou outras RPCs.
- Omissão de parâmetros pode causar ambiguidade se houver outros overloads com o mesmo prefixo de tipos. A fixture confirmou esse risco introduzindo um overload somente dentro de uma transação de teste, capturando `ambiguous_function` e revertendo-a. Nenhum overload foi adicionado ao instalador ou removido automaticamente.
- `pg_depend` registra dependências estáticas, como views e funções SQL com corpo analisado. Referências em PL/pgSQL/dynamic SQL podem não aparecer; os pontos de chamada versionados também foram inspecionados.

## Evidências e reprodução local

`python3 scripts/qa-saas2-defaults.py` usa exclusivamente o contêiner local fixo `booking-repair-test`. Cria um banco novo, copia **somente schema** de outra fixture local, aplica seed de desenvolvimento e insere apenas registros sintéticos. Não aceita URL de Supabase.

O teste reproduz o 42P13 do instalador antigo, comprova rollback sem instalação parcial, executa o bundle corrigido duas vezes, verifica OID/defaults/grants/dependência e compara fingerprints de customers, bookings, booking_items, payments e financial_transactions antes/depois. Depois executa a regressão completa `supabase/tests/saas2.local.sql`, incluindo pagamento verificado idempotente, RLS e fila. Resultado versionado em `defaults-validation.json`.

O bundle foi regenerado por `node scripts/build-saas2-sql.mjs` e conferido com `node scripts/build-saas2-sql.mjs --check`. Não houve execução de migration nem escrita no Supabase real.

## Instalação manual em produção

1. Atualize a cópia do repositório para a correção publicada. Faça backup das definições/schema antes de executar SQL.
2. Execute **somente a consulta de leitura** [`supabase/saas2-function-audit.sql`](../../supabase/saas2-function-audit.sql). Ela lista assinaturas/defaults/retornos/grants, dependências da função e possíveis conflitos entre overloads. Não lê clientes nem agenda. Confira a tabela acima; se houver nomes, tipos, retornos ou defaults diferentes dos documentados, guarde o resultado e revise antes de substituir. Não apague overloads para forçar a instalação.
3. Se a mesma sessão ainda retornar `25P02` após a tentativa anterior, encerre a transação falhada com `ROLLBACK;` e comece uma nova execução.
4. No SQL Editor do projeto correto, execute o **conteúdo completo atualizado** de [`supabase/saas2-install.sql`](../../supabase/saas2-install.sql), do `BEGIN` até `COMMIT`. Não execute o script de testes ou seed local em produção. Não reutilize a cópia antiga do instalador.
5. Repita a auditoria de leitura. `create_booking_hold` deve ter oito argumentos, um obrigatório, sete defaults, retorno jsonb, SECURITY DEFINER e o search_path fixado. Compare OID, dependências e grants com o resultado anterior. O bundle notifica o PostgREST para atualizar o schema.
6. Valide pelo site/painel com uma reserva de teste somente quando autorizar essa gravação real. Confira hold de 15 minutos, preço/sinal, disponibilidade e leitura no painel. A aplicação deste SQL não deve alterar reservas/recebimentos existentes. `pending` continua sem significar pagamento recebido.

O bundle é transacional e idempotente. Se a tentativa anterior foi executada inteira dentro da transação fornecida, o erro abortou essa transação; se trechos foram executados separadamente, a nova execução cobre objetos já existentes sem reconstruir seus dados. Se outro erro aparecer, preserve a mensagem completa e o resultado da auditoria, sem usar comandos destrutivos.
