# Política permanente: somente modelos gratuitos

Solicitação do proprietário: nenhum modelo pago, apenas gratuitos. Base: 14ae6f52b6c71e3ea96df70e3de403661356617e; branch fix/ai-free-only; backup histórico backup/pre-free-only-ai.

O resultado de produção informado pelo proprietário comprovou uma completion mínima em 2026-11-05T21:46:05.974Z, com cloudflare_binding e modelo openai/gpt-4o-mini, total de 2158 ms e cota de 223 ms. Isso confirma que a incompatibilidade de fetch foi superada nessa chamada, mas não comprova schema, dados reais ou histórico. Esse teste antecede a imposição da política gratuita; não é evidência de uso gratuito. Nenhuma chamada real ao provedor foi feita pelo Codex.

## Controles

- Padrão do código: `openrouter/free`.
- Se o Worker continuar configurado com modelo pago (inclusive openai/gpt-4o-mini), o resolver de runtime aplica a rota gratuita e sinaliza o ajuste no diagnóstico. O painel Cloudflare não foi alterado pelo Codex.
- Os helpers de catálogo, geração e cache recusam IDs pagos antes de HTTP/cota, mesmo quando chamados diretamente fora do resolver.
- Somente o roteador documentado `openrouter/free` ou IDs de variantes `:free` são aceitos. O roteador dinâmico usa apenas a rota gratuita, sem lista de modelos alternativos pagos.
- Para modelos concretos `:free`, o catálogo precisa confirmar preços de prompt/completion em zero e nenhum campo de preço positivo/inválido. O sufixo sozinho não basta. Se não for possível confirmar o preço, a geração falha fechada.
- Todas as completions levam `provider.max_price` de prompt/completion zero, `require_parameters=true` e `allow_fallbacks=false`.
- Cota atômica de cinco chamadas, autenticação, RLS, validação JSON, limites de tokens, timeout e histórico permanecem ativos. Gratuito não significa sem rate limit ou disponibilidade garantida; falhas mantêm fallback determinístico, sem trocar para modelo pago.

Configuração recomendada: `OPENROUTER_MODEL=openrouter/free` no runtime. O secret continua `OPENROUTER_API_KEY`, nunca NEXT_PUBLIC_. A proteção do código independe de corrigir a variável paga antiga. Nenhuma conta, secret ou configuração externa foi alterada por esta tarefa.

## Validação

Testes de regressão comprovam: binding pago resulta em roteador gratuito com aviso; helpers rejeitam IDs pagos antes de HTTP/cota; catálogo com preço não zero impede geração; todos os pedidos têm preço máximo zero. Teste workerd usa HTTP local real, credenciais sintéticas e valores de custo zero. A fixture Playwright também utiliza somente IDs :free e preço zero. Testes locais não são chamadas externas gratuitas nem comprovação de produção.

Após o novo build estar ativo, recarregue a página e confira modelo efetivo `openrouter/free` no diagnóstico. Só então execute A uma vez. Depois faça uma pergunta curta da agenda e reabra a conversa após recarregar. Continuam pendentes a resposta estruturada gratuita, pergunta real e persistência em produção. O acesso do Codex à URL foi bloqueado pelo proxy com CONNECT403 na etapa anterior; nenhuma sessão de produção foi fornecida.

## Rollback sem reintroduzir cobrança

O backup anterior é histórico e contém um padrão pago. Não restaure a versão anterior em produção sem manter a proteção free-only. Prefira correção para frente ou preserve/cherry-pick o commit dessa proteção sobre a versão de rollback. Não foi executado rollback, reset de cotas ou migration.
