# Auto Stilo SaaS 3.1

## Referência e preservação

A composição segue os padrões descritos pelo proprietário: indicadores compactos com ícones próprios, área de receita em destaque, painel lateral de desempenho, gráficos secundários e tabela com status e barras proporcionais aos valores. Fontes Outfit/Cinzel, grafite, destaque Auto Stilo, logo, sidebar e tokens originais foram preservados. Nenhum dado demonstrativo foi incluído nas consultas de produção.

Não foi possível inspecionar os frames do Figma: o conector não está disponível, a tentativa de instalação foi recusada pela ferramenta e a conexão HTTPS ao arquivo retornou CONNECT 403 do proxy. O adendo do usuário foi usado como referência descritiva; não alegamos correspondência pixel a pixel com um arquivo inacessível. Supabase também não tem conector disponível nesta sessão. A limitação não foi contornada por outro proxy.

## Componentes

A regra permanente está documentada em `docs/COMPONENTS.md`. O seletor existente `CustomSelect` foi refinado e reutilizado, com seleção por teclado, typeahead, Escape, Tab, retorno de foco, listbox e transição de saída. `AnimatedSelect` adapta os selects existentes sem alterar seus callbacks de dados. O select nativo oculto serve apenas à compatibilidade de formulário; a interação visível é compartilhada.

`Expandable` substitui as expansões instantâneas das telas, suporte e foto do barbeiro; mantém conteúdo montado, mas fecha foco/árvore acessível com inert/aria-hidden. `useAnimatedDialog` conserva o dialog nativo e seu gerenciamento de foco, animando entrada e saída. Tooltips próprios funcionam com foco e mouse. O menu Mais mantém a composição existente, com entrada/saída, Escape e retorno de foco.

O movimento respeita tanto prefers-reduced-motion quanto a preferência de animações do aplicativo. Animações são curtas, sem zoom amplo ou glow decorativo. O chat tem textarea que cresce até 160 px, Enter/Shift+Enter, bloqueio de duplicatas, tentativa novamente e autoscroll condicionado à proximidade do final da leitura.

## Gemini: o que foi comprovado

A versão anterior já lia GEMINI_API_KEY do binding OpenNext/Cloudflare, com fallback Node. Portanto **não foi comprovado que o problema de produção fosse usar somente process.env ou que a chave estivesse ausente**. O defeito comprovado era o descarte das exceções em dois níveis: SDK e chat transformavam autenticação, modelo, quotas, timeout e resposta inválida na mesma indisponibilidade genérica.

Agora `geminiRuntime` informa internamente a origem da chave (binding Worker tem prioridade), disponibilidade do contexto e modelo. Somente metadados seguros chegam ao painel autenticado; a chave nunca é retornada, registrada ou incluída no cliente. SDK oficial `@google/genai` 2.32.0, API Gemini (vertexai false), timeout 12 s, uma tentativa, schema validado com Zod. O modelo padrão `gemini-flash-latest` foi preservado, sem troca aleatória. O identificador pode ser definido por `GEMINI_MODEL` no runtime após verificar um modelo disponível no projeto Google. A validade do alias para a credencial de produção continua dependendo do teste real.

Falhas distinguem secret ausente **neste runtime**, chave inválida, permissão Google, modelo indisponível, cota Google, frequência, timeout, rede, schema estruturado, limite diário do SaaS, falha ao consultar a RPC de quota, autorização e resolução da loja. Logs `[Gemini]` e `[Raio-X]` contêm apenas categoria, HTTP, modelo e mensagens fixas, sem corpo bruto Google, prompts ou contatos. O código Supabase da RPC, quando disponível, é filtrado antes da exibição.

Mantidos os limites: 5 tentativas generativas/loja/dia, cache de 5 minutos e singleflight. Cache também diferencia modelo. O teste técnico não lê dados de clientes nem cria mensagens, mas usa até uma tentativa da mesma cota; chamadas repetidas idênticas aproveitam o cache. Falha não é apresentada como resposta generativa bem-sucedida. Sem schema SaaS 3, a prévia continua explicitamente sem persistência/sem Gemini.

## Diagnóstico real, em ordem

1. Confirme no Cloudflare o SHA publicado desta entrega no Worker do dono. Nenhum secret foi alterado por esta implementação.
2. Abra Raio-X autenticado como owner/admin e expanda **Conexão Gemini**. A consulta inicial somente inspeciona a configuração do servidor; não consome Google nem a cota.
3. Confira modelo, origem (`cloudflare_binding` ou `process_env`) e contexto Worker. `missing_runtime_key` prova ausência na execução consultada, não ausência em todos os ambientes. Compare o ambiente/Worker do secret configurado com o deployment acessado. Build variables e runtime secrets são configurações distintas.
4. Clique **Testar integração**. A chamada é autenticada, usa a mesma leitura de secret/modelo, mesmo SDK e schema do chat, sem dados de clientes. O resultado só diz “Chamada verificada” após sucesso real do provedor.
5. Em falha, copie somente código, HTTP, modelo, origem/contexto e, se houver, código Supabase. Nunca copie GEMINI_API_KEY, tokens, headers de autenticação ou o ambiente completo. Consulte também os logs estruturados do Worker no mesmo instante.
6. `invalid_key/access_denied`: confira credencial e restrições no projeto Google. `model_unavailable`: verifique o identificador acessível para esse projeto antes de alterar GEMINI_MODEL. `provider_quota/rate_limit`: veja limites Google. `app_quota`: limite de 5 do aplicativo; não é chave inválida. `quota_check`: veja a RPC consume_raiox_ai_quota e a migration SaaS 2 existente. `structured_response`: resposta bloqueada/incompleta/incompatível; não significa automaticamente chave ausente. `network/timeout`: confira saída do Worker e disponibilidade Google.
7. Depois de teste positivo, envie uma pergunta no chat e confirme a etiqueta **dados calculados + Gemini**, o histórico após recarregar e os dados financeiros calculados pelo servidor.

**Pendente nesta sessão:** chamada real com o secret de produção, causa externa exata do fallback publicado e confirmação do deployment. O ambiente de execução não tem credencial Gemini/Cloudflare vinculada e a conexão a generativelanguage.googleapis.com retorna CONNECT 403. Não foi feito teste real Google com chave fictícia nem declarado sucesso de produção com base em mock. O diagnóstico autenticado acima permite obter a evidência que falta.

## Instalação, segurança e rollback

Não há migration nova nesta entrega. A base SaaS 3 continua exigindo `supabase/saas3-install.sql`, revisado/executado manualmente pelo proprietário caso ainda não aplicado. Nenhum SQL foi executado em produção. Agendamentos, políticas, auditoria e validação financeira não foram alterados. Site público e árvore original do dono foram preservados.

Backup: `backup/pre-saas-3-1`, base `2e1a042849c6111a22948f3a859bfa47b7c6380c`. Rollback de código por novos commits `git revert`, preservando alterações posteriores; push normal, sem reset/force. Não remover tabelas, histórico ou auditoria. Nenhuma reversão SQL é necessária para o SaaS 3.1. Configuração de secrets existente permanece intacta.

## Validação reproduzível

```
npm run typecheck
npm run lint
npm run test:shop-gemini
node --test tests/saas31-gemini.test.mjs
npm run test:saas2
npm run test:saas3
npm run test:security
npm run tokens:check
npm run build:cf
node scripts/qa-saas31-ui.mjs
```

Playwright renderiza o código real num Next isolado, com servidor Supabase HTTP sintético e credencial pública fictícia. O relógio do relatório é explicitamente ajustado para após o encerramento somente na cópia de teste, para não depender da hora de execução. Os testes de SDK interceptam fetch; validam código/categorização, não acesso à credencial real.

A matriz visual cobre 1440/1024/820/390 px, menu/selects/expansões abertos e fechados, teclado e reduced-motion; compra/edição/anulação/venda pendente/CSV, chat/histórico/relatórios, estados vazios e compatibilidade sem migration. Prints contêm fixtures identificadas. Builds são locais. O fluxo Cloudflare existente é disparado por push da master, sem deploy manual simultâneo; API Cloudflare bloqueada impede confirmar publicação nesta sessão.
