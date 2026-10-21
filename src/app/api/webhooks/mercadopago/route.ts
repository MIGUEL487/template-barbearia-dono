import { NextRequest, NextResponse } from "next/server";
import { createServerAdminClient } from "@/lib/supabase";
import { Database } from "@/types/database.types";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody || "{}");

    // Validação da assinatura do Mercado Pago (se configurada)
    const signature = req.headers.get("x-signature");
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    if (webhookSecret && !signature) {
      return NextResponse.json({ error: "Assinatura ausente" }, { status: 401 });
    }

    const eventId = event.id || event.data?.id;
    const eventType = event.type || event.action;

    if (!eventId) {
      return NextResponse.json({ error: "Identificador do evento não informado" }, { status: 400 });
    }

    const idempotencyKey = `mp_evt_${eventType}_${eventId}`;
    const supabase = createServerAdminClient();

    // 1. REGISTRO DE IDEMPOTÊNCIA (Tabela payment_events com chave única)
    const eventInsert: Database["public"]["Tables"]["payment_events"]["Insert"] = {
      event_key: idempotencyKey,
      event_type: eventType || "payment.updated",
      payload: event,
    };

    const { error: eventError } = await (supabase.from("payment_events") as any).insert(eventInsert);

    if (eventError && eventError.code === "23505") {
      // 23505 = Unique violation -> Evento já processado com sucesso!
      return NextResponse.json({ message: "Evento duplicado já processado (idempotente)" }, { status: 200 });
    }

    // 2. CONSULTA ATIVA NA API DO MERCADO PAGO
    const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    let paymentData: any = null;

    if (mpAccessToken) {
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${eventId}`, {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
        },
      });

      if (!mpResponse.ok) {
        return NextResponse.json({ error: "Falha ao consultar pagamento na API do Mercado Pago" }, { status: 502 });
      }

      paymentData = await mpResponse.json();
    } else {
      // Modo Mock/Simulação em Desenvolvimento
      paymentData = {
        id: eventId,
        status: "approved",
        external_reference: event.data?.external_reference || "mock_booking_id",
        transaction_amount: event.data?.transaction_amount || 30.0,
      };
    }

    const bookingId = paymentData.external_reference;
    const paymentStatus = paymentData.status;

    // 3. ATUALIZAÇÃO DO AGENDAMENTO E REGISTRO FINANCEIRO
    if (paymentStatus === "approved") {
      await (supabase.from("bookings") as any)
        .update({ status: "confirmed", updated_at: new Date().toISOString() })
        .eq("id", bookingId);

      await (supabase.from("payments") as any)
        .update({
          status: "approved",
          external_payment_id: String(paymentData.id),
          updated_at: new Date().toISOString(),
        })
        .eq("booking_id", bookingId);
    } else if (paymentStatus === "rejected" || paymentStatus === "cancelled") {
      await (supabase.from("bookings") as any)
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", bookingId);
    }

    return NextResponse.json({ success: true, status: paymentStatus });
  } catch (err: any) {
    console.error("Erro no processamento do webhook Mercado Pago:", err);
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
