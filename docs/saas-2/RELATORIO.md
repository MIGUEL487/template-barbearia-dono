# Auto Stilo SaaS 2.0 — implementação e limites de validação

Implementação em `feat/saas-2`, partindo de `master`. Referências anteriores: dono `b7d99e9`, cliente `6cbc856`. Backups Git locais: `backup/pre-saas2-20261104`, um em cada repositório. A árvore original do dono, com a correção administrativa ainda não publicada, foi preservada; não foi incorporada por acidente.

## O que foi implementado

| Área | Comportamento entregue |
| --- | --- |
| Configurações | Remove nome, slogan, Hero e cor do formulário e do payload permitido. Preserva dados existentes. Somente owner/admin salvam políticas, com validação estrita. |
| Sinal Pix | Corrige `0 || 50` e testes de truthiness que transformavam 0% em 50%. Cálculo em centavos, atualização ao retornar ao site/abrir resumo, resposta financeira autoritativa congelada na pré-reserva. Zero significa sem sinal obrigatório, sem confirmar automaticamente o atendimento. |
| Profissional único | Seleção automática e etapa oculta com exatamente um profissional ativo do catálogo público; zero profissionais apresenta aviso; dois ou mais preservam escolha. Homepage usa espaço, profissional real e serviços cadastrados, sem duplicar profissionais. |
| `/analises` | Recebido, previsto, saldo registrado, contagens/status, ticket, ocupação, capacidade livre, serviços concluídos, profissionais, novos/recorrentes, retenção e comparação com período anterior. Gráficos de barras interativos e responsivos, sem biblioteca adicional. |
| `/raio-x` | Diagnóstico determinístico, atendimentos restantes, consulta real de slots por serviço, meta por loja/data e relatório manual idempotente. Relatório antes do fim do expediente é parcial; datas futuras não podem ser encerradas. |
| IA opcional | Chamada server-side ao Google Gemini somente após clique e autenticação owner/admin. Indicadores agregados, sem nomes/contatos/IDs de clientes; schema validado; modelo fixo, timeout, 1400 tokens de saída e limite atômico de cinco tentativas por loja/dia. Sem chave, o diagnóstico determinístico funciona normalmente. |
| `/resgate` | Capacidade ociosa, cancelamentos, retenção por histórico e prévia editável de campanha. Público elegível considera consentimento vigente. Sem envio, fila de mensagens, links de disparo ou descontos automáticos. |
| Assistente demonstrativo | Exemplos de hoje/amanhã e “depois das HHh”; consulta real de disponibilidade autenticada. Não é um interpretador geral de IA, não grava reservas; áudio/WhatsApp são futuros. |
| `/fila-de-espera` | Cadastro público com contato manual consentido, data/janela e seleção atual de serviços/profissional; rejeita datas sem expediente compatível. Painel ordenado consulta vagas sob demanda. Oferta explícita cria hold de 15 minutos por RPC transacional, com FIFO entre solicitações elegíveis, lock e exclusão de sobreposição. Repetição retorna a mesma reserva. Status confirmado/concluído continua respeitado após o prazo original do hold. |
| Upsell | No diálogo de concluir, recomenda outros serviços ativos realmente cadastrados. Seleção é apenas avaliação com o cliente; não muda a cobrança. Novo serviço aceito deve ser registrado pela agenda. Não há produtos/estoque. |
| Suporte | FAQ interna, links das áreas existentes, versão, sinal, notificações e explicação das demonstrações. Nenhum contato externo inventado. |

## Correções verificadas na inspeção

1. Configurações usava fallback por truthiness; 0% carregava como 50%. O cliente também ignorava percentual zero. Ambos foram corrigidos.
2. O contrato SQL versionado antigo de reserva individual divergia do contrato de grupo: prazo de 10/15 minutos, buffers e validação do horário explícito. A nova migration unifica o contrato, recalcula preço e duração no servidor e preserva o mecanismo existente de pagamento verificado. **Não significa que o banco publicado já foi alterado.**
3. Valores solicitados são lidos da resposta do servidor. Uma mudança futura de percentual não reescreve `bookings.deposit_amount` nem pagamentos históricos.
4. Políticas de sinal ausentes/inválidas ou erro no carregamento inicial não produzem um resumo “de exemplo”: o fluxo é bloqueado com mensagem e erro real no console.

## Testes executados

- Lint, typecheck, build estático do cliente e `build:cf` do dono com `DEMO_MODE=false`, URL de projeto e chaves públicas **fictícias** para QA; tokens de design conferidos pelos verificadores existentes.
- Wrangler `deploy --dry-run` dos dois pacotes: empacotamento local, **sem deploy**.
- Testes de centavos, 0/50/100/33,33%, múltiplos serviços, arredondamento e entradas inválidas.
- Paginação testada com limite de API de 200 registros: busca até página vazia; limite seguro/erro interrompe o cálculo sem retornar total parcial.
- Testes de análise: recebido versus previsto, despesas/estornos conhecidos, horários sobrepostos, almoço/bloqueio, holds vencidos, fronteira UTC/Brasília, retenção e estados sem dados.
- PostgreSQL local descartável `saas2_qa`: SQL idempotente, reserva/itens/buffers, snapshot de sinal após confirmação, pagamento verificado idempotente e uma única entrada financeira, grants/RLS, isolamento de outra identidade, limite de IA, FIFO e preço protegido contra tabela temporária adulterada.
- Duas conexões simultâneas oferecendo a mesma solicitação: um único hold, segunda resposta idempotente.
- Playwright: quatro páginas novas em 1440/1024/820/390 px com Server Actions reais e backend HTTP de fixture; meta, encerramento, assistente, encaixe e ausência de overflow. As novas Server Actions recusam usuário sem vínculo e papel barber; erro do banco não vira totais falsos. Isso não redefine as policies legadas de outros módulos, que continuam sujeitas à revisão de papéis da instalação real.
- Agendamento em quatro larguras: um/dois/zero profissionais, quantidades, percentuais, calendário ao lado dos horários, fuso diferente e fila sem criar hold automaticamente.
- Áreas administrativas existentes em desktop/celular e notificações: permissão após clique, subscription simulada, som, Realtime, deduplicação, service worker, desativação e orientação de instalação no iPhone.
- Hero: sequência 1–239 e reverso sem saltos, pin, scroll rápido, gesto longo, CTA, teclado e movimento reduzido. Homepage com um profissional: quatro painéis com conteúdo real do catálogo de fixture, marquee e sem overflow.

Prints/resultados em `evidencias/`, `regression-management/` e `regression-notifications/`. São evidências locais com dados de teste; não comprovam produção ou entrega de push em aparelho físico.

## Ativação e o que não foi confirmado

- **Nenhuma migration, seed ou escrita foi feita no Supabase real.** Execute/revise o SQL conforme `ATIVACAO.md`; metas, encerramentos, cota de IA e fila dependem dele. Análises usam as tabelas existentes.
- Nenhum WhatsApp, cobrança, provedor de pagamento, job ou conta externa foi ativado.
- IA generativa não foi chamada com chave real. O fallback sem provedor foi testado; qualidade do provedor e seu custo real dependem de configuração e teste posterior autorizado.
- GA não foi encontrado no código versionado do site público. Não foi possível auditar uma eventual injeção externa pelo Cloudflare; nenhum visitante/conversão foi inventado.
- Queries buscam todas as páginas, até 20 mil registros por coleção; acima disso falham explicitamente. Período personalizado limitado a 93 dias. Históricos suportados a partir de 2020, quando o calendário brasileiro não usa horário de verão. Não há consolidação em warehouse.
- Capacidade histórica é reconstruída com o expediente/bloqueios atuais, pois não há histórico versionado dessas regras. Slots RPC são alternativas de início e podem se sobrepor; não representam quantidade simultânea de serviços vendáveis.
- A fila tem limite de 500 solicitações ativas por loja/data e três por telefone/data; não implementa CAPTCHA nem comprovação da posse do telefone. Nenhum teste afirma proteção completa contra abuso anônimo.
- Push real no celular e integração com o Supabase publicado dependem de validação final no ambiente do proprietário.
- Cloudflare e suas URLs não podem ser declarados atualizados só pelo push Git. O status remoto e os limites de acesso da sessão devem constar na entrega final.

Veja `FORMULAS.md`, `ATIVACAO.md` e `ROLLBACK.md`.
