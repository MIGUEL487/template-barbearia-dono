# Redesign integral Auto Stilo

Base 45cbd1b, branch feat/complete-management-redesign, backup backup/pre-complete-redesign. Código em 7aa7cff. O site público permaneceu sem alterações. O worktree original do dono com mudanças locais foi preservado e possui uma cópia adicional de recuperação em /workspace/preservation/owner-pre-complete-redesign (patch rastreado, arquivos não ignorados e manifesto). Hash do diff original: cdca2c3b4d01a20bc57fdd9a291057755dc0dc97b3035b9f77f601bf82c7c7bc.

## Cobertura de apresentação

| Área | Mudança concreta |
|---|---|
| Painel | Indicadores comuns, gráfico de área de recebimentos reais, resumo operacional lateral, lista do dia no mesmo sistema de superfícies |
| Agenda | Cabeçalho e resumo da data, filtros, colunas de profissionais, calendário, reservas e cadastro rápido padronizados |
| Clientes | Tabela, pesquisa, indicadores e perfil com contatos, observações e histórico já presente na consulta |
| Serviços | Catálogo em tabela, preço/duração/categoria, visibilidade existente e cadastro em modal compartilhado |
| Equipe | Seleção acessível de profissional, fotos, expediente/almoço/folgas, cadastro e disponibilidade no mesmo layout |
| Financeiro | Cabeçalho, navegação, tabela, formulário, gráfico e controles integrados à fundação global; ledger e auditoria preservados |
| Análises | Mesma arquitetura de página, controles, gráficos, heatmap e indicadores; cálculos preservados |
| Raio-X | Layout integrado, histórico, composer, relatórios e diagnóstico Gemini mantidos |
| Resgate | Layout compartilhado, oportunidades, campanha demonstrativa, expansão e consultas existentes |
| Fila | Gestão de encaixes integrada ao layout global; RPCs de prioridade/hold mantidas |
| Configurações | Navegação interna por seção, operação, pagamentos e notificações com campos padronizados |
| Suporte | Nova rota /suporte na sidebar, atalhos reais e FAQ compartilhado com expansão animada |
| Login e guardas | Acabamento da mesma fundação; autenticação e redirecionamentos existentes preservados |

O layout usa ManagementLayout em todas as áreas, inclusive via Workspace nas páginas SaaS 3. DialogPanel mantém dialog nativo, foco, Escape, entrada/saída e conteúdo durante fechamento; os modais de gestão deixaram de depender de overlays instantâneos. A sidebar mantém marca, fontes e lavanda, com densidade e grupos consistentes. Nenhuma tabela, política, function SQL ou RPC nova foi criada.

Os preços/durações no cadastro, a visibilidade dos serviços e as ações da equipe usam os contratos originais. Não foi inventado estoque, faturamento ou uma nova regra de negócio. O perfil de cliente apresenta apenas dados que a consulta autorizada já trazia; o total de serviços concluídos não é apresentado como caixa recebido.

## Verificação e correções de interface

`validation.json`, `contracts.json` e `evidencias/ui-results.json` registram os resultados. `PREVIEW.md` contém links de todas as páginas em desktop e celular, além de modais, perfil, calendário e FAQ. As capturas usam dados identificados de teste, não dados reais de clientes.

A comparação AST em `scripts/check-management-contracts.mjs` verifica que as chamadas de banco e Server Actions permanecem iguais à base nas seis páginas de gestão, Resgate e hook da equipe. As queries, as regras de reserva, holds, disponibilidade, autenticação, pagamentos, RLS e auditoria não foram reescritas.

A revisão encontrou três comportamentos relevantes corrigidos na camada de apresentação: Escape agora fecha o calendário com retorno de foco; uma falha de leitura em Equipe mostra operação indisponível e evita apresentar “aberta”/zero profissionais como se fosse dado confirmado; o rótulo da data espera a montagem no navegador para evitar hidratação divergente entre build e um dia diferente no aparelho. O teste de notificações usa relógio fixo e detectou essa regressão antes da publicação.

Checks concluídos: TypeScript, lint sem avisos, build Next/OpenNext, Wrangler dry-run; testes SaaS 2/3/3.1, assinatura de pagamentos, SDK/diagnóstico Gemini, tokens, contratos de chamadas; Playwright em todas as áreas, perfis, calendários, formulários, abertura/fechamento, foco/Escape, estados vazios e falhas deliberadas de leitura. Cadastro de serviço exercitou a Server Action real contra uma fixture HTTP local. Push, som, deduplicação e Realtime foram testados com eventos simulados. Não houve envio real de notificação nem escrita em banco externo.

```
npm run typecheck
npm run lint
npm run test:saas2
npm run test:saas3
npm run test:saas31
npm run test:shop-gemini
npm run test:security
npm run tokens:check
npm run build:cf
node scripts/check-management-contracts.mjs
QA_WIDTHS=1440,390 node scripts/qa-full-management.mjs
```

## Referência Figma e acesso pendente

O conector Figma não está disponível nesta sessão. A rede observada está restricted/enforced; as conexões anteriores retornaram CONNECT 403. A composição usa os padrões descritivos do adendo fornecido pelo proprietário. Não foi feita alegação de inspeção de frames ou reprodução pixel a pixel de um arquivo inacessível.

Foi salvo um **rascunho** de rede no ambiente Codex, preservando os domínios de fontes e adicionando: www.figma.com, figma.com, api.figma.com, api.cloudflare.com, generativelanguage.googleapis.com e ai.google.dev. A ferramenta confirmou status=saved e requires_publish=true. Isso não mudou a rede corrente, não configurou credenciais e não publicou o site. Para ativar, revise/salve a configuração e publique o ambiente Codex; depois confirme a conectividade. Acesso ao arquivo e ao Worker ainda exige autorização válida do serviço correspondente. Nenhuma chave foi solicitada em chat ou copiada para o navegador.

## Gemini e produção

A integração e o diagnóstico autenticado do SaaS 3.1 foram preservados e seus testes locais passaram. O secret já foi informado como configurado pelo proprietário; não assumimos ausência ou erro de configuração. Ainda falta a resposta real do Worker/Google para comprovar a causa do fallback. Após confirmar o deployment, use Raio-X → Conexão Gemini → Testar integração e confira modelo, origem do binding, categoria e HTTP, sem divulgar a chave. Instruções detalhadas em ../saas-3-1/README.md.

O push de master segue o fluxo automático Cloudflare existente. A URL/SHA publicada não pode ser declarada confirmada enquanto a API/ambiente não forem acessíveis. Build local e dry-run não comprovam deploy. Não foi executado deploy manual simultâneo nem alterada configuração Cloudflare.

## Rollback

Backup Git: backup/pre-complete-redesign (45cbd1b). Reverta o commit de apresentação 7aa7cff com um novo commit e push normal, preservando mudanças posteriores e resolvendo conflitos se houver. Documentação/testes podem ser revertidos separadamente. Nenhuma reversão SQL é necessária: não houve migration nem mudança de dados. Não use force/reset remoto, não exclua branches e não apague agendamentos, mensagens, relatórios ou auditoria.
