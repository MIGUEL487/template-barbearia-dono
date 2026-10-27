# Relatório de entrega — Auto Stilo Black

## Estado
Trabalho em `redesign-black` nos dois repositórios, sem alterar main/master, sem push, sem deploy e sem conta criada. Um commit por etapa; correções encontradas no QA ficam no commit final. Não houve conexão, migration ou seed em banco Supabase real. A demonstração local foi preparada. O lançamento real continua dependendo de Supabase, pagamentos e dados finais validados; nenhum deploy foi feito.

## Antes → depois
- Paleta cinza/documentação âmbar → tokens black/violeta idênticos, hash e SYNC corrigidos, dark-only, fontes locais licenciadas.
- Navegação falsa por useState → landing por âncoras reais, menu móvel, scroll-spy, componentes por seção, hero de marca, catálogo editorial, equipe, galeria horizontal, avaliações, passos, contato/mapa, FAQ e CTA.
- Site sem dados → configuração Auto Stilo central, exemplos explícitos de preço/equipe, fallback readonly, wizard demo e consulta/cancelamento/reagendamento simulados sem gravar dados. Snapshot de catálogo via views quando configurado.
- Monólito do agendamento real → hook e cinco componentes de etapa; contratos de views/RPC preservados, sem gerar horários fictícios após falha real. Lógica da equipe separada em hook; menu e ações extraídos do painel.
- Painel com menus repetidos → navegação compartilhada, abas inferiores, menu Mais, filtro de profissional, diálogos de ações, skeletons, métricas e gráfico a partir de dados reais, números animados e controles de horário que cabem no celular.
- Sem proteção demo → marca removível por variável, camadas em imagens, selo, rodapé, título e noindex. Desligar marca não converte dados de exemplo em dados reais.
- Sem Workers → wrangler.jsonc nos dois, export estático no cliente, OpenNext no dono, headers/CSP e guia de build, preview, secrets, domínio e rollback.
- Webhook com gravações parciais → validação e RPC transacional proposta, falha segura enquanto migration não for autorizada/aplicada.

## Validação
Typecheck, lint, build e tokens:check passaram nos dois; build:cf gerou o Worker do painel. Preview local do cliente: 200, 404 correto, CSP e X-Robots-Tag; wizard concluiu sem chamadas Supabase. Painel: login 200, dashboard sem sessão 307; com fixture local, sete telas em cinco larguras (35 combinações), sem erro JS ou overflow. Teste de ação verificou recusa sem filiação antes da RPC e uma chamada de owner a RPC mock.

Cliente: sete formatos (360,390,768,1024,1440; paisagens 844×390 e 800×360), rolagem real, fluxo demo, foco, reduced-motion e capturas. Resultados em [qa/results.json](qa/results.json), capturas no mesmo diretório; desempenho em [PERF.md](PERF.md). Axe: zero violações automáticas A/AA nas páginas inicial, agendar demo, consultar demo e login; itens inconclusivos exigem revisão manual. Isso não é certificação de acessibilidade das telas administrativas autenticadas.

Assinatura: três testes unitários aprovados; webhook sem configuração 503 e com assinatura adulterada 401 no runtime Workers. Seed e migration novos passaram no parser SQL; PL/pgSQL, locks e RLS não foram executados em banco.

## Imagens e identidade pendentes
Placeholders SVG autorais baseados na arquitetura/LEDs, não fotografias. Nome tipográfico de apresentação, sem redesenhar o logo. [image-plan.md](image-plan.md) descreve enquadramento, camada e movimento para aplicar fotos e logo quando enviados. Serviços, preços e equipe são EXEMPLOS. Confirmar horários completos (apenas terça às 09h é informação fornecida), Instagram, nomes, preços/durações e identidade final. A marca d’água usa “SUA MARCA” até você informar seu nome/contato.

## Limites e decisões
- A migração final para Next 15.5.28 / React 19.3.1 / OpenNext 1.20.13 removeu os alertas de dependências: npm audit final sem vulnerabilidades conhecidas nos dois. Ver [security-report.md](security-report.md).
- Não validamos Supabase real, login/refresh/logout reais, RLS entre dois tenants ou pagamento de sandbox ponta a ponta. RPC transacional é arquivo proposto, NÃO aplicada. Pagamentos não estão prontos para operar.
- Strix instalado, mas scan não executado: faltam configuração LLM/chave. A revisão executada é manual + testes + audit. Nenhuma conta foi criada para contornar isso.
- Desempenho medido em VM local com placeholders e CPU 4×; fotos finais, rede móvel e aparelho real precisam de nova medição.
- Ainda há componentes legados extensos (equipe/formulários e partes do fluxo real), embora lógica, navegação e etapas tenham sido extraídas. Não foi reescrito todo o CRUD.
- Não há deploy ou URL publicada. Os comandos de deploy e as instruções estão prontos para você revisar; não publique enquanto os bloqueios acima persistirem.

## Skills e ferramentas
Skills dos anexos instaladas localmente em /workspace/local-skills, com links .agents/skills nos repos (configuração local ignorada pelo Git). Redesign segue design-taste-frontend, frontend-design e ScrollTrigger, com as exigências explícitas do briefing prevalecendo sobre proibições genéricas de roxo/luz/placeholders. Bibliotecas instaladas de pacotes npm oficiais. Strix em /workspace/tools/strix. ZIP grande do Playwright não pôde ser transferido; pacote oficial instalado e Chromium do ambiente usados. Inspira UI não foi adicionado ao React (é Vue).

Veja [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md), [DEMO-WATERMARK.md](DEMO-WATERMARK.md), [QA.md](QA.md) e [security-report.md](security-report.md).

## Migração final
Next 15.5.28 e OpenNext 1.20.13 substituíram a combinação legada. React e Motion atualizados; cookies SSR assíncronos. npm ci repetido para verificar os lockfiles. Build e QA repetidos na nova combinação; não se usa a antiga data de compatibilidade para mascarar incompatibilidades.

## Localização das capturas
Cliente: `docs/qa/landing-<largura>x<altura>-fold.jpg`, `-full.jpg`, `confirmation-...jpg` e `reduced-motion.jpg`. Dono: `docs/qa/<tela>-<largura>.png`. Os resultados brutos acompanham as capturas. O painel foi capturado com dados e sessão de fixture local, explicitamente não reais.
