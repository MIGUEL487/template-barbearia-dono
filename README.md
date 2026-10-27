# Auto Stilo — redesign Black

Trabalho na branch `redesign-black`. Design preto/violeta compartilhado; nenhum banco real foi alterado e nenhum deploy foi feito.

Instalar com Node 24 (ou Node 22.6+) e `npm ci`. Desenvolver com `npm run dev` (cliente 3002, dono 3001). Cliente entra automaticamente em demo sem Supabase; painel exige login real e não tem bypass. Não executar reset/migrations/seed em banco real sem autorização.

Validar: `npm run typecheck`, `npm run lint`, `npm run tokens:check`, `npm run build`. Dono também tem `npm run build:cf`, `npm run test:security` e `npm run test:authorization` com fixture local. Preview Workers: `npm run preview:cf` (cliente 8787, dono 8788).

QA visual: `npm run test:qa`, com Chromium em `/usr/bin/chromium` (cliente aceita CHROMIUM_PATH). Dono requer mock local e build de fixture descritos no relatório; nunca usar credenciais reais nesse teste. Resultados e capturas em docs/qa.

Leia [relatório](docs/REPORT.md), [deploy Cloudflare](docs/DEPLOY-CLOUDFLARE.md), [marca d’água](docs/DEMO-WATERMARK.md), [segurança](docs/security-report.md) e [desempenho](docs/PERF.md). Next 15.5.28 + React 19.3.1; auditoria final sem vulnerabilidades conhecidas. Validar Supabase e pagamentos em ambiente autorizado antes de lançar.
