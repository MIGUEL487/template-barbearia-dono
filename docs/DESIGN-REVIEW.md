# Refinamento minimalista — revisão de design

## Escopo e método
Somente design na branch redesign-black. Capturas de produção antes das mudanças, rolando a página de verdade: cliente (landing, agendar, meu-agendamento) e dono (login, dashboard, agenda, clientes, serviços), em 390 e 1440 px. Painel protegido capturado com fixture HTTP e sessão sintéticas locais, sem acessar Supabase real. Nenhum bypass foi adicionado.

## Comparação tipográfica
Fraunces, Newsreader e DM Serif Display comparadas em 390 e 1440: capturas em `design-review/fontes/` no cliente. Escolha: **Fraunces 400/500 + Manrope 400**. Fraunces oferece proporções largas/naturais, formas abertas e leitura menos vertical; Newsreader ficou delicada para o fundo preto e DM Serif Display mais pesada nas citações/preços. Acentos `ã á â é ê í ó ô õ ú ç à` e `R$` incluídos nos espécimes e conferidos visualmente. Não usamos script ou família condensada.

Fontes por next/font/google, subsets latin, display swap, autohospedadas no build. Duas famílias, três pesos no total. Assets e pacotes locais de Bebas Neue removidos. Tokens neutros idênticos e hash SHA-256 atualizado nos dois repositórios; violeta fica reservado a ações/foco, sem sombras coloridas.

## Etapas locais
1. Tokens e tipografia.
2. Composição do site público e movimento mais discreto.
3. Densidade e superfícies do painel.
4. QA, capturas depois e relatório.

Nenhum push intermediário: publicação Git apenas após validar as quatro etapas. Configuração Cloudflare, rotas, dados/demo/seed, RPCs, hold, segurança, SEO e interruptores da marca d’água preservados.

## Site público
Hero reduzido a um título, frase, imagem e dois destinos já existentes. Removidos halo que seguia o cursor, recorte inclinado, lettering repetido no rodapé, cardápio com seta redundante e foto duplicada na galeria. Serviços em linhas com duração discreta e preço alinhado à direita; equipe sem caixas decorativas. Galeria passa a grade no desktop e swipe no celular, sem pinning; avaliações mostram uma citação por vez, com avanço manual, sem autoplay. Apenas o hero mantém loop lento, pausado fora da viewport; parallax de 4% e revelação de 12px. Não se alteraram dados nem rotas de agendamento. Marca continua ativa pelo mesmo interruptor, com padrão mais leve e selo neutro.

## Painel administrativo
Sidebar e abas móveis preservadas. Superfícies sem sombras ou contornos coloridos, raios discretos, títulos de página em Fraunces e interface em Manrope. Métricas usam serif com cor neutra; gráfico conserva um só acento, sem gradientes. Ícones de navegação/ações são funcionais e foram mantidos; adornos dos cartões de métricas foram reduzidos. Login mantém os mesmos campos, avisos e autenticação, mas sem o círculo decorativo nem destaque itálico/colorido no título.

Nota e número de avaliações são exibidos diretamente dos mesmos dados, sem contagem transitória que pudesse sugerir uma avaliação diferente. Números animados permanecem no painel, onde comunicam a atualização das métricas.

## Preservação e cobertura
Os caminhos das rotas, hooks de agendamento/hold, dados demo/seed, bibliotecas Supabase e ações/API foram preservados; os arquivos protegidos listados no relatório de escopo foram comparados com a base e permanecem sem diferenças. Scripts de build/Cloudflare, wrangler, headers e DEPLOY-CLOUDFLARE.md também não mudaram. Só foram removidos os dois pacotes de fontes locais que deixaram de ser usados. `cobertura-e-escopo.json` registra essa verificação. FontTools conferiu todos os glifos `ã á â é ê í ó ô õ ú ç à R$` nas três faces utilizadas, sem ausências; os espécimes mostram a comparação visual.

## Escala final
Hero: Fraunces 400, até 68px no desktop e 42px no celular; títulos de seção 46/32px. Formulários de agendamento usam títulos 48/38px. No painel, títulos de página 32/28px para preservar densidade de trabalho, com números de destaque em serif e os demais títulos/controles em sans. Corpo 17–18px no desktop e 16px no celular; rótulos/legendas de 12–14px. Não há script nem fonte condensada sendo carregada.

## Capturas equivalentes

| Tela | 390 px | 1440 px |
|---|---|---|
| login | [Antes](design-review/antes/login-390.jpg) · [Depois](design-review/depois/login-390.jpg) | [Antes](design-review/antes/login-1440.jpg) · [Depois](design-review/depois/login-1440.jpg) |
| dashboard | [Antes](design-review/antes/dashboard-390.jpg) · [Depois](design-review/depois/dashboard-390.jpg) | [Antes](design-review/antes/dashboard-1440.jpg) · [Depois](design-review/depois/dashboard-1440.jpg) |
| agenda | [Antes](design-review/antes/agenda-390.jpg) · [Depois](design-review/depois/agenda-390.jpg) | [Antes](design-review/antes/agenda-1440.jpg) · [Depois](design-review/depois/agenda-1440.jpg) |
| clientes | [Antes](design-review/antes/clientes-390.jpg) · [Depois](design-review/depois/clientes-390.jpg) | [Antes](design-review/antes/clientes-1440.jpg) · [Depois](design-review/depois/clientes-1440.jpg) |
| servicos | [Antes](design-review/antes/servicos-390.jpg) · [Depois](design-review/depois/servicos-390.jpg) | [Antes](design-review/antes/servicos-1440.jpg) · [Depois](design-review/depois/servicos-1440.jpg) |

As capturas de página inteira foram feitas depois de rolar por todo o conteúdo; os arquivos `-inicio.jpg` registram a primeira dobra. O painel usa fixtures locais na comparação. Não representam sessões ou clientes reais.

A auditoria de acessibilidade revelou campos legados sem nome acessível em agenda, horários da equipe, filtros financeiros e configurações. Foram acrescentados apenas aria-labels descritivos aos campos existentes, sem alterar valor, validação, eventos ou ações. Também foram garantidos alvos de pelo menos 44px nos botões com ícone.

## QA de regressão
- Types, lint, build e tokens:check passaram nos dois repositórios; build:cf passou no dono. Os scripts de deploy não foram alterados.
- Painel: 35 combinações (7 telas × 360/390/768/1024/1440), sem erro JS nem overflow. Inclui verificação de fonte Fraunces nos títulos de página. Fixture local, sem operações em banco real.
- Site: fluxo demo completo em celular/desktop, consulta/cancelamento simulado, navegação por teclado e reduced-motion pelos testes já existentes; resultados desta rodada em design-review/qa-cliente.json.
- Avaliações: as cinco citações continuam acessíveis manualmente em 390/1440, uma por vez; botões e teclado verificados, sem erro JS nem overflow.
- Axe WCAG A/AA: zero violações automáticas nas três páginas públicas, login e sete telas protegidas verificadas. Itens inconclusivos (como conteúdo externo do mapa) e revisão por leitor de tela continuam exigindo julgamento humano; não é certificação de acessibilidade.
- Glyph coverage: nenhum caractere português ou R$ ausente em Fraunces 400/500 e Manrope 400.

## O que mantive e por quê
Mantive navegação, rotas, formulários, validações, agendamento/hold, contratos de dados, demo/seed, SEO, marca d’água e configuração Cloudflare porque já estavam corretos e estão fora do escopo visual. Mantive ícones que identificam ações ou destinos; removi adornos. Mantive as ilustrações de demonstração existentes, com tratamento neutro e referência aos LEDs muito reduzida; não inventei fotografias ou dados reais.

As quatro etapas têm commits locais; nenhum push intermediário foi feito. O envio dos dois repositórios ocorre somente depois da verificação final, pelo mesmo fluxo Git/Cloudflare existente. Não fiz deploy manual. Não há decisão bloqueante para este refinamento; fotos e conteúdo comercial reais podem ser atualizados em uma rodada própria.

## Fluidez — build de produção local, CPU 4×

| Viewport | Mediana ms | p95 ms | Máximo ms | CLS |
|---|---:|---:|---:|---:|
| 360×800 | 16.7 | 16.7 | 16.8 | 0.0000 |
| 390×844 | 16.7 | 16.7 | 16.8 | 0.0000 |
| 768×1024 | 16.7 | 16.7 | 16.8 | 0.0000 |
| 1024×768 | 16.7 | 16.7 | 16.8 | 0.0000 |
| 1440×900 | 16.7 | 16.8 | 16.8 | 0.0000 |
| 844×390 | 16.7 | 16.8 | 16.8 | 0.0000 |
| 800×360 | 16.7 | 16.7 | 16.8 | 0.0000 |

A mediana permaneceu em 16,7ms, sem piorar em relação à medição anterior; p95 até 16,8ms e máximo 16,8ms nesta execução. Nenhum frame acima de 50ms e CLS zero nos sete formatos. As fontes e imagens estão no build, servido por Wrangler local; não houve throttling de rede. Resultados desta VM com as ilustrações atuais, não uma garantia de desempenho em qualquer dispositivo/rede. A galeria não é mais pinned e há apenas um loop contínuo visível por tela, no hero, pausado fora da viewport.

`npm audit` não reportou vulnerabilidades conhecidas nesta rodada. O arquivo local de variáveis sintéticas usado nos testes foi removido e o build do painel foi repetido sem a fixture, preservando as configurações reais do projeto.
