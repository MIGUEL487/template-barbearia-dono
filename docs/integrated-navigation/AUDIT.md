# Auditoria — navegação integrada e Gemini 504

Base remota conferida antes da alteração: `54634ba24ba8fd45f37686ad9640fe03f336b9f2`. Branch `fix/integrated-navigation-gemini-timeout`; backup local `backup/pre-integrated-navigation-timeout`. O worktree original do dono mantém alterações não commitadas, sem modificação (SHA256 do diff: cdca2c3b4d01a20bc57fdd9a291057755dc0dc97b3035b9f77f601bf82c7c7bc). Cliente não alterado.

## Evidência visual e escopo

O layout anterior tinha padding/gap de 24 px envolvendo a sidebar, raio de 20 px, top de 24 px e altura `100svh - 48px`. O chat acrescentava uma coluna permanente de 224 px (`.s3-history`). Ambos contrariavam a composição lateral contínua pedida. A correção altera o shell compartilhado de todas as 12 áreas: sidebar sem margens nem raio externo, altura do viewport, divisória única e conteúdo adjacente. Não existem duas sidebars permanentes no Raio-X.

Histórico, diagnóstico e opções agora ficam em dialog/drawer controlado, com foco modal, Escape, retorno de foco e animação compartilhada/reduced-motion. Conversa e relatórios usam a largura principal. Composer começa com uma linha, cresce até 160 px; Enter envia, Shift+Enter quebra linha, composição IME não dispara envio. A prevenção de envios duplicados existente foi mantida. O último relatório apresenta valores e detalhes expansíveis na conversa.

Figma: não houve inspeção direta do arquivo. Nesta sessão não há ferramenta Figma callable e a política de rede efetiva continua sem os hosts Figma/Google/Cloudflare. Os padrões estruturais expressamente descritos pelo proprietário são a referência acessível. As imagens locais comprovam a implementação, não equivalência pixel a pixel com frames inacessíveis. Skills locais apple-design, ui-animations e webapp-testing orientaram foco, movimento, composição e revisão; o teste usa a fixture Playwright JavaScript existente.

## Gemini — confirmado versus hipótese

O proprietário forneceu evidência de produção: secret reconhecido, categoria `timeout`, HTTP 504. Isso NÃO é evidência de chave ausente. Não foi solicitada nova configuração da chave.

Confirmado no código-base: SDK `@google/genai` 2.32.0, API Gemini (não Vertex), alias `gemini-flash-latest`, `httpOptions.timeout: 12000`, uma tentativa. O SDK aplica AbortController por tentativa e envia `X-Server-Timeout` com o timeout em segundos. O classificador anterior agrupava 408, 504 e abort/timeout sem origem nem duração. Ele não criava um status 504 para um aborto sem status. Não há configuração de limite de 12 s em wrangler.jsonc nem maxDuration nas ações inspecionadas.

Portanto o HTTP 504 relatado é compatível com uma resposta HTTP no caminho da API; não prova que o timer JavaScript foi o causador nem distingue Google de um intermediário. O cabeçalho de 12 s pode contribuir, mas falta telemetria real para afirmar isso. A duração real da falha, modelo disponível para o projeto, cota Google e logs Worker não estão acessíveis nesta sessão. Não há causa raiz de produção comprovada ainda.

Correção: janela API limitada a 30 s, uma tentativa, cancelamento explícito do fetch/corpo pelo AbortSignal, timer limpo em finally, sem loop de retry. Não é um aumento ilimitado nem substitui a investigação. O modelo não foi trocado arbitrariamente. Logs seguros medem agregado Supabase, RPC de cota, chamada/validação e total; incluem bytes do agregado e tokens informados pela API quando disponíveis. Não registram chave, prompt, respostas brutas ou dados de clientes. Falha conserva fallback calculado explicitamente identificado.

Origem `application_deadline` significa cancelamento pelo timer da aplicação, sem inventar HTTP. `upstream_http` significa status recebido no caminho HTTP da API, não identificação definitiva do emissor. `sdk_or_network` indica erro sem status; `response_validation`, resposta recebida porém inválida. Se não houver retorno da Server Action nem log final, examinar o gateway/Worker separadamente; o navegador não deve atribuir isso automaticamente ao Google.

Diagnósticos A/B/C/D são protegidos por owner/admin e pelo mesmo limite diário de cinco chamadas. Metadados não chamam Google. A: prompt mínimo sem schema/dados. B: schema real sem dados financeiros. C: indicadores reais de hoje. D: contexto de sete dias com indicadores, comparação, série diária, serviços agregados e sem contatos. Um clique executa somente o perfil escolhido; cache/singleflight separa loja, modelo, perfil e agregado. Acertos de cache não consomem novamente a cota. Falhas não são armazenadas como sucesso; tentativa subsequente conta na cota.

## Preservação

Nenhum SQL, migration, seed, RLS, tabela, reserva, hold, pagamento, service worker, assinatura push ou configuração Cloudflare foi alterado. A auditoria AST de contratos preserva as consultas e chamadas das páginas principais. Os testes de banco usam um servidor Supabase falso local, nunca dados reais.

## Arquivos de implementação

- `src/styles/management-premium.css`: shell integrado e navegação móvel contínua.
- `src/styles/saas3.css`: uma coluna principal de conversa, drawer e composer compacto.
- `src/components/saas3/chat.tsx`: histórico sob demanda e relatório expansível no próprio fluxo.
- `src/components/saas3/gemini-diagnostic.tsx`: seleção A–D e apresentação de tempos/origem.
- `src/app/actions/gemini-diagnostic-actions.ts`: autorização, perfis isolados, agregados reais sem dados pessoais e tempos por etapa.
- `src/app/actions/chat-actions.ts`: medição do agregado e registro seguro da chamada já existente.
- `src/lib/saas2/gemini.ts`: limite cancelável, uma tentativa, perfis e telemetria; cache continua por loja/modelo/agregado e agora também perfil.
- `src/lib/saas2/gemini-errors.ts`: diagnóstico seguro com origem e falha distinta de consulta de indicadores.
- `tests/saas31-gemini.test.mjs`: timeout local/HTTP 504, perfis, autorização, cota e ausência de segredo no retorno.
- `scripts/qa-full-management.mjs`: evidências desta entrega, drawer, relatório no fluxo, Shift+Enter e alinhamento da sidebar ao viewport. Cleanup suporta subprocesso já encerrado.

As capturas vêm de Next dev com dados sintéticos. O indicador N/Issues do ambiente de desenvolvimento não existe no build de produção e não foi interpretado como erro da aplicação; os testes também verificam erros JavaScript de página. Uma execução de QA sobreposta foi descartada por conflito de porta; a execução isolada é a referência válida.
