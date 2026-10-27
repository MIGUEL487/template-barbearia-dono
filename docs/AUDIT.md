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
