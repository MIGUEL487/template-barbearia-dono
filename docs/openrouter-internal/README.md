# Correção da falha anterior à chamada OpenRouter

Base: `8186bb9ddf11e91f23bdbf69cf8ab57a4adfe216`; branch `fix/openrouter-preflight-internal`; backup `backup/pre-openrouter-internal`. Sem migrations, mudanças de RLS, resets de cota ou redesign.

## Exceção identificada e reproduzida

No workerd real, usando a compatibility_date `2026-10-27` e nodejs_compat do projeto, o fetch rejeita `redirect: "error"` antes de efetuar I/O:

```
TypeError: Invalid redirect value, must be one of "follow" or "manual"
("error" won't be implemented since it does not make sense at the edge;
use "manual" and check the response status code).
```

A implementação anterior usava essa opção no catálogo e na geração. A exceção era convertida por classifyAiError em `internal`; o diagnóstico externo permanecia em `quota_and_provider` porque a callback da cota ainda não tinha sido chamada. Reprodução anterior à correção: HTTP sem resposta, duração model_catalog 0 ms, cota consumida 0. Isso explica a assinatura do erro fornecida pelo proprietário, sem presumir chave ausente nem timeout. Não é um log capturado no Worker de produção: é a reprodução do mesmo contrato do runtime no workerd local, com dados sintéticos.

Correção: `redirect: "manual"`, rejeição explícita de 300–399 e cancelamento do corpo, sem seguir Location nem encaminhar Authorization. O teste Worker compara o comportamento legado e corrigido contra HTTP local real, verifica prompt mínimo, schema estrito, cache, rota gratuita, limite de cinco tentativas e bloqueio de redirects. Não substitui a API real do OpenRouter por uma alegação de sucesso.

## Modelo e roteamento gratuito

Fontes oficiais consultadas no commit [445eef4f00ad2129b207b4994a57650f291710ca](https://github.com/OpenRouterTeam/docs/tree/445eef4f00ad2129b207b4994a57650f291710ca):

- [Auto Router](https://github.com/OpenRouterTeam/docs/blob/445eef4f00ad2129b207b4994a57650f291710ca/guides/routing/routers/auto-router.mdx): `openrouter/auto` e `openrouter/auto-beta`.
- [Free Router](https://github.com/OpenRouterTeam/docs/blob/445eef4f00ad2129b207b4994a57650f291710ca/guides/routing/routers/free-router.mdx): `openrouter/free`, filtra modelos gratuitos por capacidades, incluindo structured outputs.
- [Variantes free](https://github.com/OpenRouterTeam/docs/blob/445eef4f00ad2129b207b4994a57650f291710ca/guides/routing/model-variants/free.mdx): `:free` pertence a variantes concretas disponíveis, não documenta `auto:free`.
- [FAQ de endpoints](https://github.com/OpenRouterTeam/docs/blob/445eef4f00ad2129b207b4994a57650f291710ca/faq.mdx): compatibilidade OpenAI nos endpoints responses, chat/completions e completions, com mesmo formato entre modelos.

`openrouter/auto:free` não aparece nessa documentação oficial. Ele era aceito sintaticamente pela regex, mas não havia prova de ser um ID disponível. Agora essa combinação específica é normalizada localmente para o roteador gratuito documentado `openrouter/free`, com aviso explícito no diagnóstico. Recomenda-se atualizar a variável runtime para `OPENROUTER_MODEL=openrouter/free`; não se altera o painel Cloudflare automaticamente. Não se troca para `openrouter/auto` pago nem para um modelo pago silenciosamente.

A rota dinâmica gratuita não é validada como um modelo estático de catálogo: o contrato documentado é encaminhar uma completion e filtrar o modelo por `response_format`/require_parameters. Mantêm-se JSON schema estrito, validação Zod, allow_fallbacks=false, ausência de array `models` com alternativas pagas e max_price prompt/completion zero. A completion real é quem comprova autenticação e disponibilidade, não a presença do secret ou o catálogo. Modelos concretos continuam exigindo presença e capacidade no catálogo antes da cota.

## Sessão, loja e cota auditadas

`resolveCurrentShop` chama auth.getUser, consulta shop_members pelo user.id, valida seleção de loja vinculada, exige role owner/admin e confirma a leitura da barbearia sob RLS. Não usa ID de loja enviado pelo visitante nem adivinha entre várias lojas. Depois passa o UUID dessa loja para a RPC `consume_raiox_ai_quota` no parâmetro `p_barbershop_id`. O diagnóstico de runtime é montado depois dessa resolução; o erro fornecido mostra que essa fase tinha sido ultrapassada.

No SQL SaaS 2 existente: `consume_raiox_ai_quota(uuid)` retorna boolean, é SECURITY DEFINER, fixa search_path, valida `saas_can_manage`, usa auth.uid()/shop_members, restringe owner/admin e incrementa atomicamente ai_daily_usage somente enquanto calls<5. A chave é loja/data de America/Sao_Paulo. EXECUTE é revogado de PUBLIC e concedido a authenticated; a tabela mantém RLS e não concede escrita direta ao cliente. Isso é intencional: não adicionar policies de escrita pública para contornar a RPC. A instalação SaaS 3 usa a mesma base; não há mudança de contrato identificada nos arquivos do repo. O estado do banco remoto não foi lido nesta sessão.

As três entradas (chat, diagnóstico e análise legada) agora validam o retorno exato boolean. `false` é app_quota; array, null, objeto ou string não são tratados como autorização. `42501` vira quota_forbidden; PGRST202/42883, quota_missing; PGRST301/28000, authorization; outros erros de banco, quota_check. Não há geração se a cota não for concedida. O arquivo [audit-readonly.sql](audit-readonly.sql) permite inspecionar metadados manualmente sem alterar dados/permissões; não foi executado em produção.

## Diagnóstico e privacidade

Etapas distintas: cache_digest, cache_lookup/cache_hit, model_catalog/model_router, supabase_quota, provider_request e response_validation. Erros internos anteriores ao fetch recebem etapa e tipo seguro (TypeError, ReferenceError etc.), sem mensagem bruta, stack ou valores de configuração. Falhas da preparação de cache e de incompatibilidade do runtime têm categorias próprias. Logs registram presença/configuração como booleanos; não registram valores de OPENROUTER_API_KEY ou OPENROUTER_MODEL. O painel autenticado mostra o modelo efetivo e o aviso de correção, preservando os componentes atuais.

## Validação real necessária após o deploy

URL fornecida: https://template-barbearia-dono.mi-c-openheimer.workers.dev/raio-x

A tentativa de leitura dessa URL pela rede gerenciada retornou `Tunnel connection failed: 403 Forbidden` no proxy, antes de chegar ao site. Não é um 403 do Worker nem diagnóstico de sessão/chave. Não há credencial OpenRouter autorizada vinculada ao Codex, sessão autenticada de produção ou conector Supabase/Cloudflare disponível nesta sessão.

Depois de o build do commit corrigido estar ativo:

1. Na sua sessão owner/admin, abra Histórico e opções → Conexão IA. Deve mostrar `openrouter/free` e aviso de ajuste se a variável ainda for auto:free.
2. Execute A uma vez. Registre categoria/etapa, HTTP, tempos, cache e horário. Sucesso exige completion nova, não só secret reconhecido. Se vier app_quota, não resete o contador: aguarde a renovação da data São Paulo.
3. Envie uma pergunta curta, por exemplo “Como está minha agenda de hoje?”. Confirme o rótulo OpenRouter e texto gerado, sem aviso de fallback.
4. Recarregue, abra a conversa no histórico e confirme a mesma resposta salva. Isso usa a persistência existente, sem novas tabelas.
5. Envie somente o resultado seguro e o commit/versão ativa, sem senha, cookies ou chave. Se aparecer outro erro (por exemplo rate limit ou saída incompleta de um modelo gratuito), ele deve ser tratado pelo código específico; a correção do TypeError não prova que o provedor externo respondeu.

O resultado de produção permanece PENDENTE até essa evidência. Testes locais, reconhecimento da chave e build Cloudflare verde não equivalem a Raio-X funcionando em produção.

## Git e rollback

Merge por fast-forward quando master não avançar, somente após os testes críticos locais passarem. Push normal; sem force; branch e backup preservados. O push aciona o build integrado, sem deploy paralelo manual. Se necessário, crie branch da master atual e faça git revert dos commits desta entrega, valide e publique pelo fluxo normal, ou restaure uma versão identificada do histórico Cloudflare. Não há rollback de banco a fazer. Voltar à base reintroduz o fetch incompatível, portanto não garante funcionamento.

## Arquivos corrigidos

- `src/lib/saas2/openrouter.ts`: fetch manual, recusa de redirects, rota gratuita, etapas e classificação de falhas pré-provedor.
- `src/lib/saas2/ai-errors.ts`: tipo seguro da exceção, categorias de runtime/cache/banco e contrato boolean da cota.
- `src/lib/runtime-secret.ts`: correção explícita auto:free → free, com sinalização ao diagnóstico.
- `src/app/actions/ai-diagnostic-actions.ts`, `chat-actions.ts`, `intelligence-actions.ts`: validação uniforme da RPC e logs sem valores de configuração.
- `src/components/saas3/ai-diagnostic.tsx`: tipo de exceção e aviso do identificador efetivo, nos componentes existentes.
- `tests/openrouter.test.mjs`, `tests/openrouter-worker.test.mjs`, `package.json`, `.github/workflows/ci.yml`: regressões Node e workerd, incluindo o gate novo no CI.
- `scripts/qa-full-management.mjs`: evidências isoladas desta entrega. Documentação anterior atualizada por link para este relatório.
