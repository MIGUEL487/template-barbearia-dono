# Reservar o mesmo serviço para várias pessoas

Branch nos dois repositórios: `feat-fotos-reserva-grupo`. Sem merge automático.

## Instalação no Supabase real — ação manual sua

No SQL Editor do projeto `jrzabortkpouqkwndpcq`, execute **somente** o arquivo inteiro
[`20261101000000_group_bookings.sql`](../supabase/migrations/20261101000000_group_bookings.sql).
Depois publique/mescle a branch correspondente do cliente e aguarde o build.
Não é preciso trocar variáveis do Cloudflare. Nenhum SQL foi executado no banco real
durante esta implementação. A migração é idempotente e mantém as RPCs antigas.

Pré-requisitos: estrutura e funções de agendamento já existentes, incluindo
`expire_stale_holds`, `services.buffer_minutes`, horário/almoço/folgas e pagamentos
que o agendamento atual utiliza. Não rode `booking-repair.sql` inteiro novamente
apenas para instalar esta melhoria.

## Comportamento

- O site público usa `public_barbers.avatar_url`, igual ao agendamento. A foto
  cadastrada em Equipe no painel passa a aparecer na seção de barbeiros ao recarregar
  a página inicial. Foto ausente ou quebrada usa o mesmo fallback do agendamento.
- Na seleção de serviços reais, os botões −/+ escolhem de 1 a 6 pessoas por serviço.
  Preço, sinal, resumo e duração são multiplicados pela quantidade correspondente.
- Um responsável informa nome/contato e cria **uma pré-reserva** para o grupo,
  num intervalo contínuo com o mesmo profissional. Os atendimentos são sequenciais;
  não são dois horários simultâneos. Cancelar pelo token cancela o grupo inteiro.
- Cada pessoa gera um item imutável em `booking_items`; o painel existente recebe
  um booking hold com preço e duração totais. Pode listar o mesmo serviço repetido.
- Uma pessoa continua usando `get_availability` e `create_booking_hold`. Quantidades
  maiores usam `get_group_availability` e `create_group_booking_hold`, com os mesmos
  parâmetros existentes e IDs repetidos para representar unidades.
- As funções novas calculam preço e duração, incluindo preparação, a partir do banco;
  verificam loja, serviço ativo, quantidade, almoço, folgas, bloqueios e colisões.
  Reservas concorrentes continuam protegidas pela exclusão de intervalos do banco.
  A pré-reserva devolve token e expira após 15 minutos, como no fluxo individual.
- Se o SQL ainda não estiver instalado, a reserva de grupo falha com aviso e erro
  Supabase no console; não vira simulação nem reserva apenas uma pessoa escondido.
  O modo explicitamente demonstrativo mantém a experiência simulada existente.

## Validação

Cliente: lint, typecheck, build, tokens; Playwright em 1440, 390 e 320 px para uma
e duas pessoas, verificando as RPCs e os IDs repetidos, o preço de R$120 para dois
serviços de R$60, hold/token e a mesma imagem na home e no agendamento.
As imagens de QA são fixtures sintéticas, sem atribuir fotos reais a ninguém.

Dono: lint, typecheck, build:cf e tokens. Migração repetida em PostgreSQL local
isolado; teste `supabase/tests/group-booking.local.sql` verifica preço, duração,
dois itens, hold/expiração, bloqueio da agenda individual e de grupo, almoço,
folgas/bloqueios, fechamento, limite de quantidade e permissão anon.
**Nunca execute esse teste/fixtures no Supabase real.**

No site publicado: atualize uma foto em Equipe, recarregue a home e compare com o
agendamento. Escolha um serviço, aumente para duas pessoas, confira valor e tempo,
selecione profissional/data/horário e conclua com os dados do responsável. No painel,
selecione essa data e confirme um hold com dois itens e todo o intervalo ocupado.
