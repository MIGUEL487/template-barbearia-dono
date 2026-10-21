import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createServerAdminClient } from "@/lib/supabase-server";

// Função para validação oficial de assinatura do Mercado Pago via HMAC-SHA256
function verifyMercadoPagoSignature(
  xSignatureHeader: string | null,
  xRequestIdHeader: string | null,
  dataId: string | null,
  secret: string
): boolean {
  if (!xSignatureHeader || !xRequestIdHeader || !dataId || !secret) {
    return false;
  }

  // x-signature tem formato: "ts=1704067200,v1=abcdef..."
  const parts = xSignatureHeader.split(",");
  let ts: string | null = null;
  let hashV1: string | null = null;

  for (const part of parts) {
    const [key, val] = part.trim().split("=");
    if (key === "ts") ts = val;
    if (key === "v1") hashV1 = val;
  }

  if (!ts || !hashV1) {
    return false;
  }

  // Manifest oficial: "id:[data.id];request-id:[x-request-id];ts:[ts];"
  const manifest = `id:${dataId};request-id:${xRequestIdHeader};ts:${ts};`;
  const computedHash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    const computedBuf = Buffer.from(computedHash, "utf-8");
    const receivedBuf = Buffer.from(hashV1, "utf-8");

    if (computedBuf.length !== receivedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuf, receivedBuf);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dataId = url.searchParams.get("data.id") || url.searchParams.get("id");
    const rawBody = await req.text();
    const event = JSON.parse(rawBody || "{}");
    const eventId = dataId || event.data?.id || event.id;

    if (!eventId) {
      return NextResponse.json({ error: "Identificador do evento não informado" }, { status: 400 });
    }

    const isProduction = process.env.NODE_ENV === "production";
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const isSimulatedDev = !isProduction && process.env.PAYMENTS_SIMULATION === "true";

    // 1. REJEIÇÃO EM PRODUÇÃO SE FALTAR CREDENCIAIS
    if (!webhookSecret || !mpAccessToken) {
      if (!isSimulatedDev) {
        console.error("ERRO CRÍTICO: Webhook invocado sem MERCADOPAGO_WEBHOOK_SECRET ou MERCADOPAGO_ACCESS_TOKEN configurados.");
        return NextResponse.json(
          { error: "Serviço de pagamentos não configurado no servidor" },
          { status: 503 }
        );
      }
    }

    // 2. VALIDAÇÃO CRIPTOGRÁFICA DA ASSINATURA (SE EM PRODUÇÃO OU SE SECRET FORNECIDO)
    if (webhookSecret) {
      const xSignature = req.headers.get("x-signature");
      const xRequestId = req.headers.get("x-request-id");
      const isValid = verifyMercadoPagoSignature(xSignature, xRequestId, String(eventId), webhookSecret);

      if (!isValid) {
        console.warn(`[SEGURANÇA] Assinatura do webhook Mercado Pago inválida para eventId ${eventId}`);
        return NextResponse.json({ error: "Assinatura do webhook inválida" }, { status: 401 });
      }
    }

    const supabase = createServerAdminClient();
    const idempotencyKey = `mp_evt_${eventId}`;

    // 3. IDEMPOTÊNCIA: REGISTRAR STATUS 'received' ANTES DO PROCESSAMENTO
    const { data: existingEvent, error: fetchEventError } = await supabase
      .from("payment_events")
      .select("id, payload")
      .eq("event_key", idempotencyKey)
      .maybeSingle();

    if (existingEvent) {
      const payloadObj = existingEvent.payload as Record<string, unknown> | null;
      if (payloadObj && payloadObj.processed_at) {
        return NextResponse.json({ message: "Evento duplicado já processado com sucesso." }, { status: 200 });
      }
    } else {
      await supabase.from("payment_events").insert({
        event_key: idempotencyKey,
        event_type: event.type || event.action || "payment.updated",
        payload: {
          received_at: new Date().toISOString(),
          raw_event: event,
        },
      });
    }

    // 4. CONSULTA ATIVA NA API DO MERCADO PAGO
    let paymentData: {
      id: string | number;
      status: string;
      external_reference: string | null;
      transaction_amount: number;
    } | null = null;

    if (mpAccessToken) {
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${eventId}`, {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
        },
      });

      if (!mpResponse.ok) {
        return NextResponse.json({ error: "Falha ao consultar pagamento na API oficial do Mercado Pago" }, { status: 502 });
      }

      const resJson = await mpResponse.json();
      paymentData = {
        id: resJson.id,
        status: resJson.status,
        external_reference: resJson.external_reference || null,
        transaction_amount: Number(resJson.transaction_amount || 0),
      };
    } else if (isSimulatedDev) {
      paymentData = {
        id: eventId,
        status: event.data?.status || "approved",
        external_reference: event.data?.external_reference || null,
        transaction_amount: Number(event.data?.transaction_amount || 0),
      };
    }

    if (!paymentData) {
      return NextResponse.json({ error: "Não foi possível obter dados do pagamento" }, { status: 502 });
    }

    // 5. CONFERIR external_reference E VALOR
    if (!paymentData.external_reference) {
      console.warn(`[WEBHOOK] Pagamento ${paymentData.id} não possui external_reference vinculado. Ignorando.`);
      return NextResponse.json({ message: "Pagamento ignorado por falta de external_reference" }, { status: 200 });
    }

    const bookingId = paymentData.external_reference;

    // Buscar booking correspondente no Supabase
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, barbershop_id, total_price, deposit_amount, status")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingErr || !booking) {
      console.warn(`[WEBHOOK] Booking ${bookingId} não localizado.`);
      return NextResponse.json({ message: "Reserva vinculada não localizada." }, { status: 200 });
    }

    // 6. PROCESSAMENTO ATÔMICO
    if (paymentData.status === "approved") {
      // Confirmar booking
      await supabase
        .from("bookings")
        .update({ status: "confirmed", updated_at: new Date().toISOString() })
        .eq("id", booking.id);

      // Atualizar ou inserir pagamento com status approved
      await supabase
        .from("payments")
        .update({
          status: "approved",
          external_payment_id: String(paymentData.id),
          updated_at: new Date().toISOString(),
        })
        .eq("booking_id", booking.id);

      // Registrar receita no livro caixa se não existir transação correspondente
      await supabase.from("financial_transactions").insert({
        barbershop_id: booking.barbershop_id,
        booking_id: booking.id,
        type: "income",
        amount: paymentData.transaction_amount || booking.deposit_amount || booking.total_price,
        description: `Pagamento Online Aprovado - Mercado Pago (${paymentData.id})`,
      });
    } else if (paymentData.status === "rejected" || paymentData.status === "cancelled") {
      await supabase
        .from("bookings")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", booking.id);

      await supabase
        .from("payments")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("booking_id", booking.id);
    }

    // 7. MARCAR processed_at COM SUCESSO NA TABELA DE EVENTOS
    await supabase
      .from("payment_events")
      .update({
        payload: {
          received_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          payment_id: paymentData.id,
          status: paymentData.status,
        },
      })
      .eq("event_key", idempotencyKey);

    return NextResponse.json({ success: true, booking_id: booking.id, status: paymentData.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("Falha no webhook do Mercado Pago:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
