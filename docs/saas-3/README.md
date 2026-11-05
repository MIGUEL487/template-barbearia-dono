# Auto Stilo SaaS 3.0

## Entrega e limites

O painel preserva fontes, tokens, tema grafite e componentes existentes. O site público não foi alterado. Análises e Financeiro consultam o mesmo `financial_transactions`; não há um livro-caixa paralelo. Raio-X usa consultas autorizadas pelo usuário e loja resolvidos no servidor, Gemini existente e respostas estruturadas, sem SQL/HTML do modelo. WhatsApp continua demonstrativo, sem envio.

O build local usa credenciais fictícias. Os testes de interface usam um servidor Supabase HTTP sintético; os testes SQL usam PostgreSQL 17 em Docker e transações revertidas. Não comprovam o estado de dados, secrets ou deploy de produção. Nenhuma migration foi executada em produção.

## Instalação manual, em ordem

1. Faça backup do banco no Supabase e confira que o SaaS 2.0 corrigido já está instalado. Este instalador pressupõe `financial_transactions`, `bookings`, `shop_members`, `saas_can_manage` e as RPCs existentes. Se faltar a base, revise `docs/saas-2/` e `supabase/saas2-install.sql` antes; não rode scripts antigos indiscriminadamente.
2. Revise e execute **somente `supabase/saas3-install.sql`** no SQL Editor do projeto correto. É a cópia gerada da migration `20261106000000_saas3_experience.sql`, transacional e repetível. Não recria reservas/pagamentos e não remove funções. As policies e o trigger de proteção são substituídos de forma explícita.
3. Aguarde o reload de schema do PostgREST (o instalador emite NOTIFY), entre novamente com owner/admin vinculado em `shop_members` e teste uma loja de homologação. Sem a migration, Financeiro mantém leitura do ledger antigo, desabilita escrita e explica a pendência; chat oferece prévia determinística sem histórico e sem chamada Gemini.
4. Cloudflare Build variables: `NEXT_PUBLIC_SUPABASE_URL=https://jrzabortkpouqkwndpcq.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` pública do mesmo projeto, `NEXT_PUBLIC_DEMO_MODE=false`. Preserve `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e flags de marca d'água existentes. A resolução de loja do dono depende da sessão/membership, não de um ID global de ambiente.
5. Preserve **GEMINI_API_KEY somente como secret de runtime no Worker**. Não crie variável NEXT_PUBLIC para ela. O modelo existente continua `gemini-flash-latest` pelo SDK oficial; não houve troca de provedor. Ausência, timeout, erro ou cota esgotada geram resposta calculada identificada na tela.
6. O push da master dispara o fluxo Cloudflare existente; não há deploy manual simultâneo. Confira no Cloudflare o SHA publicado e o resultado do build. O ambiente de execução deste trabalho não consegue consultar a API/URL Cloudflare (403 de política de rede); confirmação remota depende desse acesso.

## Fluxos de validação

- Análises: Hoje/7/30/Mês/Personalizado, intervalo até 93 dias; teste um intervalo com registros e outro vazio, filtro de barbeiro, seleção de séries e data no gráfico, células do heatmap com mouse/teclado/toque. Desktop 1440/1024 e tablets/celular 820/390.
- Financeiro: registre compra de quantidade 2 e preço 20,00 (total 40,00), edite para 25,00 (50,00), anule com confirmação. Confira `financial_entry_audit`. Venda pendente não altera caixa recebido. Depois marque recebida. Vincular um agendamento com receita existente retorna a transação original, sem nova receita. Pagamentos automáticos são tratados pelo fluxo original e não têm edição/anulação manual. Exporte CSV, filtre categoria/tipo/status/data e pesquise descrição.
- Raio-X: nova conversa, perguntas sobre hoje, despesas, meta, disponibilidade, serviços e comparação semanal; recarregue, reabra, renomeie e exclua com confirmação. Teste outro gerente da mesma loja (não vê conversa privada), outra loja e usuário sem vínculo. O histórico mostra 100 conversas recentes e as últimas 200 mensagens por conversa; registros anteriores continuam no banco.
- Relatórios: abra após o início/fim do expediente cadastrado; recarregue duas vezes. Deve haver no máximo um briefing e um fechamento por loja/data. Consulte Relatórios do expediente no chat. Não simule um job funcionando sem ninguém abrir o painel.
- Resgate/Fila: oportunidades antes dos formulários; consulta de vagas e oferta seguem RPC existente, FIFO e concorrência. Nenhuma mensagem real enviada. Verifique também Configurações, agenda, agendamento do cliente, som e push existentes.

## Cálculos e integridade

Valores monetários agregados em centavos. Recebido = lançamentos income efetivados; saídas = expense + refund efetivados. Saldo registrado = recebido − despesas − estornos, **não lucro contábil**. Pendente/void não entra no dashboard, Análises ou contexto do Raio-X. Previsto = valor dos serviços em reservas válidas, não recebimento nem acréscimo ao recebido. Ticket = valor de serviços concluídos / atendimentos concluídos. A receita por serviço usa itens concluídos; não se apresenta como rateio contábil de recebimentos.

Ocupação usa união dos intervalos das reservas válidas, duração/buffer, expediente atual, almoço, folgas e bloqueios; histórico de capacidade é estimado com as regras atuais, explicitado na tela. Retenção usa visitas concluídas em dias distintos, sem inferir intenção de abandono. Comparação normal usa período anterior de mesma duração; pergunta de comparação da semana atual usa semana anterior completa, identificando que a atual é parcial. Datas em America/Sao_Paulo.

Lançamentos legados ficam `automatic/settled`. Lançamentos manuais mantêm data operacional em created_at ao meio-dia de São Paulo para compatibilidade do ledger; recorded_at e audit guardam o instante real. Excluir significa anular e preservar histórico. Escritas diretas por anon/authenticated são bloqueadas pelo trigger; RPCs autorizadas e fluxo SECURITY DEFINER de pagamentos existente permanecem funcionais (regressão SQL local).

## IA e relatórios

Perguntas limitadas, contatos/e-mails removidos antes da persistência de perguntas e do contexto generativo. Contexto agregado, sem nomes/telefones de clientes ou tokens de reserva. RLS autoriza owner/admin a cada operação e isola conversas por usuário+loja. ID de requisição impede processar novamente a mesma pergunta; limite SQL existente de 5 tentativas generativas/loja/dia, cache de 5 min por loja/contexto, singleflight por isolate, timeout 12s, sem retries automáticos. Resultados não executam operações administrativas.

Relatórios são **resumos determinísticos sem custo Gemini**, únicos por loja/data/tipo. Não há cron configurado: geração na primeira abertura após o horário; briefing hoje após início, fechamento hoje após fim ou do expediente anterior mais recente dentro de 7 dias. Sem acesso por mais de 7 dias não há backfill completo automático. Horários de barbeiros ativos e closed_days são considerados. São snapshots no instante de geração; não uma conciliação contábil nem promessa de dados finais imutáveis. A tela registra instante, modo e parcialidade.

## Verificação reproduzível

```
node scripts/build-saas3-sql.mjs --check
node tests/saas3.test.mjs
npm run test:saas2
npm run test:shop-gemini
npm run test:security
npm run tokens:check
npm run typecheck
npm run lint
npm run build:cf
node scripts/qa-saas3-ui.mjs
```

`python scripts/qa-saas3-db.py` exige o Docker local de fixtures `booking-repair-test`; não usa conexão remota. Evidências e resultados em `docs/saas-3/`. O QA de notificações precisa do build com chave pública VAPID de fixture; nunca copie chaves privadas para o bundle.

## Rollback seguro

Backup Git: `backup/pre-saas-3` (base 944c6c67b0963a426f5eb5fa84be72fdfbbeaba7). Reverta os commits de entrega com novos commits e push normal; não faça reset remoto nem force. Preserve mudanças posteriores/conflitos e valide antes de publicar. O site público é independente e não exige rollback.

**Não reverta/drope automaticamente o SQL ou os dados.** O código anterior não conhece pending/void e pode somá-los indevidamente. Se já houver lançamentos SaaS 3, mantenha `readLedger`/`settled` e os filtros no dashboard/source ao restaurar telas antigas, ou suspenda as escritas e prepare uma versão de compatibilidade. Não remova o trigger para permitir edição de pagamentos conciliados. Relatórios, mensagens e auditoria continuam preservados; nenhuma limpeza destrutiva é parte deste procedimento.
