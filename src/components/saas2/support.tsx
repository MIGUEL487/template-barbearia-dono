import {Expandable} from "@/components/ui/expandable";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import packageInfo from "../../../package.json";
const { version } = packageInfo;
const answers = [
  [
    "Como registro compras, vendas e despesas?",
    "No Financeiro, use Nova movimentação ou os atalhos de compra/venda. Pendências não são recebimentos. Lançamentos manuais podem ser editados ou anulados com histórico; pagamentos conciliados usam o fluxo original. Vincular um agendamento reutiliza a receita existente, sem duplicar.",
    "/financeiro",
  ],
  [
    "Como converso com o Raio-X?",
    "Faça perguntas sobre números e períodos. O servidor consulta dados autorizados; Gemini interpreta quando disponível. Sem provedor, a resposta é calculada e identificada. Não informe contatos pessoais. Conversas são privadas por usuário e loja.",
    "/raio-x",
  ],
  [
    "Como configuro o expediente?",
    "Abra Equipe, escolha o profissional e ajuste expediente, almoço e folgas. Bloqueios e dias fechados também afetam a disponibilidade pública.",
    "/equipe",
  ],
  [
    "Como cadastro serviços e profissionais?",
    "Use Serviços para preço, duração e preparação. Em Equipe, ative apenas profissionais aptos e configure a foto e o expediente. Com um único profissional ativo, a seleção é automática.",
    "/servicos",
  ],
  [
    "Como funciona o sinal Pix?",
    "Informe de 0 a 100%, com até duas casas decimais. O servidor calcula o sinal ao criar a pré-reserva. Alterar o percentual não modifica reservas anteriores. Sinal calculado ou solicitado não significa recebido.",
    "/configuracoes",
  ],
  [
    "Como interpreto Análises e Raio-X?",
    "Receita realizada vem do livro caixa. Previsão é o valor dos serviços das reservas válidas e pode incluir dinheiro já recebido. Saldo registrado deduz somente estornos e despesas cadastrados, sem prometer lucro líquido.",
    "/analises",
  ],
  [
    "O encerramento é automático?",
    "Briefing e fechamento são gerados uma vez por data na primeira abertura após os horários cadastrados. Não há job em segundo plano. Sem acesso, a próxima abertura pode gerar o fechamento do último dia de expediente. Relatórios não lançam recebimentos.",
    "/raio-x",
  ],
  [
    "O que é demonstrativo?",
    "Campanhas e conversa do assistente não enviam mensagens nem criam agendamentos. Áudio e WhatsApp são integrações futuras. IA generativa é opcional e usa somente indicadores agregados, com limite diário.",
    "/resgate",
  ],
  [
    "A fila de espera avisa o cliente?",
    "Não automaticamente. Consulte uma vaga, crie a pré-reserva explícita e contate manualmente o cliente pelo meio autorizado. O banco valida ordem, disponibilidade e concorrência. A oferta segue a validade normal de 15 minutos.",
    "/fila-de-espera",
  ],
  [
    "Como ativo notificações neste aparelho?",
    "Use Ativar notificações abaixo. No iPhone, instale pela opção Adicionar à Tela de Início e abra o app instalado. Permissão do aparelho, chaves VAPID, função e webhook precisam estar configurados. O som exige um clique para ativação.",
    "/configuracoes",
  ],
];
export function Support() {
  return (
    <Card>
      <CardTitle>Suporte e ajuda interna</CardTitle>
      <p className="text-text-muted mt-4">
        Auto Stilo Gestão · versão {version} · experiência SaaS 3.0. Nenhum
        canal externo de suporte foi cadastrado.
      </p>
      <div className="space-y-4 mt-4">
        {answers.map(([q, a, href]) => (
          <Expandable key={q} className="border border-border rounded-xl p-4">
            <summary className="cursor-pointer">{q}</summary>
            <p className="text-sm text-text-muted mt-4">{a}</p>
            <Link className="text-accent-light text-sm block mt-4" href={href}>
              Abrir área →
            </Link>
          </Expandable>
        ))}
      </div>
    </Card>
  );
}
