# Contribuindo para o template-barbearia-dono

## Convenções de Código
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`).
- **Branches:** Crie branches temáticas (`feature/`, `fix/`).
- **TypeScript:** Modo estrito (`strict: true`). Sem tipos `any` implícitos.
- **Banco de Dados:** Todas as alterações de banco devem ser feitas através de migrations versionadas em `supabase/migrations/`.
- **Segurança:** A `SUPABASE_SERVICE_ROLE_KEY` deve ser usada exclusivamente em código executado no servidor (Route Handlers, Server Actions, Edge Functions). Nunca exponha chaves secretas no cliente.
- **Validações:** Antes de enviar um PR, assegure-se de que `npm run lint` e `npm run typecheck` passam localmente.
