# Agenda: ocupação por intervalo

Branch fix-agenda-ocupacao. Sem merge na master; aguarda aprovação.

## Causa comprovada

O código anterior de src/app/agenda/page.tsx tinha array fixo `08:00, 08:45, 09:30, 10:15...` e comparava `new Date(b.starts_at).toLocaleTimeString(...) === time`. Por isso 09:00 e 17:00 eram contados no cabeçalho, mas nunca encontrados na grade. A consulta não carregava ends_at/hold_expires_at, não carregava expediente/bloqueios/fechamentos e usava limites de data sem fuso. Não era possível calcular sobreposição nem expiração.

## Correção

- working_hours do barbeiro e dia selecionado determina início/fim e passo de 30 minutos. Almoço, is_off, closed_days e time_off produzem rótulos Almoço/Folga/Fechado/Bloqueado, sem Disponível.
- Consulta bookings usa starts_at < início do próximo dia e ends_at > início do dia em UTC, a partir de 00:00 America/Sao_Paulo. Para 29/10/2026: intervalo [2026-10-29T03:00Z, 2026-10-30T03:00Z). Inclui reservas atravessando meia-noite.
- Cada slot usa slot_start < booking.ends_at && slot_end > booking.starts_at. Reserva aparece em todos os slots sobrepostos, sem duplicar o diálogo de gerenciamento. Múltiplas reservas no mesmo slot são todas exibidas.
- Nome/serviços continuam nos componentes existentes; acrescentado rótulo de status. Hold recebe Pré-reserva (hold); cancelado mostra Cancelado · não bloqueia. Hold expirado é oculto e não entra na contagem. Completed ocupa o histórico; cancelled/no_show não bloqueiam.
- Cabeçalho conta reservas válidas uma única vez e informa a data selecionada, em vez de hoje. Relógio local reavalia expiração a cada 30 segundos. Reload consulta os dados novamente; não foi adicionado Supabase Realtime.
- Respostas antigas de consultas são descartadas quando uma consulta mais nova começa. Falhas de consulta mostram erro e ocultam a grade, sem anunciar todos os horários como disponíveis.
- Opções de horário do agendamento rápido também vêm da grade disponível. A RPC administrativa continua sendo responsável pela validação atômica na escrita.
- Sem expediente cadastrado, não inventa funcionamento; indica Fechado. Reservas fora do expediente continuam visíveis, estendendo a grade até seus intervalos.

Nenhum CSS, classe, componente de navegação, fonte, cor ou animação foi alterado. Apenas dados, mapeamento de intervalos, atributos data-* para teste e rótulos de estado. Hold usa as cores já existentes de reserva, distinguido pelo rótulo; não foi criada paleta nova.

## Permissão de time_off

A migration inicial habilitava RLS em time_off sem política de leitura do painel. O arquivo `supabase/migrations/20261029000000_agenda_time_off_read.sql` contém política idempotente para authenticated ler somente bloqueios de barbeiros da própria barbearia. É proposta, não aplicada em Supabase real. Se essa política equivalente ainda não existir no projeto, executar este arquivo no SQL Editor depois de revisar; sem ela, Supabase pode devolver lista vazia sob RLS mesmo havendo bloqueios. Não concede acesso anônimo.

## Evidência de testes e limites

`node scripts/qa-agenda-grid.mjs`: IDs reais informados de Carlos e Jeronimo, data 29/10/2026, reservas 12:00Z e 20:00Z (=09:00/17:00 BRT), duração 45 minutos, fronteiras de sobreposição, almoço, hold expirado, cancelamento, fechamento, folga, bloqueio parcial, reserva atravessando meia-noite e limites do dia de São Paulo.

`node scripts/agenda-fixture.cjs` e `node scripts/qa-agenda-browser.mjs`: backend local exclusivo para QA, build apontando para http://127.0.0.1:54331 com chaves fictícias e Next local em 3005. Usa os IDs e horários informados, sem conexão ou login no Supabase real. Desktop/celular com fuso Asia/Tokyo precisam exibir 09:00/17:00 ocupados ao selecionar 29/10 e continuar exibindo após reload. Expiração da fixture é futura para não mascarar a ocupação; a expiração real é testada separadamente no teste puro.

Não foi possível consultar as reservas reais: a sessão não recebeu credenciais do Supabase do dono. Não se afirma validação de banco remoto por causa de uma fixture. Para validar no preview autenticado: selecionar 29/10/2026, conferir nomes/serviços/status nos slots 09:00/09:30 e 17:00/17:30, almoço 12:00/12:30, recarregar e repetir. Holds já vencidos não devem aparecer ocupando a agenda.

## Arquivos

- src/app/agenda/page.tsx — consultas, grade, contagem e rótulos.
- src/lib/agenda-grid.ts — funções de intervalo, expiração e dia de São Paulo.
- supabase/migrations/20261029000000_agenda_time_off_read.sql — proposta de leitura RLS de bloqueios.
- scripts/qa-agenda-grid.mjs — testes de regras.
- scripts/agenda-fixture.cjs e scripts/qa-agenda-browser.mjs — teste local da tela.
- docs/AGENDA-OCCUPANCY.md — causa, validação e limitações.

Preview: obtido pelo build automático de branch quando disponibilizado pelo Cloudflare. Não fazer deploy manual nem merge na master antes da aprovação do usuário.
