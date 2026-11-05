import Link from "next/link";
import { ManagementLayout } from "@/components/admin/management-layout";
import { Support } from "@/components/saas2/support";
export default function SupportPage() {
  return (
    <ManagementLayout
      title="Suporte"
      subtitle="Orientações para aproveitar cada área da sua gestão."
    >
      <div className="mg-help-grid">
        {[
          ["/agenda", "Sua operação", "Agenda, disponibilidade e pré-reservas"],
          [
            "/financeiro",
            "Controle financeiro",
            "Lançamentos, caixa e conciliação",
          ],
          ["/raio-x", "Inteligência", "Conversas, relatórios e conexão Gemini"],
        ].map(([href, title, text]) => (
          <Link className="mg-panel mg-help-card" href={href} key={href}>
            <span className="mg-overline">Explorar</span>
            <h2>{title}</h2>
            <p>{text}</p>
            <span>Abrir área ↗</span>
          </Link>
        ))}
      </div>
      <Support />
    </ManagementLayout>
  );
}
