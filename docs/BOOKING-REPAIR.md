# Diagnóstico do agendamento

Auditoria do código em 28/10/2026. Nenhum acesso ou escrita no Supabase real.

## Evidências

1. Os dois clientes usam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY, mas este ambiente não tem essas credenciais. Só há `.env.example` nos dois repositórios, sem `.env.local`/`.env.production`. Não foi possível comprovar os valores usados nos builds Cloudflare.
2. `cliente/src/lib/supabase.ts` escolhia silenciosamente `11111111-1111-1111-1111-111111111111` (seed de desenvolvimento). O seed Auto Stilo propõe `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`. Nenhum desses valores prova qual é a loja real. O cliente agora exige NEXT_PUBLIC_BARBERSHOP_ID válido antes de consultar.
3. `create_booking_hold` na migration sync recebia email NULL do cliente e inseria em customers.email NOT NULL. Corrigido com COALESCE no SQL consolidado.
4. As migrations não declaravam pgcrypto, mas criação/gestão usam gen_random_bytes e digest. O script declara a extensão e inclui extensions no search_path das funções que a utilizam.
5. A migration inicial de disponibilidade ignora almoço. O SQL consolidado usa o intervalo configurado, closed_days, time_off, is_off e reservas ativas. Não inventa expediente se working_hours estiver vazio. A criação do hold também revalida a disponibilidade, mesmo quando o visitante escolhe barbeiro específico.
6. O cliente chamava só create_booking_hold e exibia sucesso definitivo; não existe chamada de confirmação no checkout. Corrigido o texto para pré-reserva. Hold ajustado de 10 para 15 minutos. Cada hold agora registra payments pendente, necessário para a função de pagamento verificado.
7. Pagamento online ainda depende de implementação do checkout que cria cobrança real no provedor. O frontend estático não possui essa integração. Não se deve conceder a anon uma função que marque pagamento como aprovado. process_verified_payment continua exclusiva de service_role e o webhook valida assinatura e consulta o provedor.
8. is_shop_member JÁ era SECURITY DEFINER no SQL inicial. A justificativa de recursão no relatório anterior estava errada; o comentário foi corrigido.

## Chamadas do fluxo

| Etapa | Relação/RPC | Consumidor |
| --- | --- | --- |
| Catálogo | public_barbers, public_services, public_site_settings | use-live-booking.tsx |
| Horários | get_availability(uuid,uuid,date,uuid[]) | use-live-booking.tsx |
| Pré-reserva | create_booking_hold(uuid,uuid,timestamptz,uuid[],text,text,text,boolean) | use-live-booking.tsx |
| Gestão | get_booking_by_token(text), cancel_booking_by_token(text,text), reschedule_booking_by_token(text,timestamptz,uuid) | live-management.tsx |
| Confirmação paga | process_verified_payment(text,uuid,numeric) | webhook do dono; service_role |
| Agenda do dono | bookings → customers, booking_items; filtro barbershop_id de shop_members | agenda/page.tsx |
| Bloqueios | admin_block_time → time_off; closed_days; working_hours com almoço/is_off | admin-actions.ts |

Não existe uma RPC pública de confirmação de pagamento no frontend. Não foi inventada uma confirmação anônima para contornar a ausência do checkout.

## SQL Editor: ordem

1. Faça backup e confirme que o projeto é o usado pelos dois builds. Se o banco está vazio, aplique primeiro `supabase/migrations/20261021000000_initial_schema.sql`. Em banco já instalado, não reaplique essa migration: suas CREATE POLICY não são idempotentes.
2. Execute somente `supabase/booking-repair.sql` para as correções consolidadas (inclui schema do painel, disponibilidade, hold, gestão por token, RPCs administrativas, views, grants e confirmação pelo webhook). Não execute atualizar_banco_supabase.sql ou supabase_setup_completo.sql por cima: contêm alterações de conteúdo/seed e versões antigas.
3. Consulte, sem alterar dados:

```sql
select id, name, slug from public.barbershops;
select barbershop_id, user_id, role from public.shop_members;
select barber_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_off
from public.working_hours order by barber_id, day_of_week;
```

O ID da Auto Stilo real deve coincidir com NEXT_PUBLIC_BARBERSHOP_ID do cliente e com o barbershop_id do usuário autenticado do dono. Se faltar vínculo, precisa cadastrar explicitamente o usuário correto; o script não inventa conta ou vínculo. As telas do dono usam maybeSingle por user_id: múltiplas lojas por usuário ainda precisam de seletor de loja.

## Cloudflare e validação

- Ambos os builds: mesmo NEXT_PUBLIC_SUPABASE_URL no formato https://REF.supabase.co e mesma chave pública NEXT_PUBLIC_SUPABASE_ANON_KEY. Não usar dashboard URL ou service_role no navegador.
- Cliente: NEXT_PUBLIC_BARBERSHOP_ID com ID real; NEXT_PUBLIC_DEMO_MODE=false para gravar no banco. `true`/`True` e `false`/`False` agora são interpretados sem distinguir maiúsculas. Em modo demo a UI não persiste reservas.
- Dono: SUPABASE_SERVICE_ROLE_KEY só no servidor; MERCADOPAGO_ACCESS_TOKEN e MERCADOPAGO_WEBHOOK_SECRET para webhook real. Chaves de build NEXT_PUBLIC_* exigem novo build após alteração.
- Faça uma pré-reserva com email vazio: precisa retornar token e hold_expires_at em 15 minutos; a agenda do dono na mesma data/loja deve mostrar status hold. Agenda consulta sob demanda: atualizar a tela para ver alterações.
- Marque fechamento, folga, bloqueio e almoço no painel; recarregue horários no cliente. Slots correspondentes não devem aparecer, e tentativa de hold direto deve ser recusada.
- Confirmação paga real só pode ser validada depois de implementar/configurar a criação da cobrança. O webhook recebe confirmação assinada e deve mudar hold para confirmed; nunca simular pagamento aprovado em produção pelo navegador.
- Capture console `[Supabase]` e a resposta RPC (code/message/details/hint) se falhar. Remova tokens de gestão, telefones e dados pessoais antes de compartilhar.

## Limites de comprovação

Teste executado em PostgreSQL 17 Docker isolado, sem rede: migration inicial + booking-repair.sql duas vezes + seed local + testes em supabase/tests/booking-*.local.sql. Passaram disponibilidade → hold como anon com email NULL → process_verified_payment como service_role → leitura confirmed como dono sob RLS. Passaram almoço, time_off, is_off e closed_days; anon sem acesso direto a customers/bookings ou aprovação de pagamento. A chamada de aprovação nesse teste é fixture local, sem provedor. As fixtures nunca devem ser executadas no Supabase real.

Lint/typecheck/build verificam código, não provam configuração remota. Sem credenciais de produção não foi possível comprovar projeto/chave/loja/vínculo nem executar E2E nos sites publicados. Um teste PostgreSQL isolado, quando disponível, é evidência do SQL apenas; não comprova publicação Cloudflare ou pagamento real.
