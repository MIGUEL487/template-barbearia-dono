# Rollback sem reescrever histórico

Bases anteriores a este trabalho:

- Dono: `b7d99e95e04eadeb72f375a61aed2b65e09fd0db`.
- Cliente: `6cbc8568a7137b81ba354842212aa2d2a225217c`.
- Tag por repositório: `backup/pre-saas2-20261104`.

Antes de publicar, registre `git rev-parse origin/master`. Para voltar o código, crie uma branch de rollback a partir da master atual, reverta **somente os commits deste trabalho**, do mais recente para o mais antigo, rode os checks e faça merge/push normal. Não use reset seguido de force push. Se a incorporação tiver sido um merge com dois pais, use `git revert -m 1 <merge>` somente após verificar os pais; em fast-forward, não existe um commit de merge para reverter.

Não reverta commits posteriores de outros trabalhos sem revisão. Não altere a árvore original pendente do dono nem apague branches/backups. O rollback pelo painel do Cloudflare também deve selecionar o deployment e SHA anteriores corretos e ser acompanhado de teste no site publicado.

## Banco

Git/deployment anterior **não desfaz SQL**. As tabelas novas são aditivas e podem permanecer com RLS; o código anterior as ignora. Não apague fila, metas, relatórios, pagamentos ou bookings já criados. O novo contrato de hold preserva assinatura/resposta para a versão anterior; preferir mantê-lo para não perder buffers, prazo consistente, validação de disponibilidade e proteção de preço.

Se for indispensável restaurar funções, use as definições exportadas do banco real antes da mudança, compare segurança e faça transação revisada. Não restaure automaticamente SQL antigo que ignorava buffers ou validava mal o barbeiro explícito. Depósitos já gravados são snapshots: não recalcule retroativamente. Holds existentes precisam expirar ou ser cancelados por operação normal, sem derrubar constraints de concorrência.

Para suspender IA, remova/desative apenas o secret opcional do provedor no Worker. O diagnóstico determinístico continua disponível. Não há job de fechamento nem fila de envio de mensagens para parar nesta entrega.
