> Política posterior obrigatória: [somente modelos gratuitos](../ai-free-only/README.md). Use `OPENROUTER_MODEL=openrouter/free`.

> Correção posterior: [TypeError no Workers, roteador gratuito e diagnóstico por etapa](../openrouter-internal/README.md). O cliente HTTP usa `manual` com recusa explícita de redirects, compatível com Workers.

# Raio-X — OpenRouter

Migração da base `2fe103f52c2e70c8303f6ea718c82385627af39a`, preservada em `backup/pre-openrouter`. Branch `feat/openrouter-raiox`.

## Configuração necessária no Cloudflare

Não há SQL ou migration para executar. Nenhuma configuração no painel Cloudflare foi alterada por esta tarefa.

1. Abra o Worker real **template-barbearia-dono**, ambiente de produção, em Settings → Variables and Secrets. O nome no wrangler.jsonc é **auto-stilo-dono**, diferente do alvo do build integrado já existente; não configure a chave em um Worker diferente por engano.
2. Adicione **OPENROUTER_API_KEY como Secret de runtime**. A chave precisa estar válida e ter créditos/limite suficiente no OpenRouter. Não coloque a chave em Build variables, `NEXT_PUBLIC_*`, arquivo versionado, screenshot ou chat. Se preferir CLI, o comando manual com alvo explícito é `npx wrangler secret put OPENROUTER_API_KEY --name template-barbearia-dono`; esta tarefa não executou esse comando.
3. Adicione `OPENROUTER_MODEL=openrouter/free` como variável de runtime. Pode trocar por outro identificador real que aceite saída estruturada. O default do código é esse mesmo modelo; não há lista de modelos alternativos nem troca automática para um modelo mais caro.
4. Opcional: `OPENROUTER_TIMEOUT_MS=30000`, em milissegundos. Valores inteiros de 1000 até 45000 são aceitos; ausente/inválido usa 30000. O catálogo tem limite separado de 5000 ms. Os tempos de consulta ao Supabase também aparecem no diagnóstico.
5. Aplique as alterações ao deployment conforme o fluxo Cloudflare. Preview e produção podem ter bindings diferentes: confira o ambiente onde abre o Raio-X. Os arquivos `.env.example` e `.dev.vars.example` têm apenas placeholders; para desenvolvimento, preencher somente arquivos locais ignorados.
6. `GEMINI_API_KEY` e `GEMINI_MODEL` não são mais lidos. A remoção desses secrets no provedor é opcional e deve ocorrer depois de conferir a migração; nenhuma variável externa foi apagada por esta tarefa. Sem chave OpenRouter, o sistema usa somente o resumo determinístico, claramente identificado.

## Modelo e documentação consultada

Padrão atual: `openrouter/free`, roteador gratuito documentado que seleciona variantes gratuitas compatíveis com o schema. Modelos pagos são recusados; variantes concretas :free exigem catálogo com preços zero. Os exemplos históricos abaixo documentam o formato HTTP, não autorizam modelos pagos. A tabela de preços e a disponibilidade atual da conta não foram consultadas ao vivo nesta sessão; não se promete um preço fixo.

Fontes oficiais lidas:

- [Exemplo fetch, endpoint e autenticação](https://github.com/OpenRouterTeam/openrouter-examples/blob/dec727b5cfd93767c1c16058b6fb2bc2f7f3d15a/typescript/fetch/src/basic/example.ts).
- [Modelos enumerados pelo SDK oficial](https://github.com/OpenRouterTeam/typescript-sdk/blob/680c2f4703e11205fc089440c5f7ff73e484c44c/src/types/models.ts).
- [Preferências de provedor: require_parameters/allow_fallbacks](https://github.com/OpenRouterTeam/typescript-sdk/blob/680c2f4703e11205fc089440c5f7ff73e484c44c/src/models/providerpreferences.ts).
- [Documentação oficial](https://openrouter.ai/docs) e [catálogo ao vivo](https://openrouter.ai/api/v1/models), cuja consulta direta permaneceu indisponível na rede efetiva desta sessão.

Para modelos concretos, o código consulta `/api/v1/models`, exige o ID exato e o parâmetro `structured_outputs`, e só depois autoriza uma tentativa de geração/cota. A rota dinâmica documentada `openrouter/free` segue o contrato do roteador com schema obrigatório e preço máximo zero; a configuração antiga `openrouter/auto:free` é ajustada com aviso explícito para essa rota. Catálogo validado é reutilizado por até dez minutos. Modelo ausente/incompatível causa erro explícito, sem geração, sem substituição automática e sem consumo de cota da aplicação nesse preflight. A aceitação da chave é comprovada somente por uma completion bem-sucedida, não pela leitura de um catálogo público nem pela existência do secret.

## Arquitetura e limites

O endpoint generativo é fixo: `https://openrouter.ai/api/v1/chat/completions`. Usa fetch nativo, Bearer secret somente no servidor, redirect desabilitado e `cache: no-store`. Não foi instalado SDK adicional. `@google/genai` e suas dependências não utilizadas foram removidos.

Autorização owner/admin, loja resolvida no servidor, consultas reais e cálculos permanecem antes da IA. O modelo recebe somente campos de indicadores permitidos e pergunta/contexto limitado a 16 KB. Serviços são limitados a dez itens de detalhe; indicadores totais continuam completos e calculados pelo backend. Contatos, identificadores de clientes e chave não entram no contexto montado pelo servidor. O usuário é orientado a não informar contatos na própria pergunta. O modelo não recebe ferramentas nem conexão ao Supabase e não executa operações.

Saída JSON estrita com o mesmo contrato de resumo/listas/prioridade, validada novamente com Zod. Limite de 1400 tokens de saída (64 no teste mínimo). Resposta vazia, truncada (`finish_reason` diferente de stop), inválida ou bloqueada não é apresentada como interpretação válida. O fallback calculado continua disponível e identificado; não há tentativa de reparar JSON com uma segunda chamada paga.

AbortController cancela a chamada e a leitura do corpo, com timer limpo em finally. Uma tentativa HTTP por geração, sem retry automático, inclusive quando faltam créditos. `provider.require_parameters=true` e `allow_fallbacks=false`; não se envia `models` nem ferramentas. Streaming foi considerado e não ativado: a Server Action atual valida e persiste a resposta completa de forma atômica; transmitir texto ainda não validado alteraria esse contrato e exigiria outro fluxo de erros/histórico.

## Cota, cache e custos

A tabela `ai_daily_usage` e a RPC `consume_raiox_ai_quota` não foram alteradas. A função existente autoriza a loja e incrementa atomicamente apenas enquanto `calls < 5`, por data de America/Sao_Paulo. Falhas de geração contam como tentativa após a reserva de cota; créditos e limite da chave OpenRouter são controles separados.

O idempotency/request_id persistente das mensagens continua protegendo o reenvio da mesma solicitação, inclusive entre instâncias. Botão/busy e singleflight também evitam duplicação de geração na mesma instância. Cache de sucesso: cinco minutos, isolado por loja, hash da credencial, modelo, perfil, timeout e contexto. Erros têm cooldown de quinze segundos, sem nova chamada idêntica nesse período. Esses caches são locais ao isolate e não substituem a cota atômica do banco. O diagnóstico informa cache versus nova chamada e o horário da verificação original.

Tokens e custo USD informados pelo OpenRouter são registrados como números finitos nos logs seguros; custo ausente permanece null, não zero inventado. Para novas respostas do chat, também são guardados no JSONB existente `payload.aiUsage` da mensagem. Não se cria tabela. Não use esses valores como faturamento de clientes ou custo completo da operação; são metadados reportados pelo provedor. Para limitar gasto monetário adicionalmente, configure o orçamento da própria chave no OpenRouter.

## Testes reais depois de configurar

1. Entre como owner/admin e abra Raio-X → Histórico e opções → Conexão IA. Confira modelo, origem do binding e presença do secret. Isso ainda não testa autenticação na API.
2. Execute **A** uma vez: consulta catálogo e envia uma pergunta mínima. Sucesso de uma chamada nova comprova que a chave e o modelo responderam. Cache é explicitamente indicado; não confunda resultado reutilizado com uma nova conexão.
3. Execute **B**: mesmo schema estruturado de produção, sem dados financeiros. Precisa ser validado no servidor.
4. Execute **C**: agregado autorizado de hoje. **D**: contexto agregado de sete dias. Não envie nomes, telefones nem chaves ao suporte. Os perfis usam a mesma cota de cinco: não execute todos repetidamente nem contorne a cota por SQL.
5. Faça uma pergunta simples no chat. A resposta deve conter o rótulo “dados calculados + OpenRouter”. Recarregue, abra o histórico e confirme que a resposta está salva. Renomear/excluir/nova conversa e relatórios continuam usando as ações existentes.
6. Histórico anterior continua preservado: `mode=gemini` é apenas compatibilidade dos dados antigos, exibida como “interpretação anterior”, sem chamada ao Google. Não há atualização ou exclusão em massa de conversas.
7. Ausência de chave mantém o resumo calculado e instrução de runtime. **401**: chave recusada; **402**: créditos/limite; **408**: timeout de solicitação recebido; **429**: rate limit; **502**: gateway; **503**: serviço indisponível; **504**: timeout de gateway. `timeout` sem status é cancelamento local; não se inventa HTTP 504. `model_catalog` diferencia falha de preflight e geração. Erros embutidos em HTTP 200 distinguem o código do provedor e HTTP realmente recebido.
8. Se falhar, copie somente categoria, etapa, HTTP/código, modelo, duração, timeout, cache e horário da verificação. Logs: `[OpenRouter]`, `[IA diagnostic]`, `[Raio-X]`. Nunca copie Authorization, chave, mensagens brutas ou dados de clientes.

Nesta sessão não há secret OpenRouter autorizado nem acesso de rede efetivo a openrouter.ai/Worker publicado. Não houve chamada real paga. Os testes locais do provedor são fixtures e não comprovam autenticação, créditos, disponibilidade da conta ou sucesso do chat de produção. O check público de build Cloudflare será conferido separadamente; build verde não equivale a API real validada.

## Rollback

Backup Git: `backup/pre-openrouter` → `2fe103f52c2e70c8303f6ea718c82385627af39a`. Faça rollback por branch + `git revert` dos commits desta entrega, checks e push normal; nunca force/reset de histórico. Esse retorno restabelece o código anterior Gemini, que já apresentava o timeout informado pelo proprietário; não representa garantia de API funcionando. Alternativamente, selecione no Cloudflare uma versão anterior identificada no histórico do deployment. Nenhum rollback foi executado e não existe rollback de banco necessário.
