# Rotação de BOOKING_WEBHOOK_SECRET sem interrupção planejada

## Estado real desta entrega

Foi preparado um novo segredo de 256 bits com `secrets.token_hex(32)`, sem imprimir seu valor. Os arquivos privados estão fora do Git, em diretório temporário 700 e arquivos 600. O valor não foi enviado a nenhum provedor, log ou relatório. Não tentamos recuperar o segredo antigo.

**A rotação em produção ainda não foi executada.** O ambiente não fornece acesso administrativo ao Supabase/Cloudflare. A branch `fix/booking-webhook-secret-rotation` contém apenas a preparação compatível e os testes. Nenhuma configuração incompleta foi publicada em produção. O segredo anterior não foi revogado porque a migração real ainda não foi confirmada.

Não há migration, SQL ou mudança de subscriptions/VAPID nesta entrega. O diretório privado deste ambiente é temporário; não baixe nem envie seus arquivos ao chat. Se executar de outro terminal, gere o pacote lá e use esse mesmo pacote em todas as etapas, sem misturar candidatos.

## Inventário verificado no código

| Serviço | Papel / autenticação | Ação necessária |
| --- | --- | --- |
| Supabase Database Webhook `send-booking-push` de `public.bookings`, INSERT/UPDATE | Emissor: header `x-booking-webhook-secret`; configuração descrita em `docs/NOTIFICACOES-PUSH.md` | Atualizar **apenas** o header secreto no webhook existente; não duplicá-lo |
| Cloudflare Worker `auto-stilo-raiox-scheduler` | Emissor: `env.BOOKING_WEBHOOK_SECRET` no mesmo header, evento `RAIOX_REPORT` | Substituir esse binding por secret, usando o mesmo valor novo |
| Supabase Edge Function `send-booking-push`, projeto `jrzabortkpouqkwndpcq` | Receptor de ambos os emissores | Aceitação dupla temporária; promoção e remoção da variável de transição depois dos testes reais |
| Painel do dono, botão Testar notificação | Envia `RAIOX_TEST` por JWT do usuário; exige owner/admin | Nenhuma troca desse segredo no navegador ou no Worker principal do painel |
| Site do cliente | Cria holds via Supabase; não conhece o segredo do webhook | Nenhuma troca de secret, build variable ou deploy necessário |

A configuração dos emissores em produção não pôde ser lida daqui. Antes de revogar, confira no dashboard se há outros webhooks/integrações apontando para a mesma função. Não é necessário nem apropriado extrair valores de headers do banco para isso.

## Contrato de transição

`BOOKING_WEBHOOK_SECRET` permanece como está, aceitando os emissores atuais. O receptor atualizado aceita também `BOOKING_WEBHOOK_SECRET_NEXT`, **somente se** o segredo principal continuar configurado e NEXT tiver ao menos 32 caracteres. Não há bypass por variável ausente ou header vazio. Comparações usam SHA-256 e acumulador sem saída antecipada por byte; valores e hashes não são registrados.

Durante a transição, o único log adicional é `[WebhookAuth] { credential: "primary" | "next" }`, sem header, fragmento, fingerprint, nome de cliente ou chave. `primary` significa o valor principal naquele instante, não necessariamente "antigo" depois da promoção.

A aceitação dupla é encerrada por uma etapa explícita após confirmação, **não por expiração automática**: expirar NEXT enquanto um emissor já o usa criaria uma interrupção. Sem confirmação dos dois caminhos reais, não promova nem remova nada. Não deixe a etapa de encerramento esquecida: registre responsável, testes e término nesta mesma janela de manutenção.

## Procedimento manual, em ordem, em terminal já autenticado

É necessário acesso a Supabase Secrets/Functions/Database Webhooks e ao Worker da Cloudflare. Não envie tokens ao chat e não use `--debug`, `set -x`, `cat` ou `echo` com os valores. As chaves VAPID existentes não participam da rotação.

1. Gere o pacote em **WSL, Linux ou macOS**, fora do repo:

   ```sh
   python scripts/booking-webhook-rotation.py create
   ```

   O comando mostra somente o caminho privado. Defina `ROTATION_DIR` com esse caminho, sem colocar o valor do segredo em variável de shell ou linha de comando. Os arquivos são: `next.env` (só NEXT), `primary.env` (mesmo valor novo como principal) e `scheduler.stdin` (para entrada segura do CLI).

2. Faça deploy **primeiro do receptor compatível desta branch**, mantendo todos os secrets atuais:

   ```sh
   npx supabase functions deploy send-booking-push --project-ref jrzabortkpouqkwndpcq --no-verify-jwt
   ```

   Sem NEXT cadastrado, o comportamento anterior fica preservado. Confira a próxima notificação normal antes de prosseguir. Não edite VAPID, service role, assinatura PWA, eventos ou endpoint do webhook.

3. Cadastre **apenas NEXT** no Supabase, deixando o principal desconhecido intacto:

   ```sh
   npx supabase secrets set --project-ref jrzabortkpouqkwndpcq --env-file "$ROTATION_DIR/next.env"
   python scripts/booking-webhook-rotation.py verify-next --directory "$ROTATION_DIR"
   ```

   O probe usa um tipo de evento intencionalmente inválido: `400 Invalid booking event` comprova que passou pela autenticação, antes de acessar banco ou push. `401` indica que NEXT ainda não foi aceito; **pare sem trocar os emissores**. Nenhum corpo, header ou secret é impresso pelo probe. Esse teste não substitui entrega real.

4. Supabase → Database → Webhooks → webhook existente de `bookings`: altere somente `x-booking-webhook-secret` para o valor novo de `scheduler.stdin`. Preserve URL, INSERT/UPDATE, payload e timeout. Use campo seguro do dashboard/gerenciador de senhas; não coloque o valor no SQL Editor.

   Para transferir sem imprimir o valor, um terminal WSL com acesso ao clipboard do Windows pode usar `clip.exe < "$ROTATION_DIR/scheduler.stdin"`; no macOS, `pbcopy < "$ROTATION_DIR/scheduler.stdin"`. Use clipboard sem histórico e limpe-o depois de colar. Não abra o arquivo em um viewer público nem envie captura desse campo. Esse passo é uma alteração da configuração da integração, não uma migration ou edição de dados/tabelas. Se sua restrição incluir também mudar a configuração do webhook, mantenha a rotação pendente: revogar o receptor sem atualizar esse emissor não é seguro.

5. No **Worker agendado existente** `auto-stilo-raiox-scheduler`, atualize somente o binding secreto:

   ```sh
   npx wrangler secret put BOOKING_WEBHOOK_SECRET --config workers/raiox-scheduler/wrangler.jsonc < "$ROTATION_DIR/scheduler.stdin"
   ```

   Não coloque esse valor em `vars`, Git ou `NEXT_PUBLIC_*`. Não crie um Worker vazio só para cadastrar o secret. Se ele ainda não existe ou faltam outras credenciais, conclua o provisionamento completo conforme `docs/raiox4/README.md`, mantendo o cron inativo até tudo estar pronto. Não altere chaves VAPID nem a service role como parte desta rotação.

6. Valide **os dois caminhos reais** e registre apenas horário/status/ID não sensível:

   - Aguarde uma reserva legítima criada normalmente pelo site, sem inserir ou alterar registros artificialmente. Confira o envio normal do webhook, o log `credential: next` e o recebimento de **Nova pré-reserva** no aparelho. A verificação local já cobre INSERT/UPDATE, privacidade, retry e dedup.
   - Confira o próximo relatório agendado realmente devido (ou a execução operacional autorizada do job existente), log `credential: next`, resultado do scheduler e notificação que abre `/raio-x`. **O botão Testar notificação usa JWT e sozinho não comprova a rotação do segredo do scheduler.**
   - Confirme que todas as configurações de emissores apontando para a função foram atualizadas. Aguarde requests em voo/retries do segredo anterior pelo horizonte efetivamente configurado e confirme ausência de chamadas `primary` antigas. Não existe prazo universal de retries; não apague filas nem use SQL para acelerar a transição.

7. **Somente depois dos dois testes reais e da drenagem**, promova o novo segredo e remova a aceitação anterior:

   ```sh
   npx supabase secrets set --project-ref jrzabortkpouqkwndpcq --env-file "$ROTATION_DIR/primary.env"
   python scripts/booking-webhook-rotation.py verify-next --directory "$ROTATION_DIR"
   npx supabase secrets unset BOOKING_WEBHOOK_SECRET_NEXT --project-ref jrzabortkpouqkwndpcq
   python scripts/booking-webhook-rotation.py verify-next --directory "$ROTATION_DIR"
   ```

   Ao atualizar o principal para o novo valor, o anterior deixa de corresponder a qualquer candidato, mesmo antes de remover NEXT. Depois do unset só o novo principal é aceito. Esta etapa não foi executada por falta da confirmação real. Como o segredo antigo é desconhecido, não existe rollback seguro para o valor antigo após essa promoção: faça-a somente com os emissores verificados.

8. Confirme novamente notificações normais e Raio-X. Guarde o novo valor em cofre aprovado, sem compartilhá-lo no chat; encerre a janela de transição, limpe clipboard e arquivos temporários privados. Não recrie subscriptions e não gere novas chaves VAPID.

## Falha antes de promover

Se algo falhar antes do passo 7, mantenha o principal antigo intacto **e NEXT cadastrado** enquanto houver qualquer emissor usando o novo. Ambos continuam aceitos e o diagnóstico pode prosseguir. Não dê unset em NEXT durante essa condição. Reverter para código antigo antes de completar a migração também rejeitaria os emissores novos; mantenha o receptor compatível enquanto resolver a configuração. Não faça mudanças cegas de secrets para tentar recuperar a operação.

## Testes executados / não executados

Testes Deno locais com backend HTTP e push fictícios: novo header no fluxo normal de booking e `RAIOX_REPORT`, compatibilidade com principal, JWT do teste independente, header ausente/incorreto, NEXT inválido, principal ausente, promoção, rejeição do anterior, dedup, erros transitórios e subscriptions 404/410. O probe não acessa o banco.

Não foram atualizados secrets do Supabase, header do Database Webhook nem binding Cloudflare nesta sessão. Não foram feitos deploy de função, mudanças em cron, SQL ou alterações de subscriptions. Notificações reais e retirada do antigo em produção continuam pendentes desses acessos e confirmações; testes locais não comprovam essa migração.
