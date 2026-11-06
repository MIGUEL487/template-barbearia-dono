# Raio-X 4.0 e experiência mobile

## O que mudou

Raio-X usa exclusivamente `analyze`, o livro-caixa e regras determinísticas compartilhadas entre o servidor do painel e o scheduler. Foram removidos chat ativo, geração, diagnóstico de provedores e leitura de secrets de IA. Chaves antigas podem continuar no runtime sem uso; não alteramos secrets. Conversas e tabelas legadas continuam no banco. Há consulta somente leitura do arquivo pessoal na página.

Recebido = entradas liquidadas pela data do recebimento; despesas/estornos são separados. Previsão = valor integral das reservas válidas, incluindo holds não expirados, podendo incluir dinheiro já recebido. Saldo registrado não é lucro contábil. Ticket = serviços concluídos / atendimentos concluídos. Ocupação usa união de intervalos, almoço, bloqueios e folgas; não soma sobreposições duas vezes. A capacidade histórica usa o expediente cadastrado atualmente, não um calendário histórico inexistente.

Meta é cadastrada por dia. Períodos somam apenas metas existentes, indicando quantas datas têm meta. Baixa ocupação tem limite configurável. Retenção exige três visitas em dias distintos e não prevê intenção. Comparação de cancelamentos exige dez registros em cada amostra. Regras da seção de oportunidades têm a data de referência explicitada; indicadores e comparativos superiores usam todo o período escolhido.

## Instalação manual em ordem

Não foi executado SQL em produção. Pré-requisitos: SaaS 2.0, SaaS 3.0 e `20261031000000_booking_push.sql` já instalados. Não reaplique instaladores antigos sem necessidade.

1. Revise e execute **`supabase/raiox4-install.sql`** no SQL Editor do projeto correto. É um upgrade idempotente, sem remoção de funções, tabelas, conversas, reservas ou pagamentos. Cria preferências, critério de ocupação e log do job. `node scripts/build-raiox4-sql.mjs --check` confere sincronização com a migration original.
2. Atualize a **mesma** Edge Function usada por reservas:

   ```sh
   supabase functions deploy send-booking-push --project-ref jrzabortkpouqkwndpcq --no-verify-jwt
   ```

   O webhook continua exigindo `x-booking-webhook-secret`. O tipo `RAIOX_TEST` valida o JWT usando `auth.getUser(token)` e exige owner/admin na loja; não confia no ID enviado pelo navegador. CORS só permite o domínio `https://template-barbearia-dono.mi-c-openheimer.workers.dev`. Para domínio próprio, configure manualmente `PUSH_ALLOWED_ORIGIN` na função com a origem HTTPS exata. A alteração não afeta webhooks servidor a servidor.
3. **Mantenha** os secrets VAPID e `BOOKING_WEBHOOK_SECRET` já existentes na função. Não gere um segundo par VAPID. O build do painel continua usando `NEXT_PUBLIC_VAPID_PUBLIC_KEY` correspondente. Nenhuma variável de IA é necessária.
4. Publique o Worker agendado separado do bundle OpenNext. Ele apenas gera snapshots e chama a função de push existente; não cria outra infraestrutura de subscriptions ou VAPID. Seu arquivo é `workers/raiox-scheduler/wrangler.jsonc`. Cadastre manualmente nele, usando o painel de secrets da Cloudflare ou os comandos interativos:

   ```sh
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config workers/raiox-scheduler/wrangler.jsonc
   npx wrangler secret put BOOKING_WEBHOOK_SECRET --config workers/raiox-scheduler/wrangler.jsonc
   npx wrangler deploy --config workers/raiox-scheduler/wrangler.jsonc
   ```

   Informe a service role do mesmo projeto e o mesmo segredo do webhook, somente no prompt seguro do CLI. Nunca os coloque em `NEXT_PUBLIC_*`, Git, URL ou chat. Não é necessário colocar VAPID nesse Worker. Estes comandos **não foram executados** nesta sessão: o ambiente não dispõe das credenciais externas e a tarefa proíbe alterar secrets.
5. Confirme no dashboard Cloudflare → `auto-stilo-raiox-scheduler` → Settings → Trigger Events que existe **`*/5 * * * *`**, e confira as invocações em Observability. O cron é UTC; o código resolve data e expediente em **America/Sao_Paulo**. O envio ocorre na primeira execução após a abertura/fechamento (até cinco minutos, sujeito a atraso da plataforma).
6. Configurações → Ativar notificações neste aparelho → **Relatórios e notificações** → escolha briefing/fechamento → Salvar preferências. O padrão é desligado, por consentimento. Depois clique **Testar notificação**. No iPhone use Safari → Adicionar à Tela de Início e abra o app instalado (iOS 16.4+).
7. Verifique o job com o painel fechado. No SQL Editor, somente leitura:

   ```sql
   select date,kind,generated_at,payload->>'version' as version
   from public.raiox_reports
   where barbershop_id='11111111-1111-1111-1111-111111111111'
   order by generated_at desc limit 10;
   select date,kind,result,error_code,created_at
   from public.raiox_job_runs
   where barbershop_id='11111111-1111-1111-1111-111111111111'
   order by created_at desc limit 20;
   select event_key,attempts,delivered_at,locked_until
   from public.booking_push_deliveries order by created_at desc limit 20;
   ```

   `push_accepted` significa que a função terminou sem falha retryable; **não** comprova exibição no sistema operacional (pode não haver destinatários elegíveis). `delivered_at` indica aceitação pelo provedor Web Push, não leitura pelo proprietário.

## Regra de expediente e retry

Primeira abertura efetiva e último encerramento entre profissionais ativos. Almoço e turnos distintos não geram notificações adicionais. Bloqueio integral/folga do profissional retira seu turno. Loja fechada via `closed_days` não gera relatório nem push. Feriados precisam estar cadastrados em `closed_days`: não se presumem feriados ausentes no banco.

O job considera hoje e o fechamento de ontem, recuperável por até 24 horas do horário previsto. Briefing de ontem não é enviado. Relatório é imutável e único por loja/data/tipo; concorrência usa `ON CONFLICT DO NOTHING`. Relatórios legados são preservados e não enviados como snapshots 4.0. Se a implantação ocorrer tarde, o snapshot é marcado `delayed` e mostra o estado observado naquele instante; não inventa uma fotografia retrospectiva do início do expediente.

Push usa a mesma `push_subscriptions`, VAPID, `claim_booking_push_delivery` e service worker das reservas. Preferências e membership owner/admin são consultados antes de enviar. Cada aparelho tem receipt; lease de 90s e no máximo cinco tentativas; falhas transitórias aguardam ao menos um minuto e o próximo cron. Respostas 404/410 removem subscriptions antigas. IDs persistentes no service worker evitam exibição repetida, inclusive após retry de uma execução interrompida. Há uma inevitável janela de falha entre aceitação pelo provedor e confirmação no banco: não existe garantia distribuída de entrega exatamente uma vez. IDs/tags e receipts reduzem duplicações; não se promete entrega offline, push bloqueado ou OS restrito.

O teste autenticado é limitado por ID de evento por usuário/loja/minuto. O service worker não intercepta fetch e não guarda assets; aceita somente rotas internas `/raio-x` (data/tipo validados) ou `/agenda`. Histórico mostra briefing/fechamento salvo, com destaque solicitado pela notificação.

## Escala e privacidade

Leituras são paginadas e falham explicitamente acima de 20 mil linhas, sem retornar totais parciais. A rotina processa lojas em sequência; para grande volume, particione a execução após medição. Logs não incluem contatos, endpoints, chaves, corpo de resposta de provedores ou dados de clientes. Payload do Web Push contém apenas título, quantidade agregada, rota e ID.

## Testes e limites reais

- `node tests/raiox4.test.mjs`: cálculos em centavos, janelas, domingo/folga/fechamento, holds expirados, sobreposições, agendamento sem painel, corrida de snapshots, retry, service worker e ausência de geração.
- `python scripts/qa-raiox4-db.py`: clone **local sintético**, instalação SQL duas vezes, preferências próprias, RLS entre lojas, anon negado, claims/deduplicação e regressão SaaS 2/3. O papel service_role local não possui o BYPASSRLS do Supabase; grants são conferidos e unicidade é exercida pelo dono do banco sem alterar papéis globais.
- `deno test --allow-env --allow-net=127.0.0.1 --allow-read --config supabase/functions/send-booking-push/deno.json supabase/functions/send-booking-push/index_test.ts supabase/functions/send-booking-push/report_test.ts`: transporte simulado, autorização, CORS restrito, consentimento, dedup, expiração e 404/410.
- `node scripts/qa-full-management.mjs`: Playwright com backend HTTP fictício, seis resoluções, indicadores, filtros, metas persistidas, gráfico, menu, agenda, clientes, equipe, serviços, financeiro, análises, resgate, fila, suporte, configurações, erros/vazios e login. Abrir painel não chama geração nem salva relatórios.

Android/iPhone físicos, teclado virtual real, credenciais de produção, configuração real do cron e entrega efetiva no aparelho **não estão disponíveis neste ambiente**. Precisam da sequência manual acima. Build e testes locais não comprovam push de produção. A revisão automática rejeitou CORS curinga; a implementação final usa a origem exata do painel.

## Rollback

Backup anterior: `backup/pre-raiox4-mobile-20261105` → `158923307e1de3e8d47fd327cc5335a1dc3d8a1c`. Use revert dos commits da funcionalidade e push normal, sem reescrever histórico. Para suspender os relatórios, remova/desative somente o cron do Worker agendado no dashboard, preservando a função de push das reservas. Não apague tabelas nem snapshots. A versão anterior ignora as tabelas adicionais. Atualizar o service worker não exige reinstalar o PWA; reabra o app para buscar a atualização.

Os tokens não foram alterados. `tokens:check` passou em cada repositório; os hashes entre cliente e dono já diferiam na base, com temas próprios. Não houve uma migração de tokens nesta etapa.
