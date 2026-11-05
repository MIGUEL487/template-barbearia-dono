# Evidências e escopo — SaaS 3.1

Base limpa em master: 2e1a042849c6111a22948f3a859bfa47b7c6380c. Branch feat/saas-3-1-premium; backup backup/pre-saas-3-1. A árvore original do dono, em fix-agenda-administrativa-segura, foi preservada: hash do diff cdca2c3b4d01a20bc57fdd9a291057755dc0dc97b3035b9f77f601bf82c7c7bc. Site público sem alterações.

## Inspeção de código

- Gemini: `src/lib/saas2/gemini.ts` usava @google/genai e descartava a exceção bruta, retornando erro genérico. `chat-actions.ts` descartava novamente a categoria e combinava erro Google com cota do SaaS. Isso impedia diagnosticar a falha que o proprietário observava. A leitura do binding OpenNext já existia em runtime-secret.ts; não foi atribuída uma ausência de secret em produção sem evidência.
- Modelo: gemini-flash-latest, sem substituição arbitrária. SDK instalado 2.32.0. Acesso do projeto real não verificável nesta sessão. GEMINI_MODEL opcional apenas para um identificador previamente verificado; cache separa modelos.
- Controles: havia details nativos instantâneos nas telas SaaS 3, suporte e edição de foto; selects nativos com estilo separado do CustomSelect já existente. O seletor existente não respeitava plenamente reduced-motion e usava setas para alterar valor sem confirmação. Foram unificados com as primitivas compartilhadas.
- Visual: indicadores sem ícones, cabeçalho excessivamente isolado, gráfico sem composição lateral e formulários sem agrupamento. O refinamento usa os mesmos tokens/cores/fontes e dados existentes. A revisão visual encontrou e corrigiu um seletor CSS do gráfico que atingia os SVGs de ícones novos.
- Chat: autoscroll era incondicional após responder; agora respeita a posição de leitura. Textarea tem crescimento limitado e mantém Enter/Shift+Enter.
- Integridade: SQL, ledger, funções de escrita financeira, contratos de reserva e pagamentos não tiveram alterações. Nenhuma migration nova ou execução em produção.

## Limites comprovados de acesso

Status do ambiente gerenciado: configuração atual, rede restrita/enforced, sem secrets, variáveis runtime ou identidades outbound vinculadas. Isso descreve o ambiente Codex, **não os bindings do Worker de produção**. Não implica que o proprietário configurou incorretamente o secret.

Conexões sem credenciais a www.figma.com e generativelanguage.googleapis.com retornaram `CONNECT tunnel failed, response 403` do proxy. API Cloudflare também é inacessível nesta sessão. Não houve tentativa de contornar essas restrições. Conectores Figma/Supabase não estão disponíveis; a instalação Figma não foi aceita pela ferramenta. A composição usa o adendo descritivo do usuário, não uma inspeção fictícia do arquivo.

A falha externa específica do Gemini publicado e o deploy permanecem pendentes até obter um diagnóstico real autorizado. `Conexão Gemini` exige owner/admin, informa somente metadados seguros e oferece chamada mínima com o mesmo SDK/modelo/schema. Os testes interceptados não são apresentados como chamadas Google reais.

## Verificações

Testes unitários: categoria de erros, prioridade do binding Cloudflare, fallback Node, modelo, schema, logs sem chave/dados, deduplicação por loja e modelo, cota. Regressões SaaS 2/3, assinatura de pagamento e tokens.

Playwright: quatro larguras, teclado e seleção confirmada, foco/Escape, expansões e seletor abertos/fechados, modais, financeiro, histórico, relatórios, schema ausente e vazio. Relógio de relatório controlado somente na fixture. Gestão/agenda e notificações/som/Realtime são verificadas no build local com endpoints simulados. O teste não envia push real nem escreve em banco externo.

Screenshots de antes: `docs/saas-3/evidencias/`. Screenshots depois: `docs/saas-3-1/evidencias/`. A tag de backup e rollback por novos commits permitem voltar ao SaaS 3 sem reverter dados.
