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
