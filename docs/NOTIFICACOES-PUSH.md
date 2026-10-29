# Notificações do painel — instalação e teste

Implementação na branch `feat-notificacoes`, sem merge na master e sem deploy manual.
O SQL abaixo **não foi aplicado no projeto real**. A entrega não configura contas,
secrets, webhook ou variáveis do Cloudflare automaticamente.

## 1. Gere as chaves e o segredo no seu computador

Na raiz do repositório do dono, com Node.js instalado:

```sh
npx --yes web-push@3.6.7 generate-vapid-keys --json
openssl rand -hex 32
```

Guarde `publicKey` e `privateKey` do primeiro comando. A saída do segundo é o
`BOOKING_WEBHOOK_SECRET`. Não publique a chave privada nem esse segredo em Git,
prints, links, logs ou variáveis com prefixo `NEXT_PUBLIC_`.

## 2. Configure o build do Cloudflare

Workers → projeto do painel do dono → Settings → Variables/Build variables.
Inclua **na branch de preview e, após aprovação, em produção**:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey gerada>
NEXT_PUBLIC_SUPABASE_URL=https://jrzabortkpouqkwndpcq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave pública desse mesmo projeto>
NEXT_PUBLIC_DEMO_MODE=false
```

Preserve as demais variáveis do painel. `NEXT_PUBLIC_DEMO_WATERMARK` continua
independente do push. A chave pública é incorporada no build: mudar a variável
exige um novo build. **Não coloque a chave privada, VAPID_SUBJECT ou o segredo do
webhook no navegador.** O cliente da barbearia não precisa dessas variáveis VAPID.
Não reutilize preview e produção como teste de aparelho: inscrições são por origem.

## 3. Execute UM arquivo SQL no projeto correto

Abra o SQL Editor de `jrzabortkpouqkwndpcq`. Confira primeiro:

```sql
select id from public.barbershops
where id='11111111-1111-1111-1111-111111111111';
select user_id,role from public.shop_members
where barbershop_id='11111111-1111-1111-1111-111111111111';
select to_regprocedure('public.is_shop_member(uuid)');
```

A loja deve existir, o usuário real do dono deve estar vinculado e a função não
pode retornar null. Depois copie **todo o conteúdo** de
[`20261031000000_booking_push.sql`](../supabase/migrations/20261031000000_booking_push.sql)
e execute uma vez. É seguro repetir esse arquivo. Não execute fixtures de `tests/`
no projeto real e não rode indiscriminadamente todas as migrações antigas.

Esse arquivo cria inscrições com endpoint único, RLS por usuário **e** vínculo de
loja, registro privado de entregas e claim atômico disponível só ao servidor.
O navegador só tem SELECT/INSERT/DELETE nas próprias inscrições; não tem UPDATE
nem acesso ao registro de entregas. A publicação `supabase_realtime` passa a incluir
`bookings`; as políticas privadas de leitura de bookings existentes são preservadas.
`REPLICA IDENTITY FULL` habilita o estado anterior quando a plataforma o fornece.
Como Realtime com RLS pode devolver só o ID antigo, o painel mantém também um
snapshot privado para classificar alterações sem inventar confirmações.

## 4. Configure os secrets e publique a Edge Function

Faça login no CLI do Supabase na sua máquina:

```sh
npx supabase login
```

Crie `.env.push-secrets.local` na raiz do repo do dono (o arquivo é ignorado pelo
Git) com seus valores reais:

```dotenv
VAPID_PUBLIC_KEY=<a mesma publicKey do build>
VAPID_PRIVATE_KEY=<privateKey gerada>
VAPID_SUBJECT=mailto:SEU_EMAIL_REAL
BOOKING_WEBHOOK_SECRET=<segredo hexadecimal de 64 caracteres gerado acima>
```

O subject precisa ser um `mailto:` real e válido ou URL HTTPS válida da sua
operação. Não use o endereço localhost como subject, especialmente para o Safari.

```sh
npx supabase secrets set --project-ref jrzabortkpouqkwndpcq --env-file .env.push-secrets.local
npx supabase functions deploy send-booking-push --project-ref jrzabortkpouqkwndpcq --no-verify-jwt
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos automaticamente pelo
ambiente da Edge Function hospedada. A função valida o header secreto antes de
acessar o banco. JWT do gateway fica desativado **somente nesta função**, pois o
Database Webhook usa o segredo próprio; isso não libera chamadas sem autenticação.
`web-push` e SDK Supabase têm versões fixadas em `deno.json`/`deno.lock`.

## 5. Crie o Database Webhook

No Supabase → Database → Webhooks → Create webhook:

| Campo | Valor |
| --- | --- |
| Name | `send-booking-push` |
| Schema/table | `public.bookings` |
| Events | **INSERT e UPDATE** |
| Type/method | HTTP Request / **POST** |
| URL | `https://jrzabortkpouqkwndpcq.supabase.co/functions/v1/send-booking-push` |
| HTTP header | `Content-Type: application/json` |
| HTTP header secreto | `x-booking-webhook-secret: <mesmo BOOKING_WEBHOOK_SECRET>` |
| Timeout | `10000` ms (ou maior, se a interface permitir) |

Mantenha o payload padrão do Database Webhook, com `type`, `schema`, `table`,
`record` e `old_record`. Não envie a chave privada VAPID como header. Não crie
webhook para a tabela `push_subscriptions` e não adicione outro webhook duplicado
para o mesmo envio. O webhook existente de pagamentos, se houver, é independente.

INSERT hold → **Nova pré-reserva**. Transição para confirmed → **Reserva confirmada**.
Cancelamento de hold/confirmed → **Reserva cancelada**. Mudança de profissional ou
início/fim em reserva ativa → **Reserva alterada**. Mudança apenas de notas,
completed/no_show/expired, evento antigo ou hold vencido não gera push.
Alterar só `booking_items` sem atualizar bookings não dispara este webhook.
Hoje a confirmação paga ainda não existe: uma pré-reserva continua sendo hold.

## 6. Abra a branch publicada e ative cada aparelho

Depois do build da branch no Cloudflare, abra o endereço de preview mostrado no
check **Workers Builds** do commit, ou em Workers → Builds → `feat-notificacoes` →
detalhes da versão → Preview URL. Esse endereço depende do projeto/conta: não é
possível deduzi-lo de forma confiável apenas pelo nome da branch.

Faça login e abra Configurações ou Agenda. Clique em **Ativar notificações** e
aceite o pedido do navegador. Nenhum pedido aparece automaticamente. A interface
deve passar a **Desativar neste aparelho**. Clique em **Ativar som**: ouvirá um
tom curto de teste. **Silenciar** desativa o áudio local sem desligar o push.
A escolha de som é lembrada por usuário/loja; após reabrir, o navegador pode exigir
uma interação neste acesso para liberar áudio novamente. O painel informa isso.
Som personalizado só toca com a página visível; o som do push com o site fechado
é definido pelo sistema operacional e suas permissões, não pelo MP3 do site.

### Android

1. Chrome atualizado, site HTTPS, login do dono. Instale pelo menu do Chrome se
   quiser; o Web Push no Android também funciona sem instalação.
2. Ative notificações e som. Pelo site do cliente, crie uma pré-reserva num horário
   futuro realmente disponível. Na agenda do dono, selecione esse mesmo dia.
3. Confira **Nova pré-reserva**, profissional/serviço/hora de Brasília, som e slot
   hold aparecendo sem atualizar a página. Não deve aparecer telefone no push.
4. Coloque o app em segundo plano/feche a janela e crie outra reserva. Deve chegar
   uma notificação do próprio site; tocá-la abre `/agenda`, com login se necessário.
   Encerrar à força o navegador pelo sistema pode suspender o recebimento.
5. Reenvie o mesmo evento de webhook: não deve gerar outro aviso/som. Eventos
   diferentes do mesmo booking (alteração/confirmado/cancelado) são avisos distintos.

### iPhone/iPad

1. iOS/iPadOS **16.4+**, Safari → site do dono → Compartilhar → **Adicionar à Tela
   de Início**. Abra pelo ícone instalado, faça login e ative notificações por clique.
2. Sem instalação, a interface mostra essas instruções e não tenta forçar a API.
3. Repita os testes aberto/fechado. Confira permissões do app instalado em Ajustes
   e se o modo Foco está suprimindo alertas. O iOS controla a entrega em segundo plano.
4. Clique no push e confira a abertura da agenda. Um app instalado por outra origem
   de preview precisa de inscrição própria; produção deve ser ativada separadamente.

### Casos adicionais

- Desative neste aparelho: a linha e a inscrição do navegador são removidas; outro
  aparelho continua ativo. Sair pelo menu do painel também desativa este aparelho.
- Negue permissão: a interface explica como liberar nas configurações; não pede de
  novo sem clique. Se mudar a permissão fora do site, reabra o painel.
- Feche/reabra: a inscrição continua ativa. Trocar a chave VAPID exige desativar e
  reativar os aparelhos, além de usar o mesmo novo par na função e no build.
- Revogue o vínculo em shop_members: o servidor deixa de enviar ao ex-membro,
  mesmo que exista uma inscrição antiga. Usuários não leem inscrições dos outros.
- O cliente hoje só cria holds; confirmação/cancelamento/reschedule foram cobertos
  por fixtures. Valide eventos reais adicionais quando esse fluxo existir.

## Operação, limites e manutenção

Payload contém apenas título, profissional, serviços, horário de Brasília e ID
opaco do evento. A função refaz a leitura do booking, ignora evento ultrapassado,
confere membros atuais e aceita endpoints HTTPS de provedores conhecidos. Respostas
404/410 removem inscrições. Erros temporários retornam 503 e liberam o claim para
nova tentativa; até cinco tentativas por evento/aparelho. **Não se presume retry
automático do Database Webhook**: um claim ainda em andamento também devolve 503;
se uma execução tiver sido interrompida, espere 90 segundos pelo vencimento do lease
antes de reenviar. Confira histórico/logs, e reenvie o mesmo payload
em caso de falha. Há deduplicação por evento/aparelho no banco e por evento no SW.
Uma falha de rede entre aceitação do provedor e gravação do recibo pode repetir o
transporte; o SW impede repetir a exibição durante a janela de retenção (48h,
superior ao TTL máximo de 15 min). Não é uma promessa de entrega exatamente uma vez.

Troque o tom de exemplo em **`public/sounds/prim.mp3`**, mantendo esse caminho e um
arquivo MP3 curto. O atual é um tom sintético original de 250 ms. PWA usa a logo
existente, com margem segura no maskable; `node scripts/prepare-pwa.mjs` regenera
os PNGs. O service worker **não intercepta fetch e não armazena arquivos offline**.
O pequeno IndexedDB guarda somente IDs de notificações para deduplicação.

Se nada chegar, confira nesta ordem: build com pública VAPID → permissão e inscrição
do aparelho em Configurações → linha em push_subscriptions → membro da mesma loja →
Realtime conectado/publicação bookings → histórico do webhook → logs da função.
Logs da função têm código/status e ID opaco, sem endpoints, chaves ou dados de cliente.

## Evidências e validação local

- `npm run lint`, `npm run typecheck`, `npm run build:cf`, `npm run tokens:check`.
- `node scripts/qa-notification-assets.mjs`, com `npm run preview:cf` local:
  assets acessíveis sem login, ícones/manifest, header no-store do SW, ausência de
  cache/fetch offline e agenda ainda protegida por login.
- `node scripts/qa-notifications-browser.mjs`: páginas compiladas, Supabase e APIs
  de inscrição simuladas, WebSocket Phoenix interceptado e worker real Chromium.
  Testa clique/permissão, inscrição/remoção, som, Realtime e atualização da grade,
  duplicatas e um evento push entregue ao SW via CDP; desktop 1440 e celular 390 px.
- `deno test --allow-env --allow-net=127.0.0.1 --config=supabase/functions/send-booking-push/deno.json supabase/functions/send-booking-push/index_test.ts`:
  autenticação do webhook, eventos, fuso, ausência de PII, claim/deduplicação,
  falhas/reenvio, 404/410, ex-membro e proteção de endpoints. APIs de envio mockadas.
- Migração aplicada duas vezes em PostgreSQL 17 **local isolado**, com fixtures
  `tests/push-rls-fixture.sql` e `tests/push-rls.sql`: autorização por usuário/loja,
  revogação, anon sem acesso, claim exclusivo e tentativa de UPDATE negada.
  O banco isolado não tem WAL lógico ativo; isso não testa entrega real do Realtime.
- Capturas em `docs/notifications`. Nenhuma gravação no Supabase real.

Pendências externas: suas chaves/secrets, execução do SQL, deploy da Edge Function,
webhook, build remoto e testes de entrega nos aparelhos Android/iPhone reais.
