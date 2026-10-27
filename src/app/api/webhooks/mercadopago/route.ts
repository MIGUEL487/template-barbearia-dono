import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerAdminClient } from "@/lib/supabase-server";
import { verifyPaymentSignature } from "@/lib/payment-signature";
export async function POST(req: NextRequest) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET,
    token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!secret || !token)
    return NextResponse.json(
      { error: "Serviço de pagamentos não configurado" },
      { status: 503 },
    );
  const raw = await req.text();
  if (raw.length > 65536)
    return NextResponse.json(
      { error: "Payload excede limite" },
      { status: 413 },
    );
  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = z
    .object({ data: z.object({ id: z.union([z.string(), z.number()]) }) })
    .safeParse(event);
  const id = req.nextUrl.searchParams.get("data.id");
  if (
    !parsed.success ||
    !id ||
    String(parsed.data.data.id) !== id ||
    !verifyPaymentSignature(
      req.headers.get("x-signature"),
      req.headers.get("x-request-id"),
      id,
      secret,
    )
  )
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  try {
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      return NextResponse.json(
        { error: "Falha ao consultar pagamento" },
        { status: 502 },
      );
    const payment = z
      .object({
        id: z.union([z.string(), z.number()]),
        status: z.string(),
        external_reference: z.string().uuid(),
        transaction_amount: z.number().positive().finite(),
        currency_id: z.literal("BRL"),
      })
      .safeParse(await response.json());
    if (!payment.success || String(payment.data.id) !== id)
      return NextResponse.json(
        { error: "Pagamento inconsistente" },
        { status: 422 },
      );
    if (payment.data.status !== "approved")
      return NextResponse.json({
        message: "Pagamento ainda não aprovado; nenhuma liquidação efetuada.",
      });
    // A função SQL aplica valor, idempotência e escrituração na MESMA transação.
    // Migration proposta neste repo; não aplicada automaticamente.
    const { error } = await createServerAdminClient().rpc(
      "process_verified_payment",
      {
        p_payment_id: id,
        p_booking_id: payment.data.external_reference,
        p_amount: payment.data.transaction_amount,
      },
    );
    if (error)
      return NextResponse.json(
        { error: "Não foi possível liquidar o pagamento com segurança" },
        { status: 503 },
      );
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível processar o pagamento" },
      { status: 502 },
    );
  }
}
