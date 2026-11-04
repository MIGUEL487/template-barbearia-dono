# Rollback visual do dono

Backup remoto: backup/pre-premium-experience-20261104 → c158a6eed9e5d4be358df1f1916207c30571f754.

Usar checkout limpo. Neste ambiente usar /workspace/template-barbearia-dono-visual, pois /workspace/template-barbearia-dono tem alterações funcionais pendentes que devem permanecer intactas.

```sh
git fetch origin
git switch master
git merge --ff-only origin/master
git revert 276bb90
git revert 7c7f45c
git revert 50f81be
git push origin master
```

Restaura UI/fontes/manifest e apresentação anteriores, sem alterar Supabase ou reescrever histórico. Testes/docs podem permanecer. Se houver alterações posteriores conflitantes, preservá-las ao resolver e repetir os checks.

Cloudflare: Workers & Pages → projeto do dono → Deployments → conferir deployment anterior identificado por c158a6e e usar Rollback. A existência desse deployment não foi confirmada por este ambiente. Não executar reset, force push ou SQL para voltar o visual.
