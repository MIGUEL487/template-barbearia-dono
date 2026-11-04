# Contratos e fórmulas

## Período e precisão

Datas civis em America/Sao_Paulo; limites modernos `00:00 -03:00` até o começo do dia seguinte. Filtros validados entre 2020 e 2100, no máximo 93 dias; comparação com o período imediatamente anterior de mesma duração. Ledger é agrupado pela data do lançamento; reservas pela data inicial do atendimento.

Valores viram centavos inteiros antes das agregações. Percentual tem duas casas decimais. Sinal: `floor((totalCentavos × percentualEmCentésimos + 5000) / 10000)`. Restante: total menos sinal, sem arredondamentos independentes. PostgreSQL usa NUMERIC/ROUND e catálogo próprio, nunca o preço enviado pelo navegador. Existe o mesmo helper de dinheiro nos dois projetos; SHA-256 `2746655dd8f585f09f90ae63244311c7cbec719d71c48ead5ebfb17f99a014ce`.

## Indicadores

- Receita realizada: soma das entradas (`financial_transactions.type=income`). Pagamentos não são somados novamente.
- Previsão: valor integral das reservas confirmed/completed e hold com expiração futura. É valor de serviços programados, não saldo a receber; pode incluir dinheiro já recebido.
- Saldo registrado: entradas − refunds − expenses. Custos/taxas/descontos não cadastrados são desconhecidos. Não é lucro líquido.
- Ticket: valor dos serviços de bookings completed dividido pela quantidade desses atendimentos; não é ticket de caixa.
- Agendamentos totais: todos os status do período; válidos, cancelados, faltas e concluídos aparecem separados.
- Serviços realizados: booking_items de completed, respeitando itens repetidos/quantidades; valor de item é snapshot, não preço atual do catálogo.
- Desempenho por profissional: concluídos e valor de serviços concluídos. Com filtro de profissional, o caixa considera somente lançamentos vinculados a bookings daquele profissional; despesas/entradas sem vínculo ficam fora, com explicação na tela.
- Novo: primeira visita concluída no histórico disponível ocorreu no período. Recorrente: já havia visita concluída antes do começo do período. Conta clientes únicos atendidos, não todas as pessoas que apenas criaram hold.
- Atendimentos restantes: reservas válidas não concluídas, da data/filtro, com término posterior ao instante da consulta. Não significa pagamentos confirmados.

## Ocupação e disponibilidade

Para cada profissional ativo/dia, parte-se do expediente cadastrado. Retiram-se almoço, união de time_off e dias fechados. Das faixas restantes retira-se a união de reservas válidas. Sobreposições não contam duas vezes. Ocupação = minutos ocupados / minutos de capacidade; sem capacidade o resultado é indisponível, não um percentual inventado. Sem expediente não há slots presumidos.

A consulta real de inícios usa get_availability/get_group_availability, com IDs de loja, serviço(s), profissional e data, duração + buffers, passo de 30 minutos, folgas, almoço, bloqueios e reservas. Capacidade em minutos e quantidade de inícios possíveis são indicadores distintos. Todas as reservas temporárias duram 15 minutos após aplicar o novo contrato SQL. Holds vencidos não bloqueiam leitura; antes de inserir, são expirados apenas os holds vencidos da loja atual. A constraint de exclusão protege disputas concorrentes.

## Retenção e campanhas

Somente visitas completed anteriores ao instante atual. Agrupa múltiplos atendimentos do mesmo cliente no mesmo dia como uma visita. Menos de três dias de visita: dados insuficientes. Intervalo habitual = média dos intervalos entre dias de visita. Próximo do retorno a partir de 80%; atrasado acima de 125%. Redução de frequência exige ao menos quatro visitas e último intervalo superior a 125% da média anterior. São sinais históricos, não previsões de intenção.

Público da campanha: retornos atrasados com último consentimento WhatsApp válido e não revogado. Prévia usa texto sem contatos reais. Nenhuma mensagem é registrada como enviada, e não há fila de envio. Recomendações de upsell usam exclusivamente outros serviços ativos; nenhuma alteração financeira é feita por selecionar uma sugestão.

## Metas, encerramento e IA

Meta por loja/data. Progresso usa recebimentos da loja inteira; diagnóstico de progresso fica omitido com filtro de profissional para evitar comparar parte da receita com meta total. Encerramento é snapshot manual, único por loja/data, com data, autor e versão; regenerar atualiza o relatório, sem lançar caixa. Antes do fim do expediente é parcial; não encerra datas futuras.

IA é uma explicação opcional de números já calculados. Limite de cinco tentativas por loja/dia de Brasília via upsert atômico, incluindo falhas. Modelo fixo gpt-4o-mini, 700 tokens de saída, 12 s de timeout, JSON schema e validação Zod. Dados enviados: data, recebimentos/previsão em centavos, concluídos, holds, cancelamentos, faltas, ocupação e recebimento anterior. Não envia clientes, contatos ou ferramentas de escrita. Texto generativo é identificado como sujeito a erro; os indicadores continuam sendo a fonte oficial.
