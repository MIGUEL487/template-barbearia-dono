# Reproduzir QA local

Nenhum comando desta seção deve apontar para um banco real. Use Node >=22.6, dependências do lockfile e Chromium/Playwright disponíveis. As scripts deste ambiente usam `/usr/bin/chromium`.

```sh
npm run lint
npm run typecheck
npm run tokens:check
npm run test:saas2
npm run test:security
```

Build do dono com as variáveis públicas de uma fixture: `npm run build:cf`. Cliente: `npm run build`. Nunca copiar a chave fictícia da documentação/testes para o Cloudflare.

- `node scripts/qa-saas2-ui.mjs`: copia o source para um diretório temporário, sobe Next dev isolado e um Supabase HTTP de fixture. Testa as Server Actions de verdade, gráficos, filtros, metas, encerramento e fila nas quatro larguras; membros/roles inválidos e erro de banco. Não usa `.env` local nem chave de IA real; remove a fixture no final.
- `node scripts/qa-saas2-management.mjs`: usa páginas do build e API interceptada para regressão das oito áreas existentes em desktop/celular.
- `node scripts/qa-saas2-notifications.mjs`: requer build com VAPID pública de fixture; valida service worker, som, Realtime, deduplicação e permissão simulados. Não registra subscription real.
- No cliente, `npm run test:saas2`: serve `out/` localmente e intercepta as requests Supabase. Varia quantidade de profissionais, pessoas, percentuais, fusos e fila. O build precisa estar atualizado.
- Hero/landing do cliente: servir `out/` em `127.0.0.1:8792`, depois executar `node scripts/qa-saas2-hero.mjs` e `node scripts/qa-saas2-landing.mjs`.

SQL: `supabase/tests/saas2.local.sql` é **somente para fixture PostgreSQL local com seed de teste**, roda em transação e termina com rollback. Usa usuário local `999...999` e shop `111...111`, sem dados reais. Neste ambiente foi usado o contêiner `booking-repair-test` / banco descartável `saas2_qa`, preparado a partir das migrations/fixtures anteriores; o bundle novo foi aplicado duas vezes antes dos testes. Não execute o arquivo de testes no SQL Editor de produção.

`python3 scripts/qa-saas2-concurrency.py` tem alvo fixo nesse contêiner/banco, abre duas conexões e remove somente seus registros locais identificados. Precisa de Docker local. Não aceita URL de Supabase como argumento.

`node scripts/build-saas2-sql.mjs --check` confere que o SQL único corresponde às migrations; não o executa. `wrangler deploy --dry-run` empacota, sem publicar. Evidências visuais usam fixtures e não comprovam produção ou entrega de push físico.
