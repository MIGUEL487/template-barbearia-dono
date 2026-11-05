# Validação e operação

Veja [auditoria e limites da evidência](AUDIT.md) e [comparação visual](PREVIEW.md).

## Diagnóstico real após publicação

1. Confirme no Cloudflare o deployment/commit ativo do Worker **template-barbearia-dono** e ambiente correto. O nome local em wrangler.jsonc é **auto-stilo-dono**; a diferença já existia e não foi mudada. Um build verde não confirma sozinho qual versão atende o domínio.
2. Entre como owner/admin, abra Raio-X → Histórico e opções → Conexão Gemini. Não compartilhe a chave. Confira somente modelo, origem e disponibilidade do contexto.
3. Execute A uma vez. Anote sucesso/erro, etapa, origem, HTTP, total e duração API. A responde sem schema/dados. Se A falhar, não avance automaticamente para testes maiores.
4. Se A passar, execute B (schema). Depois C (agregado pequeno) e D (contexto representativo de sete dias). Cada perfil pode consumir uma das cinco chamadas diárias; não execute repetidamente. Sem cota disponível, aguarde a renovação, sem alterar o banco para contornar o limite.
5. Envie uma pergunta real no chat. Confirme a indicação de resposta Gemini e o histórico ao recarregar. A fixture de testes sem chave continua exibindo resposta calculada; isso não é prova de falha em produção.
6. Se falhar, copie somente o diagnóstico seguro e os eventos `[Gemini diagnostic]`, `[Gemini]`, `[Raio-X]` do mesmo horário no Worker. Inclua versão ativa, modelo, phase/stage, origin, status, durationMs/totalMs/dataMs/quotaMs/aggregateMs, deadlineMs, inputBytes e contagens de tokens se houver. Não envie secret, cookies, cabeçalhos de autenticação, nomes ou telefones.
7. `application_deadline` próximo de 30000 ms: orçamento local excedido. `upstream_http`/504 antes do limite: resposta HTTP recebida; correlacione com logs Google/Cloudflare para identificar emissor. A passa/B falha: schema/geração estruturada. B passa/C falha na fase de dados: Supabase. C passa/D lento: tamanho/contexto ou consulta; compare os tempos. 429 distingue cota Google de `app_quota`. 404 é modelo. Não troque o modelo sem verificar seu acesso real no projeto.
8. Falha de transporte da Server Action ou ausência de log final: copiar status/duração da requisição no Network e erro/limite do Worker (sem corpo de dados ou credenciais). Isso é investigação do runtime/gateway, separada de uma resposta HTTP da API.

Variáveis existentes: chave somente secret de runtime `GEMINI_API_KEY`; `GEMINI_MODEL` opcional somente para modelo já verificado. Nenhuma variável nova obrigatória, nenhuma migration para executar.

## Git e rollback

A correção nasce de `54634ba24ba8fd45f37686ad9640fe03f336b9f2`, preservado em `backup/pre-integrated-navigation-timeout`. Merge somente depois de checks críticos passarem, por fast-forward se a master não avançar. Push normal, sem force. Branches e worktree original preservados.

Para voltar o comportamento desta entrega, crie uma branch da master atual, reverta os commits desta entrega com `git revert` (sem reset/rebase/force), valide e publique pelo fluxo normal. Para retorno emergencial no provedor, restaure a versão Cloudflare anterior explicitamente identificada no histórico do deployment; esta sessão não executou rollback nem deploy manual.

## Pendências externas

O ambiente Codex não possui acesso efetivo ao Figma/Google/Cloudflare nem credencial de runtime Gemini. Não foi possível executar A–D com o projeto real nem confirmar a resposta HTTP da aplicação publicada. O acesso público GitHub permite verificar commits/checks de build; isso será registrado separadamente, sem equiparar build a teste ao vivo. A aprovação visual final e a causa de produção continuam pendentes até obter os resultados seguros acima.
