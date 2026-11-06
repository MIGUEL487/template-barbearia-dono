# OPENAI CODEX — AUTO STILO
## Raio-X 4.0 — Inteligência determinística, relatórios automáticos e notificações PWA

### MISSÃO

Atue como Senior Full-Stack Engineer, SaaS Architect, Data Engineer e especialista em Supabase, PostgreSQL, Cloudflare Workers, PWA e Web Push.

Quero abandonar completamente a integração de inteligência artificial generativa do Raio-X.

**Não utilizaremos Gemini, OpenRouter, OpenAI ou qualquer outro modelo de linguagem para essa funcionalidade.**

O Raio-X deve ser uma central de inteligência financeira e operacional, baseada exclusivamente em cálculos verificáveis do próprio SaaS.

Repositório:

`MIGUEL487/template-barbearia-dono`

Preserve as demais funcionalidades, dados e identidade visual.

**Implemente diretamente no código. Não entregue apenas planejamento.**

---

# 1. REMOVER A DEPENDÊNCIA DE IA

Remova do Raio-X:

- Interface de chat com IA.
- Histórico de conversas como elemento principal.
- Diagnósticos de Gemini.
- Diagnósticos de OpenRouter.
- Testes de conexão com provedores.
- Indicadores de status de API generativa.
- Chamadas de geração de texto.
- Dependências generativas que não sejam utilizadas por outras funcionalidades.

Não apague históricos existentes do banco sem necessidade.

Preserve dados legados e a compatibilidade da aplicação.

Não remova tabelas que possam ser necessárias a versões anteriores sem uma migração cuidadosamente planejada.

A nova página deve funcionar sem qualquer chave de API de IA.

---

# 2. NOVA PÁGINA RAIO-X

Transforme a página em um dashboard de inteligência operacional.

O proprietário deve conseguir visualizar rapidamente:

- Atendimentos marcados.
- Atendimentos concluídos.
- Cancelamentos.
- Faltas registradas.
- Horários vagos.
- Taxa de ocupação.
- Receita prevista.
- Receita realizada.
- Despesas registradas.
- Saldo financeiro registrado.
- Meta diária.
- Progresso da meta.
- Ticket médio.
- Serviços mais realizados.
- Desempenho por profissional, quando existir mais de um.

Todos os indicadores devem utilizar dados reais.

Não invente valores.

Não confunda receita prevista com receita recebida.

Não apresente saldo de caixa como lucro líquido contábil.

---

# 3. VISÃO MATINAL — BRIEFING DO DIA

No início do expediente, gere automaticamente um relatório com:

- Data.
- Horário de início do expediente.
- Quantidade de agendamentos válidos.
- Serviços agendados.
- Horários livres.
- Receita prevista.
- Receita já recebida.
- Meta do dia.
- Progresso em relação à meta.
- Horários com maior movimento.
- Possíveis encaixes.
- Pontos de atenção.

O relatório deve ser calculado pelo backend.

Nenhum valor deve ser gerado por IA.

### Notificação matinal

No início do expediente, envie uma notificação PWA/Web Push ao proprietário.

Exemplo:

**Auto Stilo — Seu dia começou**

"Você tem 8 atendimentos previstos. Confira seu Raio-X e planeje o expediente."

O número deve ser real.

Ao tocar na notificação, abrir diretamente `/raio-x`.

---

# 4. VISÃO NOTURNA — FECHAMENTO DO EXPEDIENTE

Ao final do expediente, gere um relatório contendo:

- Atendimentos previstos.
- Atendimentos concluídos.
- Cancelamentos.
- Faltas.
- Receita prevista.
- Receita realizada.
- Despesas.
- Estornos.
- Saldo do período.
- Meta atingida.
- Taxa de ocupação.
- Ticket médio.
- Serviços realizados.
- Comparação com dias anteriores.
- Pontos de atenção para o próximo dia.

### Notificação de encerramento

Ao terminar o expediente, envie automaticamente uma notificação PWA/Web Push ao proprietário.

Exemplo:

**Auto Stilo — Expediente encerrado**

"Seu fechamento está disponível. Confira receitas, despesas e resultados do dia."

Ao tocar, abrir `/raio-x` e destacar o relatório de encerramento.

---

# 5. AGENDAMENTO AUTOMÁTICO DAS NOTIFICAÇÕES

**Isto é obrigatório: as notificações não podem depender de o proprietário abrir o painel.**

A implementação atual gera relatórios na abertura do dashboard. Isso deve ser evoluído.

Utilize um mecanismo de execução agendada no backend, como Cloudflare Cron Triggers, conforme a infraestrutura existente.

### Funcionamento

O job deve:

1. Identificar a barbearia.
2. Consultar os horários de funcionamento.
3. Determinar o início e o fim do expediente.
4. Respeitar o fuso horário `America/Sao_Paulo`.
5. Verificar feriados, dias fechados e folgas.
6. Gerar o relatório correspondente.
7. Persistir o relatório.
8. Identificar dispositivos autorizados.
9. Enviar uma notificação Web Push.
10. Registrar o resultado da tentativa.

### Garantias

- Uma notificação matinal por barbearia/data/destinatário.
- Uma notificação noturna por barbearia/data/destinatário.
- Sem duplicações.
- Idempotência.
- Tratamento de falhas.
- Retry controlado.
- Logs de envio.
- Nenhuma notificação enviada em dias sem expediente, salvo configuração explícita.

A infraestrutura agendada deve consultar horários em horário local, sem assumir que o cron utiliza automaticamente o fuso de São Paulo.

Se existirem turnos separados ou horários diferentes por barbeiro, defina claramente a regra utilizada para início e encerramento do expediente.

### Web Push

Reutilize o sistema PWA/Web Push existente.

Não crie uma segunda infraestrutura de notificações concorrente.

Respeite:

- Consentimento.
- Preferências do proprietário.
- Chaves VAPID existentes.
- Subscriptions válidas.
- Segurança das credenciais.
- Permissões de acesso.

Não prometa entrega garantida quando o dispositivo estiver offline, com notificações bloqueadas ou quando o navegador restringir o Web Push.

---

# 6. CONFIGURAÇÕES DE NOTIFICAÇÕES

Na área Configurações, adicione um grupo:

**Relatórios e notificações**

Controles:

- Receber briefing matinal.
- Receber fechamento diário.
- Horário baseado no expediente.
- Testar notificação.
- Consultar status da assinatura PWA.

Os controles devem respeitar o design system atual.

Não adicione dropdowns ou accordions genéricos sem transição.

A preferência deve ser persistida e respeitada pelo backend.

---

# 7. RELATÓRIOS E HISTÓRICO

O Raio-X deve permitir consultar relatórios antigos.

Crie uma navegação elegante para:

- Hoje.
- Ontem.
- Últimos 7 dias.
- Últimos 30 dias.
- Data personalizada.

O proprietário poderá abrir o briefing e o fechamento de qualquer dia com relatório disponível.

### Visualização

Use:

- Indicadores.
- Gráficos compactos.
- Barras de progresso.
- Comparativos.
- Tabelas quando úteis.
- Destaques de desempenho.

Não apresente apenas texto corrido.

Se não houver relatório para determinada data, apresente um estado vazio apropriado.

---

# 8. RECOMENDAÇÕES SEM IA

Crie um sistema de insights baseado em regras verificáveis.

Exemplos:

**Baixa ocupação**

Se a ocupação estiver abaixo de um limite configurado, mostrar uma oportunidade de preenchimento.

**Meta próxima**

Se o faturamento realizado estiver próximo da meta, mostrar o progresso.

**Cancelamentos acima da média**

Se houver dados suficientes e a taxa ultrapassar a referência histórica, apresentar um ponto de atenção.

**Horários disponíveis**

Se existirem horários livres antes do encerramento, apresentá-los como possíveis encaixes.

**Retenção**

Quando houver histórico suficiente, mostrar tendências de retorno de clientes.

Todas as recomendações devem ser explicáveis, com a condição e os dados que as originaram.

Não gerar afirmações sem fundamento.

---

# 9. DESIGN VISUAL

Mantenha o design system da Auto Stilo e a direção visual baseada no template Figma:

https://www.figma.com/design/V3mfGLLmcroAuhAdhGtmoD/Sales-Management-Dashboard--Community-?node-id=0-1

Quero:

- Indicadores compactos.
- Gráficos bem organizados.
- Layout editorial.
- Hierarquia clara.
- Tema grafite.
- Acentos roxos/lavanda.
- Tabelas refinadas.
- Visualizações responsivas.
- Transições fluidas.
- Estados vazios elegantes.

Não refaça a identidade visual.

Não crie uma página cheia de cards repetitivos.

### Regra de componentes

Todos os componentes expansíveis personalizados devem ter abertura e fechamento elegantes.

Botões devem possuir estados hover, active, loading e focus consistentes com o design system.

Respeite acessibilidade e `prefers-reduced-motion`.

---

# 10. SKILLS

Descubra e leia os `SKILL.md` das skills existentes e pertinentes.

### Figma

`figma-use`, `figma-design-to-code`.

### Design

`apple-design`, `frontend-design`, `high-end-visual-design`, `design-taste-frontend`, `minimalist-ui`, `impeccable`, `ui-ux-pro-max`, `genjutsu`, `brandkit`, `brand-guidelines`, `extract-ds`, `taste`.

### Motion

`gsap-scrolltrigger`, `gsap-react`, `animate`, `ui-animations`, `motion-design`, `web-animation-design`, `Inspira UI`, `inspo-ui`.

### Testes

`verification`, `webapp-testing`, `playwright-cli`, `playwright-triage`, `playwright`, `strix`.

### Backend

Procure também skills disponíveis de Supabase, PostgreSQL, Cloudflare Workers, PWA, notificações e segurança.

Não invente skills instaladas.

---

# 11. TESTES OBRIGATÓRIOS

Utilize testes automatizados e Playwright.

### Raio-X

- Todos os indicadores calculados corretamente.
- Dados reais da barbearia.
- Datas e períodos corretos.
- Meta configurável.
- Comparativos corretos.
- Estados vazios.
- Sem dependência de IA.

### Relatórios

- Briefing matinal gerado.
- Fechamento noturno gerado.
- Sem relatórios duplicados.
- Persistência correta.
- Histórico funcionando.
- Horários de expediente respeitados.

### Notificações

- Cron agendado.
- Execução independente de acesso ao painel.
- Web Push enviado somente a subscriptions autorizadas.
- Notificação abre `/raio-x`.
- Preferências respeitadas.
- Ausência de duplicações.
- Tratamento de falhas.
- Testes em Android e iPhone quando houver dispositivos disponíveis.

### Regressão

- Agendamento.
- Agenda.
- Financeiro.
- Análises.
- Fila de espera.
- Modo Resgate.
- Autenticação.
- PWA.
- Notificações existentes.

---

# 12. GIT, DEPLOY E ROLLBACK

Antes de alterar:

1. Registre o commit atual.
2. Crie backup Git.
3. Preserve alterações locais.
4. Trabalhe em branch específica.

Após implementar:

1. Execute lint.
2. Execute TypeScript.
3. Execute build.
4. Execute testes.
5. Valide visualmente.
6. Faça merge seguro.
7. Faça deploy na Cloudflare.
8. Confirme publicação.
9. Confirme o agendamento real do cron.
10. Teste a execução do job e o Web Push.
11. Documente rollback.

Não execute migrations automaticamente em produção.

Se forem necessárias novas tabelas ou configurações, gere SQL versionado e um instalador revisável para execução manual.

Não diga que as notificações estão funcionando apenas porque o código do cron foi criado.

**É obrigatório confirmar a configuração da rotina agendada na Cloudflare.**

---

# RESULTADO ESPERADO

Quero o Raio-X funcionando como uma central de inteligência automática, sem IA generativa.

O proprietário deve conseguir:

- Abrir e entender seu dia.
- Visualizar resultados financeiros.
- Conferir horários disponíveis.
- Acompanhar metas.
- Ver oportunidades e pontos de atenção.
- Consultar relatórios antigos.
- Receber notificações no início do expediente.
- Receber notificações no final do expediente.

**Não quero chaves de IA, chat com modelo ou erros de conexão com Gemini/OpenRouter.**

Quero cálculos reais, relatórios confiáveis, notificações automáticas e uma interface extremamente bem desenvolvida.

IMPLEMENTE DIRETAMENTE NO CÓDIGO.