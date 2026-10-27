# Segurança — revisão e evidências locais

## Escopo e fronteiras
Somente código dos dois repositórios, export estático e runtime Workers local. Nenhum banco Supabase real acessado, nenhuma migration aplicada e nenhuma conta/deploy criados. As fixtures HTTP e tokens sintéticos de testes ficam em tests/; não há bypass de autenticação na aplicação. Os testes não provam RLS de um banco real.

## Alterações e testes
- Migração final: Next 15.5.28, React 19.3.1, Framer Motion 14.7.0 e OpenNext 1.20.13. O trabalho começou na última 14.2.x e prosseguiu para a combinação suportada após o pedido para continuar. Cookies SSR adaptados à API assíncrona. A antiga falha CVE-2025-29927 e os alertas da linha 14 motivaram a migração.
- Server actions verificam usuário com auth.getUser, filiação à barbearia e papéis; configuração/equipe/serviços limitados a owner/admin. Vínculos de profissional e serviços conferidos no servidor. RLS/RPC continuam obrigatórios e não foram relaxados.
- Teste no Worker local: sessão sem filiação negada ANTES da RPC; owner acionou exatamente uma RPC simulada. Middleware sem sessão redirecionou ao login. Não representa teste de isolamento entre tenants em banco real.
- Webhook sem credenciais retorna 503; assinatura inválida retorna 401. Manifest HMAC oficial usa data.id, request-id e timestamp; não é HMAC do corpo bruto. JSON parseado de forma limitada; IDs conferidos; consulta autenticada à API oficial; BRL, referência e valor validados. Sem modo de pagamentos simulados em produção.
- Três testes unitários de assinatura passaram: válida; IDs/HMAC/headers adulterados; replay e formato inválido.
- Escrita de pagamento delegada a process_verified_payment, proposta em migration. Bloqueia reserva e payment, compara payments.amount e faz ledger/evento/status na mesma transação; execução restrita a service_role, search_path pg_catalog. NÃO aplicada. Sem a função o handler retorna 503; nunca retoma o caminho antigo de escritas parciais.
- SQL do seed e nova migration passou no parser pglast. Isso NÃO executa PL/pgSQL nem valida concorrência, constraints ou políticas em banco.
- CSP do cliente usa hashes dos scripts inline no _headers gerado; sem unsafe-eval. O painel mantém unsafe-inline em script/style por compatibilidade Next sem nonce; é limitação, não proteção completa contra XSS. Headers nos dois runtimes conferidos localmente. Nenhuma chave service_role em código público.
- Zod atualizado a 4.6.7. PostCSS 8.5.32 e glob 10.5.0 corrigidos por overrides direcionados; fast-xml-parser 5.11.2 no tooling legado. Builds e tipos revalidados após alterações; compatibilidade de serviços AWS externos não foi exercitada.

## Auditoria de dependências
Resultado final: **zero vulnerabilidades conhecidas reportadas pelo npm audit nos dois projetos**. Os números anteriores eram 2/17 na fase legada e não descrevem a entrega final. JSONs da execução em docs/qa/dependency-audit.json. Números incluem ferramentas de desenvolvimento e alertas herdados; não são uma prova de explorabilidade. Nenhum npm audit --force foi usado para ignorar incompatibilidades.

O bloqueio de dependências legadas foi resolvido com a migração. O adaptador atual declara suporte a Next >=15.5.28. Overrides direcionados atualizaram glob 10.5.0 também em @node-minify/core sem regredir o adaptador. Zero alertas no audit não equivale a um pentest completo nem valida configuração futura de produção.

## Strix e skills instaladas
Skills locais vinculadas em .agents/skills; origem nos anexos. Strix CLI 1.7.0 instalado em /workspace/tools/strix/bin/strix. Não há STRIX_LLM/LLM_API_KEY/STRIX_API_KEY configurados; nenhum scan autônomo Strix foi executado ou resultado inventado. Não criamos conta ou assinatura. Os relatórios acima vêm de revisão manual, testes e npm audit, não de um pentest Strix.

## Pendências antes de pagamentos reais
Autorizar e testar migration em banco demo dedicado; dois tenants e papéis reais para testes RLS/BOLA; duplicação e concorrência do webhook; credenciais de sandbox; checkout precisa gerar registro payment esperado. Reembolsos, pagamento de hold expirado, múltiplos pagamentos por reserva e conciliação precisam de política explícita. Login/refresh/logout reais e cookies em domínio HTTPS ainda não validados. Testar CSP com todos os destinos finais. Não usar esta entrega para receber pagamentos antes dessas etapas.
