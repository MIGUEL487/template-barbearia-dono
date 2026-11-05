# Ativação controlada

O código não executa migrations em build, navegação ou deploy. Não use as chaves fictícias dos testes em produção.

Se a tentativa anterior retornou `42P13` em `create_booking_hold`, use a versão corrigida e siga [CORRECAO-42P13.md](CORRECAO-42P13.md). Antes da instalação, a consulta `supabase/saas2-function-audit.sql` permite conferir defaults, dependências e overloads sem ler dados de clientes.

## 1. Banco — revisão e execução manual

1. No projeto Supabase `jrzabortkpouqkwndpcq`, faça um backup/exportação antes de mudar funções. Confirme a barbearia `11111111-1111-1111-1111-111111111111` e o vínculo do proprietário em `shop_members`.
2. Confirme que a instalação existente tem as migrations de base/paridade, incluindo `working_hours.lunch_start/lunch_end`, `payments.method`, `site_settings.deposit_percentage`, `consents` e as tabelas de agenda. **Não reaplique seeds nem todas as migrations históricas cegamente.**
3. Confira configurações inválidas antes da nova constraint:

```sql
select barbershop_id, deposit_percentage
from public.site_settings
where deposit_percentage < 0 or deposit_percentage > 100;
```

4. Revise e cole **somente** [`supabase/saas2-install.sql`](../../supabase/saas2-install.sql) no SQL Editor. Ele reúne quatro migrations novas em uma transação: políticas, contrato de reserva, inteligência e fila. É idempotente; não contém dados de seed, mensagens, jobs ou alterações retroativas de valores financeiros. Se houver erro, interrompa e guarde a mensagem; não apague funções/tabelas para “forçar”.
5. Registre em seu controle de migrations a aplicação dos quatro arquivos `20261105000000` até `20261105030000`; não execute depois outra cópia divergente deles. O bundle é gerado por `node scripts/build-saas2-sql.mjs` e conferido por `--check`.
6. A constraint do percentual é `NOT VALID` para preservar linhas históricas; novas/alteradas são verificadas. Quando a consulta de valores inválidos estiver vazia, você pode executar manualmente:

```sql
alter table public.site_settings validate constraint site_deposit_percentage_bounds;
```

7. Não habilite RPC de confirmação de pagamento para anon/authenticated. O contrato de hold mantém pagamento pending; somente o mecanismo servidor verificado ou a operação administrativa autorizada pode registrar recebimento. Este trabalho não ativa cobrança real.

Novas tabelas: `daily_goals`, `day_closings`, `ai_daily_usage`, `waitlist_entries`. RLS por owner/admin da loja; anon não lê essas tabelas. Inscrição pública é somente por `join_waitlist`, com validação, limites e consentimento. Oferta é `offer_waitlist`, exclusiva para owner/admin. Nunca publique a service-role key.

## 2. Variáveis dos dois projetos no Cloudflare

Confira em **Build variables**, nos dois projetos, o mesmo:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://jrzabortkpouqkwndpcq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<a mesma chave pública anon do projeto>
NEXT_PUBLIC_BARBERSHOP_ID=11111111-1111-1111-1111-111111111111
NEXT_PUBLIC_DEMO_MODE=false
```

A marca d’água continua independente, por `NEXT_PUBLIC_DEMO_WATERMARK` e texto existentes. Mudar NEXT_PUBLIC exige novo build. No painel, preserve a `NEXT_PUBLIC_VAPID_PUBLIC_KEY` real já configurada; os testes usaram uma chave pública fictícia e não alteram sua configuração. Preserve os secrets existentes de push/pagamento, sem copiá-los para NEXT_PUBLIC.

No Worker do dono, confira também as variáveis/secrets de runtime necessários aos Server Actions. **Opcional:** `GEMINI_API_KEY` como **secret de runtime do Worker**, sem prefixo NEXT_PUBLIC e nunca no repositório/site estático. Sem essa chave, não há chamada ao provedor e o Raio-X determinístico permanece funcional. O limite diário depende do SQL acima; se a cota não puder ser validada, o servidor não chama o modelo.

Google Analytics não foi instalado. Áudio do assistente, WhatsApp, jobs e envio de campanhas continuam inativos.

## 3. Código, build e publicação

O prompt autoriza merge seguro após QA. As bases/backups e o resultado remoto devem ser conferidos com Git; não use force push e não mexa em main. O push em master pode disparar automaticamente Workers Builds configurado no Cloudflare. **Não execute um segundo deploy manual simultâneo.**

No painel Cloudflare, confirme o SHA da master, o build de produção concluído e a URL do deployment. Para revisão de branch, copie a URL de preview mostrada pelo próprio Cloudflare — não invente um endereço a partir do nome da branch. Se falhar, copie: SHA, nome do projeto, Build command, Deploy command, Non-production branch deploy command, primeiro erro completo e 30 linhas anteriores. Não envie valores de secrets.

Empacotamentos locais foram testados com `npm run build` (cliente), `npm run build:cf` (dono) e Wrangler dry-run. Isso não comprova deploy remoto ou configuração do banco real.

## 4. Validação no ambiente publicado

1. Entre como proprietário; confira a identidade da loja. Uma conta de outra loja não deve ver análises/metas/fila desta loja.
2. Em Configurações, teste 0%, 50% e 100% e restaure o valor desejado. No site público, recarregue/retorne à aba, confira sinal e restante. R$ 50 com 50% deve solicitar R$ 25. Com zero, deve informar que não há sinal obrigatório.
3. Crie uma pré-reserva de teste **somente quando autorizar a escrita real**. Confira no banco/painel status hold, expiração de 15 minutos, preço de catálogo, itens, buffers e sinal. Não trate pending como dinheiro recebido. Alterar o percentual depois não deve mudar essa reserva.
4. Com um profissional ativo, a primeira etapa é Serviço; com dois, Profissional; com zero, não é possível reservar. Confira os painéis horizontais, CTA e marquee na homepage.
5. Compare Análises com `financial_transactions` e bookings do período. Caixa usa data do lançamento; agenda usa data do serviço, em Brasília. Experimente filtros e gráficos.
6. No Raio-X, escolha serviço/data e compare slots com o agendamento. Cadastre meta, gere encerramento duas vezes e confira uma linha por loja/data. Antes do fechamento do expediente, o relatório é parcial.
7. Na fila, escolha data/janela sem expediente e confirme recusa; em data com expediente, cadastre preferência com consentimento. Quando houver vaga, consulte e ofereça pelo painel; prioridade anterior elegível deve impedir furar fila. Duplo clique não pode duplicar reserva. Hold vencido pode ser reavaliado; booking confirmado/concluído não volta à fila só porque o prazo antigo passou.
8. Campanhas/assistente não podem enviar mensagens nem criar reservas. Sugestão de upsell não pode mudar cobrança automaticamente.
9. Revalide notificações no Android/iPhone instalado, som após clique e atualização da agenda. Testes locais não substituem entrega push em aparelhos físicos.

Mantenha a reserva de teste identificada e use os fluxos normais de cancelamento/conciliação; não apague registros financeiros para limpar um teste.
