# Auto Stilo — painel refinado

Base remota: c158a6eed9e5d4be358df1f1916207c30571f754. Branch feat/premium-experience. Backup remoto: backup/pre-premium-experience-20261104. Commits de código: 50f81be + 7c7f45c + 276bb90. Destino master; main preservada.

## Escopo visual

Paleta grafite #17181B/#222329/#2C2D33, texto #F4F1EB, apoio #B9B6BF e acento roxo claro #BBA2F3. Tema aplicado por body.management-scope, sem alterar o contrato/hash do design-tokens.css. Outfit local para a interface e Cinzel no wordmark, com licenças oficiais incluídas.

Sidebar com seleção clara e ritmo de 8px; cabeçalhos mais legíveis, cards com superfícies menos saturadas, campos de 48px, botões com contraste, tabela com hierarquia e números tabulares, agenda com estados preservados e navegação móvel grafite. Loading com logo branca e status acessível, sem texto solto visível. Manifest/theme-color acompanham grafite; nome, ícones, start_url e service worker foram preservados.

A classe agenda-grid foi acrescentada apenas como gancho de estilo. Não foi alterada comparação de reservas, geração de horários, bloqueios, almoço ou consultas.

## Hidratação e apresentação

Os testes encontraram divergências de HTML/data anteriores ao redesign: seletor de data, gráfico de receita, rótulo de data da equipe e aviso de configuração do login. Textos dependentes do navegador agora são apresentados após mount, com placeholders estáveis no HTML inicial. A data da equipe é formatada em America/Sao_Paulo. O aviso do login verifica os mesmos campos públicos no cliente, sem renderizar no HTML uma exigência de service_role que só existe no servidor.

Não alterei getMissingAdminEnvVars, createClient, signInWithPassword, handlers de salvar, cálculos financeiros ou estado de data selecionada. Não usei suppressHydrationWarning. DatePicker conserva seus eventos e calendário; RevenueChart conserva agregação e período, alterando apenas a apresentação pré-hidratação.

## Trabalho pendente protegido

O checkout original /workspace/template-barbearia-dono estava na branch fix-agenda-administrativa-segura com correções funcionais e SQL não commitados. Ele não foi descartado, incorporado nem publicado. Trabalhei no worktree /workspace/template-barbearia-dono-visual a partir da master remota. Backup local adicional em /workspace/backups/owner-pre-premium: tracked.patch, status.txt e untracked.tar.gz.

SHA-256 do patch original antes/depois: cdca2c3b4d01a20bc57fdd9a291057755dc0dc97b3035b9f77f601bf82c7c7bc. A futura atualização da referência master não modifica o checkout sujo da branch de agenda.

## Validação

Lint, TypeScript, Next build + OpenNext build:cf e tokens:check passaram. Dependências foram instaladas localmente no worktree por npm ci com lockfile existente; nenhuma mudança de dependência foi introduzida. O primeiro build com node_modules por symlink falhou ao empacotar Sharp por resolver caminhos fora do worktree; a instalação isolada resolveu, sem alterar a configuração OpenNext.

qa-premium-management: dashboard, agenda, serviços, clientes, financeiro, equipe, configurações e login em desktop 1440 e celular 390. Campos de configuração/login foram preenchidos localmente, calendário da agenda aberto e fechado, sem overflow e sem pageerror/hidratação. Capturas em management/.

qa-premium-notifications: permissão somente por clique, salvar/remover inscrição, som, preferência persistida, Realtime atualizando agenda, deduplicação, evento push no service worker real via CDP, permissão negada e instrução de instalação no iPhone. Desktop/mobile passaram. Tudo com HTTP/WebSocket/PushManager interceptados e fixtures; não houve inscrição ou envio reais. Capturas em notifications/.

Testes HMAC existentes: três passaram. Não houve alterações em Server Actions, lib, Edge Function, RPCs, migrations, RLS, subscription/provider de notificações ou service worker. A bateria não equivale a login/reserva real ou entrega push em telefone físico; isso depende da configuração e homologação do ambiente publicado.

## Skills e publicação

high-end-visual-design, ui-animations, motion-design, web-animation-design e webapp-testing foram reutilizadas a partir das instruções já lidas nesta conversa. Nenhum scanner ou script desconhecido foi executado. Bibliotecas já existentes não foram tratadas como skills.

Push em master usa o fluxo Cloudflare existente, sem deploy manual em paralelo. O ambiente não permite consultar API GitHub/Cloudflare nem abrir workers.dev; hash remoto será conferido, mas deployment e URL de produção permanecem sem confirmação. Não alterei contas, secrets ou configuração Cloudflare.

## Revisão final de calendário móvel

O teste adicional com o calendário aberto encontrou overflow no popover: a centralização via translateX concorria com o transform da animação Motion. O commit 276bb90 ancora pela direita, sem transformação para centralizar, e limita a largura ao viewport. Também remove espaço superior desnecessário no header móvel em fluxo normal. A bateria completa foi repetida após esse ajuste, incluindo os oito destinos e notificações.
