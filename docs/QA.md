# Como repetir o QA local

Use Node 24, Chromium instalado e dependências via npm ci. Nenhum teste abaixo deve usar banco real.

## Cliente
`NEXT_PUBLIC_DEMO_WATERMARK=true npm run build` → `npm run preview:cf` → em outro terminal `npm run test:qa`. O script testa 360/390/768/1024/1440 e paisagens 844×390 e 800×360, rola de verdade, salva capturas, completa wizard, testa consulta/cancelamento simulado, foco e reduced-motion. TEST_BASE_URL permite outra porta local. CHROMIUM_PATH escolhe Chromium. CPU 4× aplicada no CDP durante scroll, não na rede.

## Painel com fixture isolada
1. `node tests/mock-supabase.cjs` (HTTP sintético em 127.0.0.1:54329).
2. Build Bash: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-fixture-not-a-real-key NEXT_PUBLIC_DEMO_WATERMARK=true npm run build:cf`.
3. Criar .dev.vars IGNORADO com as mesmas URL/anon sintéticas. Para testes de assinatura rejeitada, usar MERCADOPAGO_ACCESS_TOKEN=local-fixture-not-a-real-key e MERCADOPAGO_WEBHOOK_SECRET=local-test-fixture-only. Nenhum desses valores é credencial real.
4. `npm run preview:cf` (8788), `npm run test:qa` (35 telas), `npm run test:authorization` (nega sem filiação antes da RPC e permite owner até mock) e `npm run test:security` (3 testes de assinatura).
5. Remover somente .dev.vars de fixture criado pelo teste e refazer build sem variáveis sintéticas antes de entregar. Não apontar fixture, scripts de teste ou seed para banco real.

Scripts auxiliares do ambiente usados no axe e geração de pranchas estão em /workspace/qa; Playwright dos testes acima está nos manifests dos repositórios. Resultados de fixture não validam o backend Supabase, e scans axe não substituem revisão manual/leitor de tela. Provas de desempenho só valem para os placeholders e a máquina testada.

Pare e reinicie o preview Wrangler após cada rebuild: o manifesto de assets de uma sessão antiga pode referenciar hashes que já não existem. Nunca rode o QA ou inspector enquanto o diretório de build está sendo reescrito.
