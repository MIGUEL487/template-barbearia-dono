# Auditoria inicial — 26/10/2026

Branches limpas `work` usadas como base; trabalho isolado em `redesign-black`. Dois projetos Next 14.2.18, React 18, Tailwind 3, Supabase; não há script de testes JS. CI usa Node 22; ambiente Node 24.

## Confirmado no código
- Cliente: page.tsx usa `currentPage` sem URL; agendamento e consulta usam views/RPCs públicas. Consulta já lê query string dentro de Suspense.
- Tokens reais cinza, ADR diz âmbar, hash e caminho no SYNC desatualizados. Sem interruptor de tema encontrado; adotado dark-only.
- Imagens externas e textos muito pequenos; fontes dependiam do Google bloqueado pelo proxy. Fundação usa fontes locais redistribuídas pelos pacotes Fontsource com licenças preservadas.
- `fixMojibake` existe; não remover sem validar dados externos. Não é possível provar encoding de dados remotos sem acessar o banco. Novos dados serão UTF-8.
- Dono: autenticação SSR e filiação no dashboard; ações confiam em RLS/RPC. Acrescentar verificação explícita no servidor.
- Webhook NÃO confere valor pago, ignora erros de escrita e NÃO é atômico. Documentação existente exagera garantias. Corrigir rejeição de valor e registrar limite de concorrência; não declarar pagamentos prontos sem testes de banco.

## Limites e plano
Nenhum banco será acessado, nenhuma migration aplicada e nenhum deploy executado. Usar placeholders autorais em SVG, demo somente no cliente; nenhum bypass no painel. Ordem: fundação → dados → cliente → dono → marca → Cloudflare → QA. Fotos/logotipo final, horários completos, equipe e preços reais pendentes. Fatos fornecidos no briefing não foram verificados externamente.

## Saída da auditoria
A fotografia inicial acima descreve o código antes do redesign. A entrega final migrou para Next 15.5.28 / React 19.3.1 e OpenNext 1.20.13, com cookies SSR assíncronos. Dependências e lockfiles revalidados; consulte os relatórios finais, não os números da fase legada.


## Design branco — nova auditoria (2026-10-27)

Referência clonada e fixada em `9e3ee14` (Template-padaria). Revisados os players, Hero, Story, plugin de scroll, componentes UI e os documentos CUSTOMIZE, desktop-gsap, native-video-review e reading-pause. A pausa é de 1 segundo desde o quadro apresentado, não desde o progresso do scroll. PC possui um decodificador; móvel usa forward/reverse e sticky nativo.

Novo ZIP: 183 JPEGs, todos 1920×1080, nomes reais ezgif-frame-001.jpg a ezgif-frame-183.jpg. Não há frames móveis próprios: derivar recorte central 720×1280 e registrar essa limitação. Cena de atendimento fornecida para demonstração; não afirmar que retrata a equipe real da Auto Stilo. Imagens.zip é idêntico ao pacote anterior: seis PNGs e dois MP4s; preservar fotos/identidade já integradas, sem criar fachada falsa.

Mantidos Next, export estático/Workers no cliente e OpenNext no dono; contratos Supabase e handlers não devem mudar. Sem deploy ou banco real. Escala de espaçamento de 8 px preservada. Skills locais animate, frontend-design, high-end-visual-design, design-taste-frontend e webapp-testing disponíveis; imagegen-frontend-web contém aviso de migração, sem geração de fotografias. Animate contém somente instruções, não o catálogo original. A direção explícita do usuário prevalece sobre restrições estéticas divergentes das skills (roxo, degradês, serif itálica e navegação).
