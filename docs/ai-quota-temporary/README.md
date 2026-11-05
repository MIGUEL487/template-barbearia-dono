# Pausa temporária da cota: somente Auto Stilo

O proprietário solicitou remover temporariamente o limite diário após app_quota. A primeira proposta global sem prazo teve sua publicação rejeitada pela revisão automática por alcance excessivo. Ela não foi publicada. A alternativa abaixo restringe a exceção à loja conhecida e tem expiração automática.

Base 2a4461a1f40ffee4db979bf01be21ab26bde40fe; branch fix/ai-quota-temporarily-disabled; backup backup/pre-temporary-ai-quota.

- Loja: `11111111-1111-1111-1111-111111111111` (Auto Stilo), resolvida da sessão autenticada, nunca de parâmetro público.
- Janela: de 05/11/2026 19:09:03 até **06/11/2026 19:09:03, America/Sao_Paulo** (22:09:03 UTC).
- Dentro da janela, chat, diagnóstico e análise legada dessa loja não chamam `consume_raiox_ai_quota`.
- Outras lojas mantêm o limite de cinco, inclusive se a variável abaixo for false.
- No instante de expiração, o backend volta a exigir a cota automaticamente. A configuração não pode estender a janela.
- `AI_DAILY_QUOTA_ENABLED=true` no runtime permite restaurar o limite antecipadamente para Auto Stilo. Aceita true/True/TRUE/1; false/False/FALSE/0 não desativam outras lojas nem vencem a expiração.

Nenhum contador ai_daily_usage é apagado, resetado ou incrementado pelo caminho pausado. Função, grants, tabela e RLS permanecem intactos. Não existe SQL/migration a executar. Quando o limite retornar, registros existentes da mesma data São Paulo continuam valendo. A tabela diária não contabiliza tentativas feitas durante a pausa; histórico e metadados de uso do chat permanecem preservados.

Mantidos: autenticação owner/admin, seleção de loja, RLS, cache/singleflight/idempotência, limites de contexto/tokens/timeout, modelos exclusivamente gratuitos e preço máximo zero. O OpenRouter mantém seus próprios limites de modelos gratuitos e pode responder 429; não há tentativa de contorná-los, retry automático ou fallback pago.

O diagnóstico mostra o prazo da pausa para a loja autorizada. A mensagem anterior informada pelo proprietário era fallback após cota esgotada, não comprovação de IA gerada. Após o deploy, recarregue e envie uma nova pergunta. Avisos antigos de cota no histórico não são reescritos.

Testes cobrem a loja correta dentro da janela, outras lojas, ausência de contexto de loja, instante anterior, expiração e tempo inválido (todos exigem cota), restauração antecipada e parsing da variável. Ações autenticadas continuam recusando sessão sem permissão mesmo durante a pausa; a flag true volta a bloquear na RPC. O teste de navegador prova chat gratuito persistido com zero chamadas da RPC para Auto Stilo, mesmo quando a RPC simulada negaria a cota. Nenhuma chamada externa paga ou escrita no banco real foi executada pelo Codex.

Rollback: definir a variável true restaura antecipadamente; git revert desta entrega restaura o comportamento original de cota e mantém a proteção free-only presente na base. O limite também retorna automaticamente no prazo acima. Não restaure versões anteriores à proteção gratuita sem preservá-la.
