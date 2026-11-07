-- Migration: 20261107000000_automatic_finance_completion.sql
-- Registra automaticamente vendas no Financeiro ao concluir atendimento, com prevenção estrita de duplicidade (idempotência e dedução de sinal)

CREATE OR REPLACE FUNCTION public.admin_complete_booking(
  p_barbershop_id UUID,
  p_booking_id UUID,
  p_payment_received BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_already_paid NUMERIC := 0;
  v_amount_to_record NUMERIC := 0;
BEGIN
  IF NOT is_shop_member(p_barbershop_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id AND barbershop_id = p_barbershop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado.';
  END IF;

  -- Atualiza booking para completed
  UPDATE bookings SET status = 'completed', updated_at = now() WHERE id = p_booking_id;

  -- Se o pagamento foi recebido no balcão:
  IF p_payment_received THEN
    UPDATE payments
    SET status = 'approved', updated_at = now()
    WHERE booking_id = p_booking_id AND status = 'pending';

    -- Calcular valor já liquidado anteriormente (por pagamento online ou prévio) para garantir idempotência estrita
    SELECT COALESCE(SUM(amount), 0) INTO v_already_paid
    FROM financial_transactions
    WHERE barbershop_id = p_barbershop_id
      AND booking_id = p_booking_id
      AND type = 'income'
      AND entry_status = 'settled';

    v_amount_to_record := v_booking.total_price - v_already_paid;

    -- Registrar no livro-caixa apenas o saldo não registrado (evita duplicar sinal ou pagamentos online)
    IF v_amount_to_record > 0 THEN
      INSERT INTO financial_transactions (
        barbershop_id,
        booking_id,
        type,
        amount,
        description,
        entry_status,
        entry_origin,
        category,
        payment_label
      )
      VALUES (
        p_barbershop_id,
        p_booking_id,
        'income',
        v_amount_to_record,
        CASE
          WHEN v_already_paid > 0 THEN 'Saldo presencial de atendimento concluído - ' || v_booking.id::text
          ELSE 'Atendimento concluído - ' || v_booking.id::text
        END,
        'settled',
        'automatic',
        'Serviços',
        CASE WHEN v_already_paid > 0 THEN 'Presencial (Saldo)' ELSE 'Presencial' END
      );
    END IF;
  END IF;

  INSERT INTO audit_log (barbershop_id, user_id, action, entity_type, entity_id, changes)
  VALUES (
    p_barbershop_id,
    auth.uid(),
    'COMPLETE_BOOKING',
    'bookings',
    p_booking_id::text,
    jsonb_build_object(
      'paid', p_payment_received,
      'amount_recorded', v_amount_to_record,
      'previous_paid', v_already_paid
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'amount_recorded', v_amount_to_record,
    'already_paid', v_already_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_complete_booking(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_complete_booking(UUID, UUID, BOOLEAN) TO authenticated;
