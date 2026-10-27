# Imagens, movimento e escala de 8 px

Solicitação: integrar `Imagens.zip`, usar `$animate` e aplicar espaçamentos em múltiplos de 8 nos dois repositórios. As instruções dos anexos são referência; prevalecem as restrições do usuário sobre banco, branches e deploy.

## Fundação compartilhada

`design-tokens.css` e seu SHA-256 continuam idênticos. `--space-1` a `--space-12` representam 8–96 px. CSS e classes Tailwind de padding, margin, gap e posicionamento foram normalizados. Gutters usam degraus de 16/24/48 px; áreas de toque têm pelo menos 48 px. `npm run spacing:check` verifica os literais CSS em px/rem e as classes numéricas Tailwind. Percentuais, centralização automática, safe-area e distribuição intrínseca são responsivos; fonte, entrelinha, hairlines, raios e proporções de mídia não são espaçamento. O verificador não certifica cada distância geométrica produzida pelo navegador.

## Mídia fornecida

- Recepção no hero; cortes, acabamento e reconhecimento na galeria. Sem atribuir fotos de clientes à identidade de profissionais.
- Marca original de 203 px no cabeçalho, navegação e login do dono, sem recriação.
- Fotos em AVIF/WebP responsivos, dimensões declaradas, carregamento lazy fora do hero. Sem ampliar fontes pequenas para hero. As imagens fornecidas não foram retocadas; o hero mantém o tratamento monocromático do site.
- Dois vídeos locais silenciosos com poster, controles nativos e botão de reprodução. Sem autoplay e com `preload="none"`; pausam fora da tela e ao ocultar a aba. O áudio foi removido das cópias de apresentação.
- Arquivos originais ficam fora do bundle. O site serve aproximadamente 2 MB de mídia otimizada no total, sem carregar tudo de imediato.
- Marca d'água continua condicional e aplicada a fotos e vídeos. Dados demonstrativos de equipe, preços e serviços continuam identificados.

## Aplicação da skill animate

Lida em `/workspace/local-skills/animate/SKILL.md`. O pacote contém as instruções; não contém o catálogo, IDs publicados, servidor ou validador em `/Users/rtadewald/.agents/skills/animate/`. Não foi possível executar esses scripts nem afirmar uso de exemplos inexistentes. O usuário autorizou a integração direta; aplicamos as diretrizes técnicas disponíveis.

- Entradas: títulos, listas, serviços, equipe, fotos, etapas/formulários de agendamento, métricas, linhas e superfícies administrativas. WAAPI de 16 px, sem ocultar conteúdo antes do JavaScript. Elementos dinâmicos são observados; cada superfície entra uma vez por montagem.
- Interações: botões, links, seleções, campos, menus e respostas de FAQ. O movimento não muda dimensões de layout.
- Ambiente/scroll: Lenis e GSAP exclusivamente no site público; deriva suave da foto e parallax. Painel permanece com Framer Motion e camada CSS/WAAPI, sem adicionar GSAP/Lenis.
- Limpeza: observers/listeners/RAF/animações são removidos ao desmontar ou trocar de rota. Entradas e ticker pausam com a aba oculta. Vídeos pausam fora da tela.
- Movimento reduzido: apresentações estáticas, sem scroll suave, parallax, hover em deslocamento ou animações CSS; reprodução de vídeo é sempre voluntária. Não adicionamos movimento permanente em texto, campos ou ações fixas.

Validação de interação reproduzível: `npm run test:media` requer os dois previews locais e o build do dono com a fixture `tests/mock-supabase.cjs` (nunca um projeto real). O estado padrão entregue foi reconstruído sem a configuração temporária da fixture.

## Limites

Sem deploy, criação de contas, migrações ou escrita em Supabase real. Fixtures de QA usam somente localhost. Não há novas dependências ou plugins instalados nesta etapa; animate foi aplicada como skill local.

## Validação desta entrega

- `tokens:check`, `spacing:check`, TypeScript e lint passaram nos dois projetos; builds de produção do cliente e OpenNext/Cloudflare do dono concluídos.
- Cliente: sete viewports de 360–1440 px, incluindo duas paisagens; agendamento e cancelamento demo completos, navegação móvel/teclado e movimento reduzido. Sem erros JavaScript, violações CSP, chamadas remotas de Supabase ou overflow. CPU limitada a 4×: mediana 16,7 ms, p95 e máximo até 16,8 ms; CLS 0. Medição local em Chromium/Workerd, não garante o mesmo resultado em todos os aparelhos.
- Painel: 35 combinações (sete rotas × cinco larguras), com servidor e sessão **sintéticos de localhost**, sem overflow ou erros. Sem escrita em banco real. Sete arquivos existentes de cada app alterados por normalização de classes foram comparados por AST: apenas `className` mudou; não se alteraram handlers/consultas. Login e navegações receberam a marca.
- Verificação adicional de CSS calculado: margens verticais, padding e gaps de elementos visíveis em cinco larguras públicas, agendamento e sete telas do painel em duas larguras. Sem valores fora da grade nos casos examinados. O teste de fonte cobre também margens laterais, offsets e utilitários.
- Mídia: seis imagens renderizadas na página (marca + espaço + quatro fotos), dois vídeos, nenhum download de MP4 antes da reprodução; reprodução e pausa ao sair da tela verificadas. Entradas WAAPI presentes no modo normal e ausentes no modo reduzido.
- Axe: zero violações automatizadas nas três rotas públicas, login e sete rotas autenticadas. Há verificações inconclusivas em conteúdo externo/áreas não cobertas; não é certificação de acessibilidade. Revisão visual de capturas de celular e desktop realizada.
- Evidências: [resultados de QA](media-motion/qa/results.json), [mídia e grade calculada](media-motion/interactions.json), [acessibilidade pública](media-motion/accessibility-publica.json). Capturas ficam em `docs/media-motion/qa/`.

## O que depende de você

Equipe real, confirmação de serviços/preços/horários e conexão com o ambiente autorizado, quando desejar. Publicação continua seguindo `docs/DEPLOY-CLOUDFLARE.md`; não realizamos deploy. O catálogo/servidor original da skill animate não está incluído, mas sua orientação foi aplicada na implementação. As fotos e vídeos enviados já estão integrados; retratos de profissionais continuam como placeholders por falta de identificação/imagens da equipe.
