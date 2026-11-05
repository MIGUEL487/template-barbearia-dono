# Resolução autenticada de loja e Gemini

## Evidência da causa

O código anterior de `loadIntelligence` e seis ações de metas/comercial consultava `process.env.NEXT_PUBLIC_BARBERSHOP_ID` e lançava “Barbearia não configurada” antes de autenticar ou consultar `shop_members`. Por isso uma loja válida e visível no Dashboard podia falhar nas novas páginas. Isso comprova a condição que produz o erro; não comprova por que a variável estava indisponível no Worker publicado, pois o painel Cloudflare não está acessível nesta sessão.

Não há mais dependência dessa variável no painel para resolver a loja. `resolveCurrentShop` valida `auth.getUser`, lê os vínculos do próprio usuário, escolhe a única loja ou exige seleção explícita e confere owner/admin e acesso à linha em `barbershops`. O cookie de seleção é uma preferência não confiável: um ID estrangeiro é rejeitado pela associação, nunca usado como autorização. Sem vínculos, papel inadequado, falha de consulta e loja inacessível geram mensagens diferentes; ausência de movimento produz zeros reais.

Dashboard, Financeiro, Configurações, Agenda, Clientes, Serviços, Equipe e notificações usam seleção compartilhada no navegador. Login verifica existência de vínculo sem exigir exatamente um; contas com múltiplas lojas escolhem no menu, inclusive no menu Mais do celular. Não há fallback para ID fixo ou dados demo. O site público continua usando seu ID configurado, pois não possui proprietário autenticado para identificar a loja.

No servidor, as configurações públicas Supabase podem ser lidas do contexto de runtime do OpenNext, com fallback para valores de build/Node. URLs/chaves nunca são registradas. O navegador ainda exige URL/chave pública no build; configurar somente runtime não substitui um novo build do cliente JavaScript.

## Gemini

SDK oficial `@google/genai` 2.32.0, registrado no lockfile. Modelo `gemini-flash-latest`, alias recomendado pelo README do SDK oficial instalado. A página web externa de catálogo não pôde ser consultada nesta sessão; disponibilidade efetiva na conta/região deve ser confirmada com a chave do proprietário. Não houve chamada real nem cobrança de teste.

`GEMINI_API_KEY` é lida exclusivamente no servidor do contexto Worker e, para Node local, de process.env. Não reutiliza OPENAI_API_KEY. Não existe NEXT_PUBLIC_GEMINI_API_KEY. A chamada usa Gemini Developer API, JSON estruturado validado por Zod, timeout de 12 segundos, 1400 tokens de saída e uma tentativa HTTP (sem retries ocultos). Chave inválida, 429/5xx, timeout e JSON inválido geram mensagem sanitizada sem imprimir erro bruto do SDK ou chave. Indicadores/recomendações determinísticos ficam independentes.

Somente agregados numéricos e a data são enviados. Não há nomes, telefones, emails, IDs de clientes, ferramentas de escrita, envios, cobrança ou automação administrativa. Uma interpretação não executa recomendações.

A RPC existente `consume_raiox_ai_quota` continua impondo atomicamente cinco tentativas/loja/dia de Brasília. Cota indisponível ou esgotada impede a chamada ao provedor. Cache de cinco minutos por loja + hash dos indicadores reúne chamadas simultâneas **dentro do mesmo isolate**, sem compartilhar dados entre lojas e com limite de 100 entradas. Isolates diferentes podem efetuar pedidos iguais; a proteção distribuída continua sendo a cota do PostgreSQL. Não é um cache global nem garantia de exatamente uma chamada entre Workers diferentes.

## Ativação e validação

1. Confirme no projeto Cloudflare do dono o commit de produção correto. Build: URL de API `NEXT_PUBLIC_SUPABASE_URL`, chave anon `NEXT_PUBLIC_SUPABASE_ANON_KEY` e flags demo/marca d’água existentes. Não alterar banco para tentar resolver variável ausente.
2. Runtime do Worker: disponibilize as variáveis públicas Supabase caso não estejam incorporadas ao build. Configure **GEMINI_API_KEY como secret de runtime**, sem prefixo NEXT_PUBLIC. OPENAI_API_KEY não é mais utilizada; remova-a do Worker se não servir a outro módulo. Sem Gemini, publique com fallback determinístico funcionando.
3. Entre como owner/admin vinculado em shop_members. Com uma loja, a resolução é automática; com várias, selecione no menu. Mesmo um valor ausente/incorreto de NEXT_PUBLIC_BARBERSHOP_ID não determina a loja do painel.
4. daily_goals/day_closings/ai_daily_usage/waitlist_entries e grants dependem do SQL SaaS 2.0 já documentado em ATIVACAO.md e CORRECAO-42P13.md. Esta correção não acrescenta migrations e não executou SQL na produção. Tabelas/RPCs ausentes são problemas de schema, não “loja não configurada”.
5. Confira Análises, Raio-X, Resgate, fila, Financeiro e Dashboard. Ative interpretação somente por clique. Teste primeiro sem chave: indicadores devem continuar disponíveis. Com chave válida, espere JSON interpretado. Sem saldo/cota/permissão, deve aparecer indisponibilidade, nunca texto fingido.
6. No Cloudflare confirme build/deployment e SHA, depois teste a URL. Se precisar enviar logs, copie SHA, comandos de build/deploy e primeiro erro com contexto, sem valores de secrets. Push Git ou build local não comprovam deploy.

## QA e limites

`npm run test:shop-gemini`: seleção zero/uma/múltiplas lojas e preferência estrangeira; SDK oficial com HTTP simulado para resposta válida, chave inválida, rate limit, timeout, indisponibilidade, resposta inválida, cota, cache concorrente e separação por loja. Sem chave/dados reais.

Playwright `scripts/qa-saas2-ui.mjs` roda Next isolado e backend fixture com **BARBERSHOP_ID vazio**; verifica quatro páginas em quatro larguras, meta/encerramento/fila/assistente, sem vínculo, papel barber e erro de banco sem totais fictícios. Regressões das oito áreas e notificações usam fixtures, não provam entrega push em aparelho físico. Lint, typecheck, testes SaaS e build OpenNext verificam o pacote; a integração remota com Gemini/Cloudflare e o catálogo real de produção não foram acessados.

## Rollback

Backup Git `backup/pre-shop-context-gemini`. Reverta somente os commits desta correção em branch de rollback, teste e faça push normal, sem force. O commit anterior volta à integração OpenAI e à dependência problemática do ID de build: prefira corrigir a frente se a resolução de loja já estiver funcionando. Remover o secret Gemini desativa somente a interpretação; não altera indicadores. Nenhuma reversão de banco é necessária, pois não há migration nova. Não apagar vínculos, reservas ou dados financeiros.
