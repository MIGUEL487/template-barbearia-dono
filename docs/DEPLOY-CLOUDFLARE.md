# Cloudflare Workers — guia de entrega

Nenhum deploy ou conta foi criado. Use Workers com Git integrado (Workers Builds), não a conversão automática do framework. A branch de trabalho é `redesign-black`; só promova depois de revisar os testes e limitações em security-report e PERF.

## Cliente estático
1. No Cloudflare, criar/conectar um Worker ao repositório cliente e à branch desejada.
2. Instalar com `npm ci`, Node 22 ou 24. Comando de build: `npm run build`; deploy: `npm run deploy:cf`.
3. `wrangler.jsonc` aponta para `out/`, sem Worker próprio. `not_found_handling: "404-page"` serve o 404 exportado (não usar fallback SPA).
4. Build variables: `NEXT_PUBLIC_DEMO_MODE`, `NEXT_PUBLIC_DEMO_WATERMARK`, `NEXT_PUBLIC_WATERMARK_TEXT`, contato opcional, `NEXT_PUBLIC_SITE_URL`. Modo real também precisa URL/anon/ID público do Supabase. Nunca service_role no cliente.
5. `npm run build` prepara imagens e snapshot das views públicas apenas quando configurado; `postbuild` gera `out/_headers` com hashes dos scripts inline, CSP e noindex condicional. `_headers` não é configuração de Next. Editar o gerador, não o arquivo gerado.
6. Validar localmente: `npm run preview:cf` (porta 8787), `/`, `/agendar/`, `/meu-agendamento/?token=demo`, rota inexistente e cabeçalhos.

## Dono com servidor
1. Criar/conectar outro Worker ao repo dono. Não rodar conversor automático: já existem `open-next.config.ts` e `wrangler.jsonc`.
2. Build: `npm run build:cf`; deploy: `npm run deploy:cf`. O primeiro comando faz Next build e adapta com `--skipNextBuild`, evitando build duplicado.
3. Binding ASSETS para `.open-next/assets`; entrada `.open-next/worker.js`; `nodejs_compat`. Cliente: data 2026-10-26. Dono: data 2026-10-27, com o adaptador atual.
4. Build variables públicas: URL/anon do Supabase e opções da marca. Runtime variables: URL/anon, `ADMIN_BASE_URL` com domínio real. `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `RESEND_API_KEY` ficam em **Settings → Variables and Secrets**, como secrets do Worker. Nunca prefixar segredos com NEXT_PUBLIC.
5. Para preview local, criar `.dev.vars` ignorado a partir de `.dev.vars.example` e preencher com segurança. `npm run preview:cf` usa porta 8788. Não commitar valores, não colocar token do Cloudflare no repositório.
6. Não basta abrir login: validar cookies SSR, renovação, logout, acesso sem sessão, server actions com papéis distintos, webhook com assinatura e repetição/concorrência em banco demo autorizado. Não aplicar seed/migrations em banco real sem autorização.

## Versões e compatibilidade
Next 15.5.28, React 19.3.1 e OpenNext 1.20.13. O adaptador declara suporte a Next >=15.5.28 <16 (ou >=16.4.1). A combinação legada 14.2/1.6 foi substituída durante o QA de segurança. Cookies SSR usam a API assíncrona do Next 15. Não usar o antigo workaround de data 2025 no Worker atual. `npm audit` final: zero alertas nos dois repositórios, sem --force.

## Vindo da Vercel
| Na Vercel | No Cloudflare |
|---|---|
| Projeto conectado ao Git | Worker conectado em Workers Builds |
| output Next gerenciado | Cliente: out/; dono: OpenNext Worker + assets |
| Environment Variables | Build variables para NEXT_PUBLIC, secrets do Worker para credenciais |
| Preview Deployment | Worker separado por branch, com nomes e secrets isolados |
| Domínio no projeto | Settings → Domains & Routes; validar DNS e HTTPS |
| Promote/rollback | Deployments → versão anterior → rollback; conferir migrações separadamente |

Crie Workers separados para previews de branch; não compartilhe banco ou credenciais de produção. Confirme o fluxo de branches disponível na sua conta antes de ativar builds. Não há URLs publicadas nesta entrega.

## Segurança, indexação e entrega
`_headers` vale para assets estáticos; respostas do Worker dono usam headers() do Next. Não assume que _headers protege server actions. CSP do cliente usa hashes; painel usa inline script por exigência do Next sem nonce (limitação documentada). Sem `_redirects`: rotas exportadas têm trailing slash e redirect externo não é necessário. Não usar curingas para resolver problema de autenticação.

Trocar marca/dados: alterar Build variables, rebuildar e publicar, depois verificar HTML, robots e X-Robots-Tag. Após venda, confirmar preços, equipe, horários completos, fotos/logotipo e Instagram antes de desligar demo/indexação.

Referências oficiais: https://developers.cloudflare.com/workers/static-assets/headers/ ; https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/ ; https://opennext.js.org/cloudflare/get-started . A consulta direta foi bloqueada por 403 neste ambiente; schema e runtime locais serão usados como evidência, sem afirmar revisão online da documentação atual.

## Evidência local da configuração
Cliente: build estático passou, Workers local serviu 200 e 404 correto, CSP com hashes e noindex verificados; wizard demo concluiu em 390 e 1440 sem chamada remota. Dono: build:cf gerou worker.js; login retornou 200 e dashboard sem sessão redirecionou 307. Login autenticado, ações e webhook de pagamento completo ainda exigem testes específicos (ver relatório final). Nenhum resultado local implica deploy publicado.


## Hero branco / transporte de mídia

Os arquivos estão preparados e versionados, sem FFmpeg no build. No preview Workers deste ambiente, `Range: bytes=0-31` em GET retornou 200 e o MP4 inteiro. Portanto o hero usa **frames por padrão**. `?renderer=video` habilita os players nativos para diagnóstico; `?renderer=frames` força o fallback. Não mudar o padrão para vídeo até verificar 206/Content-Range na URL publicada. Não foi feito deploy nem validado domínio de produção.

JPEGs têm hash no nome e cache imutável; manifesto revalida. MP4s sem hash têm cache curto (não imutável). CSP permite media-src self e img-src blob exclusivamente para a alternativa HTMLImageElement do decoder. Sem afrouxar script-src ou acesso ao banco. Vídeo maior preparado: 7.573 MB, abaixo do limite conhecido de 25 MiB por asset; o limite foi confirmado na fonte oficial atual (https://developers.cloudflare.com/workers/platform/limits/#static-assets, fonte cloudflare-docs/production/src/content/docs/workers/platform/limits.mdx consultada em 2026-10-27). Limites adicionais: 20.000 assets no plano Free e 100.000 no Paid; 2.000 caracteres por linha de _headers.

Windows: instalar FFmpeg e ffprobe via `winget install Gyan.FFmpeg`, abrir novo terminal e executar `node scripts/encode-hero-video.mjs` (cliente); `--desktop-gsap` gera GOP 15 e sem B frames. Importadores originais estão em scripts para consulta. Preservar src/config/frames.json idêntico a public/frames/manifest.json após reimportar; o importador original de PC atualiza o manifesto público, então copie para src/config antes de build. Os 183 frames móveis atuais são recorte central dos horizontais; substitua por material próprio para direção móvel específica.
