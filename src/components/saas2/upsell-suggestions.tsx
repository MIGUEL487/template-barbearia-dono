"use client";
import { useEffect, useState } from "react";
import { upsellAction } from "@/app/actions/commercial-actions";
import { formatCurrency } from "@/lib/utils";
export function UpsellSuggestions({
  shopId,
  bookingId,
}: {
  shopId: string;
  bookingId: string;
}) {
  const [result, setResult] = useState<Awaited<
      ReturnType<typeof upsellAction>
    > | null>(null),
    [selected, setSelected] = useState("");
  useEffect(() => {
    let alive = true;
    upsellAction(shopId, bookingId).then((r) => {
      if (alive) setResult(r);
    });
    return () => {
      alive = false;
    };
  }, [shopId, bookingId]);
  return (
    <section className="rounded-xl border border-border p-4 mb-4">
      <h3>Serviços complementares · avaliação manual</h3>
      <p className="text-xs text-text-muted mt-2">
        Somente serviços ativos cadastrados. Nenhum adicional será incluído na
        cobrança ao concluir este atendimento.
      </p>
      {result?.ok ? (
        result.services.length ? (
          <div className="space-y-2 mt-4">
            {result.services.map((s) => (
              <button
                className="block w-full text-left rounded-lg border border-border p-3 text-sm"
                type="button"
                aria-pressed={selected === s.id}
                key={s.id}
                onClick={() => setSelected(selected === s.id ? "" : s.id)}
              >
                {s.name} · {formatCurrency(Number(s.price))} ·{" "}
                {s.duration_minutes} min{" "}
                {selected === s.id ? "✓ Avaliar com o cliente" : ""}
              </button>
            ))}
            {selected && (
              <p className="text-xs text-text-muted">
                Sugestão selecionada para conversar. Se aceita, registre o
                serviço em um novo atendimento pela agenda, conferindo
                disponibilidade e pagamento. A reserva atual permanece igual.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs">Nenhum outro serviço ativo cadastrado.</p>
        )
      ) : (
        <p className="text-xs mt-2">
          {result?.error || "Consultando serviços cadastrados…"}
        </p>
      )}
      <p className="text-xs text-text-muted mt-2">
        Produtos e estoque não disponíveis neste sistema.
      </p>
    </section>
  );
}
